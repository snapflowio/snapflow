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

package snapshot

import (
	"archive/tar"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/google/go-containerregistry/pkg/compression"
	v1 "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/empty"
	"github.com/google/go-containerregistry/pkg/v1/mutate"
	"github.com/google/go-containerregistry/pkg/v1/tarball"
	"github.com/google/go-containerregistry/pkg/v1/types"
	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
	"github.com/snapflowio/microvm-go/internal/state"
	"golang.org/x/sys/unix"
)

const (
	paxXattrPrefix           = "SCHILY.xattr."
	backupMountDirectoryMode = 0o755
	backupUnmountTimeout     = 30 * time.Second
)

func ExportStoppedImage(ctx context.Context, metadata state.InstanceMetadata, record imagecache.ImageRecord, workDir string) (imageResult imagecache.Image, returnErr error) {
	if metadata.RootfsDisk == "" || metadata.OverlayDisk == "" {
		return nil, fmt.Errorf("instance disks are not available for backup export")
	}
	mounts := &backupMounts{}
	defer func() {
		returnErr = errors.Join(returnErr, mounts.unmount(ctx))
	}()
	mergedMount, err := mounts.mountMerged(ctx, metadata, workDir)
	if err != nil {
		return nil, err
	}
	tarPath := filepath.Join(workDir, "rootfs.tar")
	if err := writeRootfsTar(mergedMount, tarPath); err != nil {
		return nil, err
	}
	return backupImage(tarPath, metadata, record)
}

type backupMounts struct {
	paths []string
}

func (mounts *backupMounts) mountMerged(ctx context.Context, metadata state.InstanceMetadata, workDir string) (string, error) {
	rootfsMount := filepath.Join(workDir, "rootfs")
	overlayMount := filepath.Join(workDir, "overlay")
	mergedMount := filepath.Join(workDir, "merged")
	for _, dir := range []string{rootfsMount, overlayMount, mergedMount} {
		if err := os.MkdirAll(dir, backupMountDirectoryMode); err != nil {
			return "", fmt.Errorf("create backup mount directory: %w", err)
		}
	}
	if err := mountRootfs(ctx, metadata.RootfsDisk, rootfsMount); err != nil {
		return "", err
	}
	mounts.paths = append(mounts.paths, rootfsMount)
	if err := mountLoop(ctx, metadata.OverlayDisk, overlayMount, "ext4", "rw"); err != nil {
		return "", err
	}
	mounts.paths = append(mounts.paths, overlayMount)
	options := fmt.Sprintf(
		"ro,lowerdir=%s,upperdir=%s,workdir=%s",
		rootfsMount,
		filepath.Join(overlayMount, "upper"),
		filepath.Join(overlayMount, "work"),
	)
	if err := run(ctx, "mount", "-t", "overlay", "overlay", "-o", options, mergedMount); err != nil {
		return "", fmt.Errorf("mount merged backup overlay: %w", err)
	}
	mounts.paths = append(mounts.paths, mergedMount)
	return mergedMount, nil
}

func (mounts *backupMounts) unmount(ctx context.Context) error {
	var unmountErrors error
	for i := len(mounts.paths) - 1; i >= 0; i-- {
		cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), backupUnmountTimeout)
		unmountErr := exec.CommandContext(cleanupCtx, "umount", mounts.paths[i]).Run()
		cancel()
		if unmountErr != nil {
			unmountErrors = errors.Join(
				unmountErrors,
				fmt.Errorf("unmount backup path %s: %w", mounts.paths[i], unmountErr),
			)
		}
	}
	return unmountErrors
}

func backupImage(tarPath string, metadata state.InstanceMetadata, record imagecache.ImageRecord) (imagecache.Image, error) {
	layer, err := tarball.LayerFromFile(tarPath, tarball.WithCompression(compression.ZStd), tarball.WithMediaType(types.OCILayerZStd))
	if err != nil {
		return nil, fmt.Errorf("create backup layer: %w", err)
	}
	base := mutate.ConfigMediaType(mutate.MediaType(empty.Image, types.OCIManifestSchema1), types.OCIConfigJSON)
	img, err := mutate.AppendLayers(base, layer)
	if err != nil {
		return nil, fmt.Errorf("create backup image: %w", err)
	}
	config, err := img.ConfigFile()
	if err != nil {
		return nil, fmt.Errorf("read backup image config: %w", err)
	}
	platform, err := imagecache.ParsePlatform(record.Platform)
	if err != nil {
		return nil, err
	}
	config.OS = platform.OS
	config.Architecture = platform.Architecture
	config.Variant = platform.Variant
	entrypoint := record.Entrypoint
	if len(metadata.Entrypoint) > 0 {
		entrypoint = metadata.Entrypoint
	}
	config.Config = v1.Config{
		Entrypoint: append([]string(nil), entrypoint...),
		Cmd:        append([]string(nil), record.Cmd...),
		Env:        envMapToSlice(mergeMaps(record.Env, metadata.Env)),
		Labels:     cloneMap(record.Labels),
		WorkingDir: record.WorkingDir,
	}
	img, err = mutate.ConfigFile(img, config)
	if err != nil {
		return nil, fmt.Errorf("write backup image config: %w", err)
	}
	return img, nil
}

