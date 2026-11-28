// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

//go:build linux

package guestinit

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/internal/configdrive"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/filewait"
	"github.com/snapflowio/microvm-go/internal/guest/control"
)

func mountPlatformBundles(cfg *Config) error {
	for index := range cfg.PlatformBundles {
		if err := mountPlatformBundle(&cfg.PlatformBundles[index]); err != nil {
			return err
		}
	}
	return nil
}

func mountPlatformBundle(bundle *configdrive.PlatformBundle) error {
	if !platformMountPathValid(bundle.MountPath) {
		return platformMountFailure(
			fmt.Errorf("mount path %q must be beneath %s", bundle.MountPath, guest.PlatformMountPath),
		)
	}
	if !bundle.Filesystem.Valid() {
		return platformMountFailure(fmt.Errorf("unsupported filesystem %q", bundle.Filesystem))
	}
	device := filepath.Clean(bundle.Device)
	if !strings.HasPrefix(device, virtioBlockDevicePrefix) {
		return platformMountFailure(fmt.Errorf("device %q is not a virtio block device", bundle.Device))
	}
	if err := waitForPath(device, blockDeviceWaitTimeout); err != nil {
		return platformMountFailure(fmt.Errorf("wait for device %s: %w", device, err))
	}
	if err := os.MkdirAll(bundle.MountPath, mountpointMode); err != nil {
		return platformMountFailure(fmt.Errorf("create mountpoint: %w", err))
	}
	flags := uintptr(syscall.MS_RDONLY | syscall.MS_NODEV | syscall.MS_NOSUID)
	if err := mount(device, bundle.MountPath, string(bundle.Filesystem), flags, ""); err != nil {
		return platformMountFailure(fmt.Errorf("mount bundle %q: %w", bundle.Name, err))
	}
	for _, component := range bundle.Components {
		if err := validatePlatformComponent(bundle.MountPath, component); err != nil {
			return err
		}
	}
	return nil
}

func validatePlatformComponent(mountPath string, component guest.Manifest) error {
	if err := guest.ValidateManifest(component); err != nil {
		return guest.NewFailure(
			guest.FailurePlatformComponentNotFound,
			fmt.Sprintf("platform component %q has invalid metadata", component.Name),
			err,
		)
	}
	if !strings.HasPrefix(component.GuestPath, mountPath+string(filepath.Separator)) {
		return guest.NewFailure(
			guest.FailurePlatformComponentNotFound,
			fmt.Sprintf("platform component %q escapes the protected bundle mount", component.Name),
			nil,
		)
	}
	info, err := os.Stat(component.GuestPath)
	if err != nil {
		return guest.NewFailure(
			guest.FailurePlatformComponentNotFound,
			fmt.Sprintf("platform component %q is unavailable", component.Name),
			err,
		)
	}
	if !info.Mode().IsRegular() || info.Mode()&executableBits == 0 {
		return guest.NewFailure(
			guest.FailurePlatformComponentNotExec,
			fmt.Sprintf("platform component %q is not an executable regular file", component.Name),
			nil,
		)
	}
	return nil
}

