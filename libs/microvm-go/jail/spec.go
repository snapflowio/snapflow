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

package jail

import (
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"strings"
)

var (
	ErrInvalidSpec  = errors.New("invalid jail spec")
	ErrRootIdentity = errors.New("jailed processes never run as root")
	ErrUnsupported  = errors.New("jailed VMMs require Linux")
)

type Spec struct {
	ID                string   `json:"id"`
	Root              string   `json:"root"`
	UID               uint32   `json:"uid"`
	GID               uint32   `json:"gid"`
	Executable        string   `json:"executable"`
	Arguments         []string `json:"arguments"`
	ReadOnly          []string `json:"readOnly"`
	Writable          []string `json:"writable"`
	Devices           []string `json:"devices"`
	Sysfs             bool     `json:"sysfs"`
	NetworkNamespace  string   `json:"networkNamespace"`
	OpenFiles         uint64   `json:"openFiles"`
	LockedMemoryBytes uint64   `json:"lockedMemoryBytes"`
}

type Limits struct {
	CPUs                    int
	CPUWeight               uint64
	MemoryBytes             uint64
	MemoryThrottleBytes     uint64
	Tasks                   uint64
	DiskPath                string
	DiskBytesPerSecond      uint64
	DiskOperationsPerSecond uint64
}

func (spec Spec) Validate() error {
	if strings.TrimSpace(spec.ID) == "" {
		return fmt.Errorf("%w: id is required", ErrInvalidSpec)
	}
	if spec.UID == 0 || spec.GID == 0 {
		return ErrRootIdentity
	}
	paths := slices.Concat([]string{spec.Root, spec.Executable}, spec.ReadOnly, spec.Writable, spec.Devices)
	if spec.NetworkNamespace != "" {
		paths = append(paths, spec.NetworkNamespace)
	}
	for _, path := range paths {
		if !filepath.IsAbs(path) || filepath.Clean(path) != path {
			return fmt.Errorf("%w: %q must be an absolute clean path", ErrInvalidSpec, path)
		}
	}
	if spec.OpenFiles == 0 {
		return fmt.Errorf("%w: an open file limit is required", ErrInvalidSpec)
	}
	return nil
}

func (spec Spec) mounts() []bindMount {
	binds := make([]bindMount, 0, len(spec.Writable)+len(spec.ReadOnly)+1)
	for _, path := range spec.Writable {
		binds = append(binds, bindMount{path: path, writable: true})
	}
	for _, path := range slices.Concat(spec.ReadOnly, []string{spec.Executable}) {
		binds = append(binds, bindMount{path: path})
	}
	slices.SortStableFunc(binds, func(left, right bindMount) int { return strings.Compare(left.path, right.path) })
	result := make([]bindMount, 0, len(binds))
	for _, bind := range binds {
		if slices.ContainsFunc(result, func(existing bindMount) bool { return existing.covers(bind) }) {
			continue
		}
		result = append(result, bind)
	}
	return result
}

type bindMount struct {
	path     string
	writable bool
}

func (bind bindMount) covers(other bindMount) bool {
	within := other.path == bind.path || strings.HasPrefix(other.path, bind.path+string(filepath.Separator))
	return within && (bind.writable || !other.writable)
}
