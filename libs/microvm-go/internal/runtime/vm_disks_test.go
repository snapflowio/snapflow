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

package runtime

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

func diskMetadata(t *testing.T, directIO bool) state.InstanceMetadata {
	t.Helper()
	dir := t.TempDir()
	paths := make([]string, 0, 4)
	for _, name := range []string{"rootfs.erofs", "overlay.raw", "config.img", "volume.raw"} {
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, nil, 0o600); err != nil {
			t.Fatal(err)
		}
		paths = append(paths, path)
	}
	return state.InstanceMetadata{
		RootfsDisk: paths[0], OverlayDisk: paths[1], ConfigDisk: paths[2],
		AdditionalDisks: []hypervisor.Disk{{Path: paths[3]}},
		RawRequest:      types.CreateRequest{DirectIO: directIO},
	}
}

func TestInstanceDisksOpenOnlyTheOverlayDirectForDirectIO(t *testing.T) {
	metadata := diskMetadata(t, true)
	disks, err := instanceDisks(metadata)
	if err != nil {
		t.Fatal(err)
	}
	for _, disk := range disks {
		if disk.Direct != (disk.Path == metadata.OverlayDisk) {
			t.Fatalf("disk %s direct = %t, want direct only on the overlay", disk.Path, disk.Direct)
		}
	}
}

func TestInstanceDisksStayBufferedWithoutDirectIO(t *testing.T) {
	disks, err := instanceDisks(diskMetadata(t, false))
	if err != nil {
		t.Fatal(err)
	}
	for _, disk := range disks {
		if disk.Direct {
			t.Fatalf("disk %s is direct without the direct-io capability", disk.Path)
		}
	}
}
