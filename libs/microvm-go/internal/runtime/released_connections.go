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
	"log/slog"
	"sync"
	"time"

	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

const maximumReleasedConnectionReadings = 1024

type releasedConnections struct {
	mu       sync.Mutex
	readings []types.ReleasedConnections
	dropped  bool
}

func (released *releasedConnections) add(reading types.ReleasedConnections) {
	released.mu.Lock()
	defer released.mu.Unlock()
	if len(released.readings) >= maximumReleasedConnectionReadings {
		released.readings = released.readings[1:]
		released.dropped = true
	}
	released.readings = append(released.readings, reading)
}

func (released *releasedConnections) drain() types.ReleasedConnectionBatch {
	released.mu.Lock()
	defer released.mu.Unlock()
	batch := types.ReleasedConnectionBatch{Readings: released.readings, Complete: !released.dropped}
	released.readings = nil
	released.dropped = false
	return batch
}

func (b *Backend) captureReleasedConnections(ctx context.Context, metadata state.InstanceMetadata) {
	if metadata.Network == nil || metadata.TemplateSeed {
		return
	}
	connections, err := b.networks.ReadConnections(ctx, metadata.Network)
	if err != nil {
		slog.WarnContext(ctx, "could not take the final connection sample before network release",
			"instance_id", metadata.ID, "error", err)
	}
	b.released.add(types.ReleasedConnections{
		InstanceID: metadata.ID, BuildTenant: metadata.BuildTenant, ReleasedAt: time.Now().UTC(), Connections: connections, Complete: err == nil,
	})
}

func (b *Backend) ReleasedConnections() types.ReleasedConnectionBatch {
	return b.released.drain()
}
