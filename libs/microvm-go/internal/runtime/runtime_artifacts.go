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
	"errors"
	"fmt"
	"os"

	"github.com/snapflowio/microvm-go/internal/state"
)

func (b *Backend) removeInstanceStateDirectories(instanceID string) error {
	err := os.RemoveAll(b.paths.InstanceDir(instanceID))
	b.refreshInstanceAllocation(instanceID)
	b.requestSupportDiskSample()
	return err
}

func (b *Backend) cleanupExitedRuntimeArtifacts(ctx context.Context, metadata state.InstanceMetadata) error {
	cleanupErrors := []error{
		wrapOptionalError(
			"remove stale VMM PID record",
			removeStaleRuntimeArtifact(b.paths.InstancePID(metadata.ID)),
		),
		wrapOptionalError(
			"remove stale VMM API socket",
			removeVerifiedStaleSocket(ctx, metadata.SocketPath),
		),
		wrapOptionalError(
			"remove stale VMM vsock socket",
			removeVerifiedStaleSocket(ctx, metadata.VsockSocket),
		),
		wrapOptionalError("release stale VMM resources", b.releaseVMMResources(metadata)),
	}
	if err := errors.Join(cleanupErrors...); err != nil {
		return fmt.Errorf("clean exited runtime artifacts for %s: %w", metadata.ID, err)
	}
	return nil
}
