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
	"time"

	"github.com/snapflowio/microvm-go/internal/guestcontrol"
	"github.com/snapflowio/microvm-go/internal/state"
)

const guestVolumeThawTimeout = 30 * time.Second

// freezeGuestVolumes freezes the writable volume filesystems the backup
// covers and returns the thaw, which must run on every path. The thaw outlives
// cancellation of ctx so an aborted backup still releases the guest.
func (b *Backend) freezeGuestVolumes(ctx context.Context, metadata state.InstanceMetadata, work []volumeBackupWork) (func() error, error) {
	mountPaths := writableVolumeMountPaths(metadata, work)
	if len(mountPaths) == 0 {
		return func() error { return nil }, nil
	}
	client, err := guestcontrol.NewClient(metadata.VsockSocket, metadata.ControlAuthToken)
	if err != nil {
		return nil, err
	}
	thaw := func() error {
		defer client.Close()
		thawCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), guestVolumeThawTimeout)
		defer cancel()
		return client.ThawVolumes(thawCtx)
	}
	if err := client.FreezeVolumes(ctx, mountPaths); err != nil {
		// The guest may have frozen some volumes before the request failed.
		return nil, errors.Join(
			fmt.Errorf("freeze guest volumes for backup: %w", err),
			wrapOptionalError("thaw guest volumes after failed freeze", thaw()),
		)
	}
	return thaw, nil
}

// writableVolumeMountPaths skips read-only attachments, which the guest
// cannot write and so never needs to quiesce.
func writableVolumeMountPaths(metadata state.InstanceMetadata, work []volumeBackupWork) []string {
	selected := make(map[string]struct{}, len(work))
	for _, item := range work {
		selected[item.volumeID] = struct{}{}
	}
	var mountPaths []string
	for _, attachment := range metadata.VolumeAttachments {
		if _, backedUp := selected[attachment.VolumeID]; backedUp && !attachment.ReadOnly {
			mountPaths = append(mountPaths, attachment.MountPath)
		}
	}
	return mountPaths
}
