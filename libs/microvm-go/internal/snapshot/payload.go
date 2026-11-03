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

package snapshot

import (
	"fmt"
	"path/filepath"

	"github.com/snapflowio/microvm-go/internal/forkvm"
)

const vmPayloadDirectory = "vm"

func (s Store) MaterializeVMPayload(id, targetDir string) error {
	if err := forkvm.CopyDir(filepath.Join(s.paths.SnapshotPayloadDir(id), vmPayloadDirectory), targetDir); err != nil {
		return fmt.Errorf("copy VM snapshot payload: %w", err)
	}
	return nil
}
