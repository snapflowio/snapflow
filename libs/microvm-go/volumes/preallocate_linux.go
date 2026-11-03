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

package volumes

import (
	"errors"
	"fmt"
	"os"

	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
	"golang.org/x/sys/unix"
)

const (
	xfsSuperMagic   = 0x58465342
	btrfsSuperMagic = 0x9123683e
)

// preallocate reserves every block of a volume image on filesystems that cannot
// share blocks through reflink, so a full host disk never surfaces as a guest
// I/O error mid-write. Copy-on-write filesystems keep images sparse so clones
// stay cheap; disk admission reserves their full size instead.
func preallocate(path string, sizeBytes int64) (returnErr error) {
	var filesystem unix.Statfs_t
	if err := unix.Statfs(path, &filesystem); err != nil {
		return fmt.Errorf("inspect volume filesystem: %w", err)
	}
	if filesystem.Type == xfsSuperMagic || filesystem.Type == btrfsSuperMagic {
		return nil
	}
	file, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		return fmt.Errorf("open volume image for preallocation: %w", err)
	}
	defer func() {
		returnErr = errors.Join(returnErr, resourcecleanup.Close(file, "preallocated volume image"))
	}()
	if err := unix.Fallocate(int(file.Fd()), 0, 0, sizeBytes); err != nil {
		return fmt.Errorf("preallocate volume image: %w", err)
	}
	return nil
}
