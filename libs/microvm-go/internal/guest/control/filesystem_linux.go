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

package control

import (
	"errors"
	"fmt"
	"os"

	"golang.org/x/sys/unix"
)

const (
	freezeFilesystemRequest uint = 0xC0045877
	thawFilesystemRequest   uint = 0xC0045878
	guestRootPath                = "/"
)

type filesystemQuiescer interface {
	Freeze() error
	Thaw() error
}

type noOpFilesystemQuiescer struct{}

func (noOpFilesystemQuiescer) Freeze() error { return nil }
func (noOpFilesystemQuiescer) Thaw() error   { return nil }

type pathFilesystemQuiescer struct {
	path string
	// separateFromRoot refuses to freeze a path that resolves to the guest
	// root filesystem, so a volume that failed to mount never freezes the
	// whole guest.
	separateFromRoot bool
	file             *os.File
}

func newRootFilesystemQuiescer() filesystemQuiescer {
	return &pathFilesystemQuiescer{path: RootFilesystemQuiescePath}
}

func newVolumeFilesystemQuiescer(path string) filesystemQuiescer {
	return &pathFilesystemQuiescer{path: path, separateFromRoot: true}
}

func (quiescer *pathFilesystemQuiescer) Freeze() error {
	if quiescer.file != nil {
		return nil
	}
	file, err := os.Open(quiescer.path)
	if err != nil {
		return fmt.Errorf("open filesystem %s: %w", quiescer.path, err)
	}
	if quiescer.separateFromRoot {
		if err := requireSeparateFilesystem(file); err != nil {
			return errors.Join(err, file.Close())
		}
	}
	if err := unix.IoctlSetPointerInt(int(file.Fd()), freezeFilesystemRequest, 0); err != nil {
		var filesystem unix.Statfs_t
		statErr := unix.Fstatfs(int(file.Fd()), &filesystem)
		return errors.Join(
			fmt.Errorf("issue FIFREEZE on %s filesystem type %#x: %w", quiescer.path, filesystem.Type, err),
			statErr,
			file.Close(),
		)
	}
	quiescer.file = file
	return nil
}

func (quiescer *pathFilesystemQuiescer) Thaw() error {
	if quiescer.file == nil {
		return nil
	}
	file := quiescer.file
	if err := unix.IoctlSetPointerInt(int(file.Fd()), thawFilesystemRequest, 0); err != nil {
		return fmt.Errorf("issue FITHAW on %s: %w", quiescer.path, err)
	}
	quiescer.file = nil
	if err := file.Close(); err != nil {
		return fmt.Errorf("close filesystem %s after thaw: %w", quiescer.path, err)
	}
	return nil
}

func requireSeparateFilesystem(file *os.File) error {
	var target, root unix.Stat_t
	if err := unix.Fstat(int(file.Fd()), &target); err != nil {
		return fmt.Errorf("stat filesystem %s: %w", file.Name(), err)
	}
	if err := unix.Stat(guestRootPath, &root); err != nil {
		return fmt.Errorf("stat guest root filesystem: %w", err)
	}
	if target.Dev == root.Dev {
		return fmt.Errorf("%s is not a separately mounted filesystem", file.Name())
	}
	return nil
}
