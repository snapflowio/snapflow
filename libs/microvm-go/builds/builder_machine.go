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
	"context"
	"net"
	"time"
)

type BuilderFile struct {
	Path    string
	Content []byte
}

type BuilderSpec struct {
	ID           string
	BuilderImage string
	Platform     string
	StateDisk    string
	StateMount   string
	Command      []string
	ConfigFile   BuilderFile
	CPUVCPUs     int64
	MemoryGiB    int64
	WorkspaceGiB int64
}

type BuilderPhases struct {
	BuilderImage time.Duration
	Prepare      time.Duration
	Launch       time.Duration
}

type BuilderLogs struct {
	Application string
	VMM         string
}

type BuilderMachine interface {
	StartBuilder(ctx context.Context, spec BuilderSpec) (BuilderPhases, error)
	DialBuilder(ctx context.Context, id string, port uint16) (net.Conn, error)
	StopBuilder(ctx context.Context, id string) error
	ReserveBuildDisk(ctx context.Context, id string) error
	ReleaseBuildDisk(id string)
	BuilderLogs(id string) BuilderLogs
}
