// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the license at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

//go:build linux

package jail

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"syscall"

	"golang.org/x/sys/unix"
)

const (
	specFileDescriptor  = 3
	initFailureExitCode = 125
	jailDirMode         = 0o755
	deviceNodeMode      = 0o600
	placeholderFileMode = 0o600
	oldRootName         = ".old-root"
	procMount           = "/proc"
	sysMount            = "/sys"
	devMount            = "/dev"
	tmpfsOptions        = "mode=0755,size=1m"
	bindFlags           = unix.MS_BIND | unix.MS_REC
	hardenedFlags       = unix.MS_NOSUID | unix.MS_NODEV
	procFlags           = unix.MS_NOSUID | unix.MS_NODEV | unix.MS_NOEXEC
)

// Init runs the jail when this process was started by Command, and returns
// immediately otherwise. Call it first in main of every binary that starts
// jailed VMMs. On success it never returns: the process becomes the VMM.
func Init() {
	if len(os.Args) == 0 || os.Args[0] != initArgument {
		return
	}
	// Mount, privilege and no_new_privs changes must happen on the thread that
	// executes the VMM.
	runtime.LockOSThread()
	fmt.Fprintf(os.Stderr, "snapflow jail: %v\n", run())
	os.Exit(initFailureExitCode)
}

// run enters the jail and executes the VMM. It returns only when that failed:
// a successful exec replaces this process.
func run() error {
	spec, err := readSpec()
	if err != nil {
		return err
	}
	if err := spec.Validate(); err != nil {
		return err
	}
	if err := buildRoot(spec); err != nil {
		return err
	}
	if err := enterRoot(spec.Root); err != nil {
		return err
	}
	if err := applyLimits(spec); err != nil {
		return err
	}
	if err := dropPrivileges(spec); err != nil {
		return err
	}
	arguments := append([]string{spec.Executable}, spec.Arguments...)
	return fmt.Errorf("execute %s: %w", spec.Executable, unix.Exec(spec.Executable, arguments, []string{}))
}

func readSpec() (Spec, error) {
	file := os.NewFile(specFileDescriptor, "jail-spec")
	defer file.Close()
	var spec Spec
	if err := json.NewDecoder(file).Decode(&spec); err != nil {
		return Spec{}, fmt.Errorf("read jail spec: %w", err)
	}
	return spec, nil
}

func buildRoot(spec Spec) error {
	if err := unix.Mount("", "/", "", unix.MS_REC|unix.MS_PRIVATE, ""); err != nil {
		return fmt.Errorf("make mounts private: %w", err)
	}
	if err := unix.Mount("tmpfs", spec.Root, "tmpfs", unix.MS_NOSUID, tmpfsOptions); err != nil {
		return fmt.Errorf("mount jail root: %w", err)
	}
	for _, bind := range spec.mounts() {
		if err := bindPath(spec.Root, bind); err != nil {
			return err
		}
	}
	if err := createDevices(spec); err != nil {
		return err
	}
	if spec.Sysfs {
		target := filepath.Join(spec.Root, sysMount)
		if err := os.MkdirAll(target, jailDirMode); err != nil {
			return fmt.Errorf("create jail /sys: %w", err)
		}
		if err := unix.Mount("sysfs", target, "sysfs", procFlags|unix.MS_RDONLY, ""); err != nil {
			return fmt.Errorf("mount jail /sys: %w", err)
		}
	}
	target := filepath.Join(spec.Root, procMount)
	if err := os.MkdirAll(target, jailDirMode); err != nil {
		return fmt.Errorf("create jail /proc: %w", err)
	}
	if err := unix.Mount("proc", target, "proc", procFlags, ""); err != nil {
		return fmt.Errorf("mount jail /proc: %w", err)
	}
	return nil
}

func bindPath(root string, bind bindMount) error {
	info, err := os.Stat(bind.path)
	if err != nil {
		return fmt.Errorf("inspect jail bind %s: %w", bind.path, err)
	}
	target := filepath.Join(root, bind.path)
	if err := createMountPoint(target, info.IsDir()); err != nil {
		return err
	}
	if err := unix.Mount(bind.path, target, "", bindFlags, ""); err != nil {
		return fmt.Errorf("bind %s into the jail: %w", bind.path, err)
	}
	flags := uintptr(unix.MS_BIND | unix.MS_REMOUNT | hardenedFlags)
	if !bind.writable {
		flags |= unix.MS_RDONLY
	}
	if err := unix.Mount("", target, "", flags, ""); err != nil {
		return fmt.Errorf("restrict jail bind %s: %w", bind.path, err)
	}
	return nil
}