func platformMountPathValid(path string) bool {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path || path == guest.PlatformMountPath {
		return false
	}
	relative, err := filepath.Rel(guest.PlatformMountPath, path)
	return err == nil && relative != "." && relative != ".." &&
		!strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

func platformMountFailure(cause error) error {
	return guest.NewFailure(
		guest.FailurePlatformBundleMount,
		"platform bundle could not be mounted",
		cause,
	)
}

const (
	rootfsDevice  = "/dev/vda"
	overlayDevice = "/dev/vdb"
	lowerDir      = "/lower"
	overlayDir    = "/overlay"
	newRoot       = "/overlay/newroot"

	mountReadOnly          = 1
	temporaryDirectoryMode = 0o777 | os.ModeSticky
	mountpointMode         = 0o755
	privateMountpointMode  = 0o700
	executableBits         = 0o111
	blockDeviceWaitTimeout = 5 * time.Second
	rootDeviceWaitTimeout  = 2 * time.Second

	virtioBlockDevicePrefix = "/dev/vd"
)

func mountEssentials() error {
	for _, dir := range []string{"/proc", "/sys", "/dev", "/run", "/mnt"} {
		if err := os.MkdirAll(dir, filemode.SharedDirectory); err != nil {
			return fmt.Errorf("create %s: %w", dir, err)
		}
	}
	if err := os.MkdirAll("/tmp", temporaryDirectoryMode); err != nil {
		return fmt.Errorf("create /tmp: %w", err)
	}
	if err := os.Chmod("/tmp", temporaryDirectoryMode); err != nil {
		return fmt.Errorf("set /tmp permissions: %w", err)
	}
	if err := mountOnce("proc", "/proc", "proc", ""); err != nil {
		return err
	}
	if err := mountOnce("sysfs", "/sys", "sysfs", ""); err != nil {
		return err
	}
	if err := mountOnce("devtmpfs", "/dev", "devtmpfs", "mode=0755"); err != nil {
		return err
	}
	for _, dir := range []string{"/dev/pts", "/dev/shm"} {
		if err := os.MkdirAll(dir, filemode.SharedDirectory); err != nil {
			return fmt.Errorf("create %s: %w", dir, err)
		}
	}
	if err := mountOnce("devpts", "/dev/pts", "devpts", ""); err != nil {
		return err
	}
	if err := mountOnce("tmpfs", "/dev/shm", "tmpfs", "mode=1777"); err != nil {
		return err
	}
	return nil
}

func setupRootfs() error {
	if err := waitForPath(rootfsDevice, rootDeviceWaitTimeout); err != nil {
		return fmt.Errorf("wait for rootfs disk: %w", err)
	}
	if err := waitForPath(overlayDevice, rootDeviceWaitTimeout); err != nil {
		return fmt.Errorf("wait for overlay disk: %w", err)
	}

	for _, dir := range []string{lowerDir, overlayDir} {
		if err := os.MkdirAll(dir, filemode.SharedDirectory); err != nil {
			return fmt.Errorf("create %s: %w", dir, err)
		}
	}

	if err := mount(rootfsDevice, lowerDir, "erofs", uintptr(mountReadOnly), ""); err != nil {
		return fmt.Errorf("mount rootfs: %w", err)
	}
	if err := mount(overlayDevice, overlayDir, "ext4", 0, ""); err != nil {
		return fmt.Errorf("mount overlay disk: %w", err)
	}
	for _, dir := range []string{"/overlay/upper", "/overlay/work", newRoot} {
		if err := os.MkdirAll(dir, filemode.SharedDirectory); err != nil {
			return fmt.Errorf("create %s: %w", dir, err)
		}
	}
	options := fmt.Sprintf("lowerdir=%s,upperdir=/overlay/upper,workdir=/overlay/work", lowerDir)
	if err := mount("overlay", newRoot, "overlay", 0, options); err != nil {
		return fmt.Errorf("mount merged overlay: %w", err)
	}
	return nil
}

func setupCgroups() error {
	const cgroupRoot = "/sys/fs/cgroup"
	if err := os.MkdirAll(cgroupRoot, filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create cgroup root: %w", err)
	}
	if _, err := os.Stat(filepath.Join(cgroupRoot, "cgroup.controllers")); err == nil {
		return nil
	}
	if err := mountOnce("none", cgroupRoot, "cgroup2", ""); err != nil {
		return fmt.Errorf("mount cgroup v2: %w", err)
	}
	return nil
}

func mountConfiguredVolumes(cfg *Config) error {
	for _, volume := range cfg.VolumeMounts {
		if err := mountConfiguredVolume(volume); err != nil {
			return err
		}
	}
	return nil
}

func mountConfiguredVolume(volume configdrive.VolumeMount) error {
	device := filepath.Clean(volume.Device)
	if !strings.HasPrefix(device, virtioBlockDevicePrefix) {
		return fmt.Errorf("volume device %q is not a virtio block device", volume.Device)
	}
	target, err := pathInNewRoot(volume.Path)
	if err != nil {
		return fmt.Errorf("resolve volume mount %q: %w", volume.Path, err)
	}
	if err := waitForPath(device, blockDeviceWaitTimeout); err != nil {
		return fmt.Errorf("wait for volume %s: %w", device, err)
	}
	if err := os.MkdirAll(target, mountpointMode); err != nil {
		return fmt.Errorf("create volume mountpoint %s: %w", volume.Path, err)
	}
	flags, err := volumeMountFlags(volume.Mode)
	if err != nil {
		return err
	}
	if volume.OverlayDevice != "" {
		return fmt.Errorf("overlay-backed data volumes are not supported by guest init")
	}
	if volume.Subpath == "" {
		if err := mount(device, target, "ext4", flags, ""); err != nil {
			return fmt.Errorf("mount volume %s on %s: %w", device, volume.Path, err)
		}
		return nil
	}
	return mountVolumeSubpath(volume, device, target, flags)
}

func volumeMountFlags(mode string) (uintptr, error) {
	switch mode {
	case "", "rw":
		return 0, nil
	case "ro":
		return mountReadOnly, nil
	default:
		return 0, fmt.Errorf("unsupported volume mode %q", mode)
	}
}

func mountVolumeSubpath(volume configdrive.VolumeMount, device, target string, flags uintptr) error {
	cleanSubpath := filepath.Clean(volume.Subpath)
	if filepath.IsAbs(cleanSubpath) || cleanSubpath == "." || cleanSubpath == ".." || strings.HasPrefix(cleanSubpath, ".."+string(filepath.Separator)) {
		return fmt.Errorf("volume subpath %q must be a non-empty relative path", volume.Subpath)
	}
	volumeRoot := filepath.Join(newRoot, "run", "snapflow", "volumes", filepath.Base(device))
	if err := os.MkdirAll(volumeRoot, privateMountpointMode); err != nil {
		return fmt.Errorf("create private volume mountpoint: %w", err)
	}
	if err := mount(device, volumeRoot, "ext4", flags, ""); err != nil {
		return fmt.Errorf("mount volume %s for subpath %s: %w", device, volume.Subpath, err)
	}
	source := filepath.Join(volumeRoot, cleanSubpath)
	if !strings.HasPrefix(source, volumeRoot+string(filepath.Separator)) {
		return fmt.Errorf("volume subpath %q escapes the volume root", volume.Subpath)
	}
	if volume.Mode == "ro" {
		if info, err := os.Stat(source); err != nil || !info.IsDir() {
			return fmt.Errorf("read-only volume subpath %q must already exist", volume.Subpath)
		}
	} else if err := os.MkdirAll(source, mountpointMode); err != nil {
		return fmt.Errorf("create volume subpath %q: %w", volume.Subpath, err)
	}
	if err := bindMount(source, target); err != nil {
		return fmt.Errorf("bind volume subpath %q on %s: %w", volume.Subpath, volume.Path, err)
	}
	return nil
}

func pathInNewRoot(path string) (string, error) {
	clean := filepath.Clean(path)
	if !filepath.IsAbs(clean) || clean == "/" {
		return "", fmt.Errorf("path must be an absolute non-root path")
	}
	relative := strings.TrimPrefix(clean, string(filepath.Separator))
	target := filepath.Join(newRoot, relative)
	rel, err := filepath.Rel(newRoot, target)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes guest root")
	}
	return target, nil
}

