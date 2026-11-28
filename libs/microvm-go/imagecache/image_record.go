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

package imagecache

import (
	"strings"
	"time"
)

type ImageStatus string

const (
	ImageStatusResolved ImageStatus = "resolved"
	ImageStatusReady    ImageStatus = "ready"
	ImageStatusFailed   ImageStatus = "failed"
)

type ImageSource string

const (
	ImageSourceOCI          ImageSource = "oci"
	ImageSourceDiskArtifact ImageSource = "disk-artifact"
)

type ImageRecord struct {
	Reference  string            `json:"reference"`
	Repository string            `json:"repository"`
	Digest     string            `json:"digest"`
	Platform   string            `json:"platform"`
	Status     ImageStatus       `json:"status"`
	Source     ImageSource       `json:"source"`
	Error      string            `json:"error,omitempty"`
	Entrypoint []string          `json:"entrypoint,omitempty"`
	Cmd        []string          `json:"cmd,omitempty"`
	Env        map[string]string `json:"env,omitempty"`
	Labels     map[string]string `json:"labels,omitempty"`
	WorkingDir string            `json:"workingDir,omitempty"`
	SizeBytes  int64             `json:"sizeBytes"`
	CreatedAt  time.Time         `json:"createdAt"`
	UpdatedAt  time.Time         `json:"updatedAt"`
}

func (r ImageRecord) DigestHex() string {
	return digestHex(r.Digest)
}

func recordFromMetadata(metadata ImageMetadata, status ImageStatus, sizeBytes int64) ImageRecord {
	now := time.Now().UTC()
	return ImageRecord{
		Reference:  metadata.Reference,
		Repository: metadata.Repository,
		Digest:     metadata.Digest,
		Platform:   metadata.Platform.String(),
		Status:     status,
		Source:     ImageSourceOCI,
		Entrypoint: metadata.Entrypoint,
		Cmd:        metadata.Cmd,
		Env:        metadata.Env,
		Labels:     metadata.Labels,
		WorkingDir: metadata.WorkingDir,
		SizeBytes:  sizeBytes,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
}

func digestHex(digest string) string {
	if _, hex, found := strings.Cut(digest, ":"); found {
		return hex
	}
	return digest
}
