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

package state

type SnapshotOwnership struct {
	Generation uint64 `json:"generation"`
	Device     uint64 `json:"device"`
	Inode      uint64 `json:"inode"`
}

func (ownership *SnapshotOwnership) Owns(directory FileIdentity) bool {
	return ownership != nil && ownership.Device == directory.Device && ownership.Inode == directory.Inode
}

func (metadata *InstanceMetadata) ClaimSnapshot(directory FileIdentity) {
	metadata.SnapshotGeneration++
	metadata.OwnSnapshot = &SnapshotOwnership{
		Generation: metadata.SnapshotGeneration,
		Device:     directory.Device,
		Inode:      directory.Inode,
	}
}