func bindHostFilesystems() error {
	for _, dir := range []string{"proc", "sys", "dev", "dev/pts", "dev/shm", "run", "tmp"} {
		if err := os.MkdirAll(filepath.Join(newRoot, dir), filemode.SharedDirectory); err != nil {
			return fmt.Errorf("create newroot %s: %w", dir, err)
		}
	}
	for _, pair := range [][2]string{
		{"/proc", filepath.Join(newRoot, "proc")},
		{"/sys", filepath.Join(newRoot, "sys")},
		{"/dev", filepath.Join(newRoot, "dev")},
		{"/dev/pts", filepath.Join(newRoot, "dev/pts")},
		{"/dev/shm", filepath.Join(newRoot, "dev/shm")},
		{"/run", filepath.Join(newRoot, "run")},
		{"/tmp", filepath.Join(newRoot, "tmp")},
	} {
		if err := bindMount(pair[0], pair[1]); err != nil {
			return fmt.Errorf("bind %s: %w", pair[0], err)
		}
	}
	for _, link := range []struct {
		target string
		path   string
	}{
		{"/proc/self/fd", filepath.Join(newRoot, "dev/fd")},
		{"/proc/self/fd/0", filepath.Join(newRoot, "dev/stdin")},
		{"/proc/self/fd/1", filepath.Join(newRoot, "dev/stdout")},
		{"/proc/self/fd/2", filepath.Join(newRoot, "dev/stderr")},
	} {
		if err := os.Remove(link.path); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("remove existing device link %s: %w", link.path, err)
		}
		if err := os.Symlink(link.target, link.path); err != nil {
			return fmt.Errorf("create device link %s: %w", link.path, err)
		}
	}
	return nil
}

func bindRootOverlayForQuiescing() error {
	target := filepath.Join(newRoot, strings.TrimPrefix(control.RootFilesystemQuiescePath, "/"))
	if err := os.MkdirAll(target, filemode.PrivateDirectory); err != nil {
		return fmt.Errorf("create root filesystem quiesce mountpoint: %w", err)
	}
	if err := bindMount(filepath.Join(overlayDir, "upper"), target); err != nil {
		return fmt.Errorf("bind root filesystem upper directory for quiescing: %w", err)
	}
	return nil
}

func mountOnce(source, target, fstype, data string) error {
	if err := mount(source, target, fstype, 0, data); err != nil && !errors.Is(err, syscall.EBUSY) {
		return err
	}
	return nil
}

func mount(source, target, fstype string, flags uintptr, data string) error {
	if err := syscall.Mount(source, target, fstype, flags, data); err != nil {
		return fmt.Errorf("mount %s on %s as %s: %w", source, target, fstype, err)
	}
	return nil
}

func bindMount(source, target string) error {
	return mount(source, target, "", syscall.MS_BIND|syscall.MS_REC, "")
}

func waitForPath(path string, timeout time.Duration) error {
	waitContext, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	if err := filewait.Exists(waitContext, path); err != nil {
		return fmt.Errorf("wait for %s: %w", path, err)
	}
	return nil
}