func mountRootfs(ctx context.Context, diskPath, target string) error {
	return mountLoop(ctx, diskPath, target, string(guest.FilesystemEROFS), "ro")
}

func mountLoop(ctx context.Context, diskPath, target, fstype, mode string) error {
	return run(ctx, "mount", "-o", "loop,"+mode, "-t", fstype, diskPath, target)
}

func run(ctx context.Context, name string, args ...string) error {
	output, err := exec.CommandContext(ctx, name, args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s %s: %w: %s", name, strings.Join(args, " "), err, string(output))
	}
	return nil
}

func writeRootfsTar(root, tarPath string) (returnErr error) {
	file, err := os.Create(tarPath)
	if err != nil {
		return fmt.Errorf("create backup tar: %w", err)
	}
	writer := tar.NewWriter(file)
	writerClosed := false
	fileClosed := false
	defer func() {
		if !writerClosed {
			returnErr = errors.Join(
				returnErr,
				resourcecleanup.Close(writer, "backup tar writer"),
			)
		}
		if !fileClosed {
			returnErr = errors.Join(
				returnErr,
				resourcecleanup.Close(file, "backup tar file"),
			)
		}
	}()

	walkErr := filepath.Walk(root, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return fmt.Errorf("compute backup relative path: %w", err)
		}
		if rel == "." || info.Mode()&os.ModeSocket != 0 {
			return nil
		}
		return writeRootfsEntry(writer, path, rel, info)
	})

	if walkErr != nil {
		return walkErr
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("finalize backup tar: %w", err)
	}
	writerClosed = true
	if err := file.Close(); err != nil {
		return fmt.Errorf("close backup tar: %w", err)
	}
	fileClosed = true
	return nil
}

func writeRootfsEntry(writer *tar.Writer, path, rel string, info os.FileInfo) error {
	header, err := rootfsEntryHeader(path, rel, info)
	if err != nil {
		return err
	}
	if err := writer.WriteHeader(header); err != nil {
		return fmt.Errorf("write tar header %s: %w", path, err)
	}
	if !info.Mode().IsRegular() {
		return nil
	}
	source, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open backup file %s: %w", path, err)
	}
	if _, err := io.Copy(writer, source); err != nil {
		return errors.Join(fmt.Errorf("write backup file %s: %w", path, err), source.Close())
	}
	if err := source.Close(); err != nil {
		return fmt.Errorf("close backup file %s: %w", path, err)
	}
	return nil
}

func rootfsEntryHeader(path, rel string, info os.FileInfo) (*tar.Header, error) {
	var link string
	if info.Mode()&os.ModeSymlink != 0 {
		target, err := os.Readlink(path)
		if err != nil {
			return nil, fmt.Errorf("read backup symlink %s: %w", path, err)
		}
		link = target
	}
	header, err := tar.FileInfoHeader(info, link)
	if err != nil {
		return nil, fmt.Errorf("create tar header %s: %w", path, err)
	}
	header.Name = filepath.ToSlash(rel)
	xattrs, err := readExtendedAttributes(path)
	if err != nil {
		return nil, fmt.Errorf("read extended attributes for %s: %w", path, err)
	}
	if len(xattrs) > 0 {
		header.Format = tar.FormatPAX
		header.PAXRecords = make(map[string]string, len(xattrs))
		for name, value := range xattrs {
			header.PAXRecords[paxXattrPrefix+name] = string(value)
		}
	}
	return header, nil
}

func readExtendedAttributes(path string) (map[string][]byte, error) {
	bufferSize, err := unix.Llistxattr(path, nil)
	if errors.Is(err, unix.ENOTSUP) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if bufferSize == 0 {
		return nil, nil
	}
	namesBuffer := make([]byte, bufferSize)
	readSize, err := unix.Llistxattr(path, namesBuffer)
	if err != nil {
		return nil, err
	}
	attributes := make(map[string][]byte)
	for _, name := range strings.Split(string(namesBuffer[:readSize]), "\x00") {
		if name == "" {
			continue
		}
		valueSize, err := unix.Lgetxattr(path, name, nil)
		if err != nil {
			return nil, fmt.Errorf("size attribute %s: %w", name, err)
		}
		value := make([]byte, valueSize)
		if valueSize > 0 {
			actualSize, err := unix.Lgetxattr(path, name, value)
			if err != nil {
				return nil, fmt.Errorf("read attribute %s: %w", name, err)
			}
			value = value[:actualSize]
		}
		attributes[name] = value
	}
	return attributes, nil
}

func envMapToSlice(values map[string]string) []string {
	if len(values) == 0 {
		return nil
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	out := make([]string, 0, len(values))
	for _, key := range keys {
		value := values[key]
		out = append(out, key+"="+value)
	}
	return out
}

func mergeMaps(base, overrides map[string]string) map[string]string {
	merged := cloneMap(base)
	if merged == nil && len(overrides) > 0 {
		merged = make(map[string]string, len(overrides))
	}
	for key, value := range overrides {
		merged[key] = value
	}
	return merged
}

func cloneMap(values map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}
	out := make(map[string]string, len(values))
	for key, value := range values {
		out[key] = value
	}
	return out
}