func createMountPoint(target string, directory bool) error {
	if directory {
		if err := os.MkdirAll(target, jailDirMode); err != nil {
			return fmt.Errorf("create jail directory %s: %w", target, err)
		}
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(target), jailDirMode); err != nil {
		return fmt.Errorf("create jail directory for %s: %w", target, err)
	}
	file, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY, placeholderFileMode)
	if err != nil {
		return fmt.Errorf("create jail mount point %s: %w", target, err)
	}
	return file.Close()
}

func createDevices(spec Spec) error {
	if err := os.MkdirAll(filepath.Join(spec.Root, devMount), jailDirMode); err != nil {
		return fmt.Errorf("create jail /dev: %w", err)
	}
	for _, path := range spec.Devices {
		info, err := os.Stat(path)
		if err != nil {
			return fmt.Errorf("inspect device %s: %w", path, err)
		}
		stat, ok := info.Sys().(*syscall.Stat_t)
		if !ok || info.Mode()&fs.ModeCharDevice == 0 {
			return fmt.Errorf("%w: %s is not a character device", ErrInvalidSpec, path)
		}
		target := filepath.Join(spec.Root, path)
		if err := os.MkdirAll(filepath.Dir(target), jailDirMode); err != nil {
			return fmt.Errorf("create jail directory for %s: %w", path, err)
		}
		if err := unix.Mknod(target, unix.S_IFCHR|deviceNodeMode, int(stat.Rdev)); err != nil {
			return fmt.Errorf("create jail device %s: %w", path, err)
		}
		if err := os.Chown(target, int(spec.UID), int(spec.GID)); err != nil {
			return fmt.Errorf("give jailed VMM device %s: %w", path, err)
		}
	}
	return nil
}

// enterRoot pivots into the jail root, detaches the host tree and makes the
// tmpfs read-only; writable binds stay writable as separate mounts.
func enterRoot(root string) error {
	oldRoot := filepath.Join(root, oldRootName)
	if err := os.Mkdir(oldRoot, rootDirMode); err != nil {
		return fmt.Errorf("create old root mount point: %w", err)
	}
	if err := unix.PivotRoot(root, oldRoot); err != nil {
		return fmt.Errorf("pivot into the jail root: %w", err)
	}
	if err := unix.Chdir("/"); err != nil {
		return fmt.Errorf("enter the jail root: %w", err)
	}
	detached := string(filepath.Separator) + oldRootName
	if err := unix.Unmount(detached, unix.MNT_DETACH); err != nil {
		return fmt.Errorf("detach the host root: %w", err)
	}
	if err := os.Remove(detached); err != nil {
		return fmt.Errorf("remove old root mount point: %w", err)
	}
	if err := unix.Mount("", "/", "", unix.MS_REMOUNT|unix.MS_RDONLY|unix.MS_NOSUID, ""); err != nil {
		return fmt.Errorf("make the jail root read-only: %w", err)
	}
	return nil
}

func applyLimits(spec Spec) error {
	limits := map[int]uint64{unix.RLIMIT_NOFILE: spec.OpenFiles}
	if spec.LockedMemoryBytes > 0 {
		limits[unix.RLIMIT_MEMLOCK] = spec.LockedMemoryBytes
	}
	for resource, value := range limits {
		if err := unix.Setrlimit(resource, &unix.Rlimit{Cur: value, Max: value}); err != nil {
			return fmt.Errorf("set resource limit %d: %w", resource, err)
		}
	}
	return nil
}

// dropPrivileges empties the capability bounding set and sets no_new_privs on
// this thread, then switches every thread to the jail identity, which clears
// the remaining capabilities.
func dropPrivileges(spec Spec) error {
	for capability := 0; capability <= unix.CAP_LAST_CAP; capability++ {
		if err := unix.Prctl(unix.PR_CAPBSET_DROP, uintptr(capability), 0, 0, 0); err != nil && !errors.Is(err, unix.EINVAL) {
			return fmt.Errorf("drop capability %d: %w", capability, err)
		}
	}
	if err := unix.Prctl(unix.PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0); err != nil {
		return fmt.Errorf("set no_new_privs: %w", err)
	}
	if err := syscall.Setgroups([]int{}); err != nil {
		return fmt.Errorf("clear supplementary groups: %w", err)
	}
	if err := syscall.Setresgid(int(spec.GID), int(spec.GID), int(spec.GID)); err != nil {
		return fmt.Errorf("switch to the jail group: %w", err)
	}
	if err := syscall.Setresuid(int(spec.UID), int(spec.UID), int(spec.UID)); err != nil {
		return fmt.Errorf("switch to the jail user: %w", err)
	}
	return nil
}
