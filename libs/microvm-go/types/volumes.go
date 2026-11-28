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

package types

import "time"

type VolumeAttachment struct {
	ID           string               `json:"id" validate:"required,uuid"`
	Name         string               `json:"name" validate:"required"`
	SizeGiB      int64                `json:"sizeGiB" validate:"min=1"`
	Filesystem   string               `json:"filesystem" validate:"required,oneof=ext4"`
	MountPath    string               `json:"mountPath" validate:"required"`
	Subpath      string               `json:"subpath,omitempty"`
	ReadOnly     bool                 `json:"readOnly,omitempty"`
	Generation   uint64               `json:"generation" validate:"min=1"`
	FencingToken string               `json:"fencingToken" validate:"required,uuid"`
	Restore      *RestoreVolumeBackup `json:"restore,omitempty" validate:"omitempty"`
}

type Volume struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	SizeGiB    int64             `json:"sizeGiB"`
	Filesystem string            `json:"filesystem"`
	Generation uint64            `json:"generation"`
	Attachment *VolumeAttachment `json:"attachment,omitempty"`
}

type VolumeBackupObject struct {
	ArtifactID  string `json:"artifactId" validate:"required,uuid"`
	DownloadURL string `json:"downloadUrl" validate:"required,url"`
	DataKey     string `json:"dataKey" validate:"required,base64"`
}

type VolumeBackupResult struct {
	PackSizeBytes         int64    `json:"packSizeBytes"`
	ManifestSizeBytes     int64    `json:"manifestSizeBytes"`
	ChangedBytes          int64    `json:"changedBytes"`
	ReferencedArtifactIDs []string `json:"referencedArtifactIds"`
}

type ObjectUpload struct {
	Endpoint        string    `json:"endpoint" validate:"required,url"`
	Region          string    `json:"region" validate:"required"`
	Bucket          string    `json:"bucket" validate:"required"`
	Key             string    `json:"key" validate:"required"`
	ContentType     string    `json:"contentType,omitempty"`
	AccessKeyID     string    `json:"accessKeyId" validate:"required"`
	SecretAccessKey string    `json:"secretAccessKey" validate:"required"`
	SessionToken    string    `json:"sessionToken" validate:"required"`
	ExpiresAt       time.Time `json:"expiresAt" validate:"required"`
}

type CreateInstanceVolumeBackupItem struct {
	VolumeID             string              `json:"volumeId" validate:"required,uuid"`
	ArtifactID           string              `json:"artifactId" validate:"required,uuid"`
	PackUpload           ObjectUpload        `json:"packUpload" validate:"required"`
	ManifestUploadURL    string              `json:"manifestUploadUrl" validate:"required,url"`
	DataKey              string              `json:"dataKey" validate:"required,base64"`
	AttachmentGeneration uint64              `json:"attachmentGeneration" validate:"min=1"`
	FencingToken         string              `json:"fencingToken" validate:"required,uuid"`
	BackupGeneration     uint64              `json:"backupGeneration" validate:"min=1"`
	Base                 *VolumeBackupObject `json:"base,omitempty" validate:"omitempty"`
}

type CreateInstanceVolumeBackup struct {
	Items []CreateInstanceVolumeBackupItem `json:"items" validate:"required,min=1,dive"`
}

type InstanceVolumeBackupResult struct {
	VolumeID         string `json:"volumeId"`
	ArtifactID       string `json:"artifactId"`
	BackupGeneration uint64 `json:"backupGeneration"`
	VolumeBackupResult
}

type RestoreVolumeBackup struct {
	Manifest                VolumeBackupObject   `json:"manifest" validate:"required"`
	Packs                   []VolumeBackupObject `json:"packs" validate:"dive"`
	ExpectedVolumeSizeBytes int64                `json:"expectedVolumeSizeBytes" validate:"min=1"`
	InstanceID              string               `json:"instanceId,omitempty" validate:"omitempty,uuid"`
	Generation              uint64               `json:"generation,omitempty"`
	FencingToken            string               `json:"fencingToken,omitempty" validate:"omitempty,uuid"`
	VerifyOnly              bool                 `json:"verifyOnly,omitempty"`
}
