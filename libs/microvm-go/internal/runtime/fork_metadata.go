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
	"fmt"
	"time"

	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/vsock"
	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/microvm-go/restartpolicy"
	"github.com/snapflowio/microvm-go/types"
)

func newForkMetadata(source state.InstanceMetadata, request types.ForkRequest) (state.InstanceMetadata, error) {
	forked := source
	forked.ID = request.ID
	forked.Identity.InstanceID = request.ID
	forked.Identity.AssignmentGeneration = request.AssignmentGeneration
	forked.RawRequest.ID = request.ID
	forked.RawRequest.Identity.InstanceID = request.ID
	forked.RawRequest.Identity.AssignmentGeneration = request.AssignmentGeneration
	intentDigest, err := types.CreateRequestIntentDigest(forked.RawRequest)
	if err != nil {
		return state.InstanceMetadata{}, fmt.Errorf("derive fork runtime intent: %w", err)
	}
	forked.Identity.IntentDigest = intentDigest
	forked.RawRequest.Identity.IntentDigest = intentDigest
	forked.ForkSourceInstanceID = source.ID
	forked.RootfsDisk = source.RootfsDisk
	forked.OverlayDisk = ""
	forked.ConfigDisk = ""
	forked.SocketPath = ""
	forked.VsockCID = vsock.GuestCID
	forked.VsockSocket = ""
	forked.PID = 0
	forked.PCIDevices = nil
	forked.GPUAssignments = nil
	forked.NetworkMeter = state.NetworkMeter{}
	forked.UsageSequence = 0
	forked.RunningMeter = state.RunningMeter{}
	now := time.Now().UTC()
	forked.CreatedAt = now
	forked.UpdatedAt = now
	forked.StartedAt = nil
	forked.StoppedAt = &now
	forked.State = types.RuntimeStateStopped
	forked.SnapshotIdentityQuiesced = false
	forked.RestoreIdentityPending = false
	forked.SnapshotControlAuthToken = ""
	forked.RestoreControlAuthToken = ""
	forked.HealthCheckRuntime = nil
	if request.Start || forked.RestartPolicy == nil {
		forked.RestartStatus = restartpolicy.Status{}
	} else {
		forked.RestartStatus = restartpolicy.ManualStopStatus()
	}
	forked.ExitCode = nil
	forked.ExitMessage = ""
	return forked, nil
}

func (b *Backend) instanceImageRecord(source state.InstanceMetadata) (imagecache.ImageRecord, error) {
	reference := source.ResolvedImage
	if reference == "" {
		reference = source.Image
	}
	record, err := b.images.ReadReference(reference)
	if err != nil {
		return imagecache.ImageRecord{}, fmt.Errorf("read instance image metadata: %w", err)
	}
	return record, nil
}

func instanceHasNetwork(metadata state.InstanceMetadata) bool {
	return metadata.Network != nil
}

func instanceNetworkEnabled(metadata state.InstanceMetadata) bool {
	return metadata.NetworkEnabled || instanceHasNetwork(metadata)
}

func applyNetworkAllocation(metadata *state.InstanceMetadata, allocation *network.Allocation) {
	metadata.NetworkEnabled = allocation != nil
	metadata.Network = allocation
}

func clearNetworkIdentity(metadata *state.InstanceMetadata) {
	metadata.Network = nil
}
