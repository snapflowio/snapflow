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
	"slices"
	"testing"
)

func validSpec() Spec {
	return Spec{
		ID: "vm", Root: "/var/lib/snapflow/jails/vm", UID: 1 << 30, GID: 1 << 30,
		Executable: "/opt/snapflow/current/bin/cloud-hypervisor",
		ReadOnly:   []string{"/var/lib/snapflow/images/a/rootfs.erofs", "/var/lib/snapflow/instances/vm/snapshots/latest"},
		Writable:   []string{"/var/lib/snapflow/instances/vm/snapshots", "/var/lib/snapflow/instances/vm/vmm"},
		Devices:    []string{"/dev/kvm"},
		OpenFiles:  4096,
	}
}

func TestSpecRejectsRootIdentityAndRelativePaths(t *testing.T) {
	spec := validSpec()
	spec.UID = 0
	if err := spec.Validate(); !errors.Is(err, ErrRootIdentity) {
		t.Fatalf("root uid error = %v, want %v", err, ErrRootIdentity)
	}
	spec = validSpec()
	spec.ReadOnly = append(spec.ReadOnly, "relative/disk.raw")
	if err := spec.Validate(); !errors.Is(err, ErrInvalidSpec) {
		t.Fatalf("relative path error = %v, want %v", err, ErrInvalidSpec)
	}
	if err := validSpec().Validate(); err != nil {
		t.Fatalf("valid spec rejected: %v", err)
	}
}

func TestMountsDropPathsAWritableParentAlreadyExposes(t *testing.T) {
	var paths []string
	for _, bind := range validSpec().mounts() {
		paths = append(paths, bind.path)
	}
	want := []string{
		"/opt/snapflow/current/bin/cloud-hypervisor",
		"/var/lib/snapflow/images/a/rootfs.erofs",
		"/var/lib/snapflow/instances/vm/snapshots",
		"/var/lib/snapflow/instances/vm/vmm",
	}
	if !slices.Equal(paths, want) {
		t.Fatalf("mounts = %v, want %v", paths, want)
	}
}
