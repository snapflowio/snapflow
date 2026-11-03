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
	"context"
	"fmt"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/state"
)

func (b *Backend) prepareForkSnapshot(ctx context.Context, source state.InstanceMetadata, target *state.InstanceMetadata) (bool, error) {
	if target == nil {
		return false, fmt.Errorf("fork target metadata is required")
	}
	snapshotPath := b.paths.InstanceLatestSnapshot(target.ID)
	targetSpec, err := b.buildSpec(ctx, *target)
	if err != nil {
		return false, err
	}
	sourceDir := b.paths.InstanceDir(source.ID)
	targetDir := b.paths.InstanceDir(target.ID)
	request := hypervisor.ForkPrepareRequest{
		SnapshotPath:  snapshotPath,
		SourceDataDir: sourceDir,
		TargetDataDir: targetDir,
		Target:        targetSpec,
	}
	backend, err := b.hypervisorBackend(target.Hypervisor)
	if err != nil {
		return false, err
	}
	result, err := backend.PrepareFork(ctx, request)
	if err != nil {
		return false, err
	}
	return result.Prepared, nil
}
