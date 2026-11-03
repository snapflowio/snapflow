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

package builds

import (
	"time"
)

const DefaultBuilderImage = "moby/buildkit:v0.31.1"

const (
	defaultMaxConcurrentBuilds  = 2
	defaultBuilderCPUVCPUs      = 2
	defaultBuilderMemoryGiB     = 4
	defaultBuilderWorkspaceGiB  = 20
	defaultMaxContextArchiveMiB = 1024
	defaultMaxContextEntries    = 100_000
	defaultBuildTimeout         = 15 * time.Minute
)

type Config struct {
	LogPath              func(string) (string, error)
	BuilderImage         string
	MaxConcurrent        int
	CPUVCPUs             int64
	MemoryGiB            int64
	WorkspaceGiB         int64
	MaxContextArchiveMiB int64
	MaxContextEntries    int
	Timeout              time.Duration
	HostGateway          string
}

func (c Config) Normalize() Config {
	if c.BuilderImage == "" {
		c.BuilderImage = DefaultBuilderImage
	}
	if c.MaxConcurrent <= 0 {
		c.MaxConcurrent = defaultMaxConcurrentBuilds
	}
	if c.CPUVCPUs <= 0 {
		c.CPUVCPUs = defaultBuilderCPUVCPUs
	}
	if c.MemoryGiB <= 0 {
		c.MemoryGiB = defaultBuilderMemoryGiB
	}
	if c.WorkspaceGiB <= 0 {
		c.WorkspaceGiB = defaultBuilderWorkspaceGiB
	}
	if c.MaxContextArchiveMiB <= 0 {
		c.MaxContextArchiveMiB = defaultMaxContextArchiveMiB
	}
	if c.MaxContextEntries <= 0 {
		c.MaxContextEntries = defaultMaxContextEntries
	}
	if c.Timeout <= 0 {
		c.Timeout = defaultBuildTimeout
	}
	return c
}
