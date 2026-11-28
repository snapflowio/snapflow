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

package volumes

import "time"

const FilesystemExt4 = "ext4"

type Attachment struct {
	InstanceID   string    `json:"instanceId"`
	MountPath    string    `json:"mountPath"`
	Subpath      string    `json:"subpath,omitempty"`
	ReadOnly     bool      `json:"readOnly"`
	Generation   uint64    `json:"generation"`
	FencingToken string    `json:"fencingToken"`
	AttachedAt   time.Time `json:"attachedAt"`
}

type Volume struct {
	ID         string      `json:"id"`
	Name       string      `json:"name"`
	SizeGiB    int64       `json:"sizeGiB"`
	Filesystem string      `json:"filesystem"`
	Generation uint64      `json:"generation"`
	Attachment *Attachment `json:"attachment,omitempty"`
	CreatedAt  time.Time   `json:"createdAt"`
	UpdatedAt  time.Time   `json:"updatedAt"`
}

type EnsureRequest struct {
	ID         string
	Name       string
	SizeGiB    int64
	Filesystem string
}

type AttachRequest struct {
	InstanceID   string
	MountPath    string
	Subpath      string
	ReadOnly     bool
	Generation   uint64
	FencingToken string
}

type RestoreRequest struct {
	Source       string
	InstanceID   string
	Generation   uint64
	FencingToken string
}

type MountedVolume struct {
	VolumeID     string `json:"volumeId"`
	DiskPath     string `json:"diskPath"`
	MountPath    string `json:"mountPath"`
	Subpath      string `json:"subpath,omitempty"`
	ReadOnly     bool   `json:"readOnly"`
	Generation   uint64 `json:"generation"`
	FencingToken string `json:"fencingToken"`
}
