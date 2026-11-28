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

package lifecycle

import (
	"sync"
	"time"

	"github.com/snapflowio/microvm-go/metrics"
)

const defaultEventBufferSize = 256

type Operation string

const (
	OperationCreate              Operation = "create"
	OperationStart               Operation = "start"
	OperationStop                Operation = "stop"
	OperationDestroy             Operation = "destroy"
	OperationResize              Operation = "resize"
	OperationPause               Operation = "pause"
	OperationResume              Operation = "resume"
	OperationStandby             Operation = "standby"
	OperationRestore             Operation = "restore"
	OperationCreateSnapshot      Operation = "create_snapshot"
	OperationDeleteSnapshot      Operation = "delete_snapshot"
	OperationFork                Operation = "fork"
	OperationReconcile           Operation = "reconcile"
	OperationHealthCheck         Operation = "health_check"
	OperationRestart             Operation = "restart"
	OperationBuild               Operation = "build"
	OperationExportImage         Operation = "export_image"
	OperationBackupVolume        Operation = "backup_volume"
	OperationRestoreVolume       Operation = "restore_volume"
	OperationImageResolution     Operation = "startup.image_resolution"
	OperationDiskPreparation     Operation = "startup.disk_preparation"
	OperationVolumePreparation   Operation = "startup.volume_preparation"
	OperationPlatformBundle      Operation = "startup.platform_bundle_resolution"
	OperationIdentityPreparation Operation = "startup.identity_preparation"
	OperationNetworkAllocation   Operation = "startup.network_allocation"
	OperationEgressPolicy        Operation = "startup.egress_policy"
	OperationConfigDrive         Operation = "startup.config_drive"
	OperationMetadataCommit      Operation = "startup.metadata_commit"
	OperationTemplateLookup      Operation = "startup.template_lookup"
	OperationTemplateBuild       Operation = "startup.cold_template_build"
	OperationSnapshotRestore     Operation = "startup.snapshot_restore"
	OperationGuestHandshake      Operation = "startup.guest_handshake"
	OperationGuestRestore        Operation = "startup.guest_restore"
	OperationToolboxReady        Operation = "startup.toolbox_readiness"
	OperationWorkloadReady       Operation = "startup.workload_readiness"
	OperationFirstCommand        Operation = "startup.first_successful_command"
)

type Phase string

const (
	PhaseStarted   Phase = "started"
	PhaseSucceeded Phase = "succeeded"
	PhaseFailed    Phase = "failed"
)

type Event struct {
	OperationID string
	InstanceID  string
	TargetID    string
	Operation   Operation
	Phase       Phase
	Reason      string
	Timestamp   time.Time
	Duration    time.Duration
	Err         error
}

type subscriber struct {
	channel chan Event
}

type EventBus struct {
	mu          sync.Mutex
	subscribers map[uint64]subscriber
	nextID      uint64
	bufferSize  int
	metrics     *metrics.Recorder
}

func NewEventBus(bufferSize int) *EventBus {
	if bufferSize <= 0 {
		bufferSize = defaultEventBufferSize
	}
	return &EventBus{
		subscribers: make(map[uint64]subscriber),
		bufferSize:  bufferSize,
		metrics:     metrics.NewRecorder(),
	}
}

func (b *EventBus) Subscribe() (<-chan Event, func()) {
	channel := make(chan Event, b.bufferSize)
	b.mu.Lock()
	b.nextID++
	id := b.nextID
	b.subscribers[id] = subscriber{channel: channel}
	b.mu.Unlock()
	return channel, func() {
		b.mu.Lock()
		if current, ok := b.subscribers[id]; ok {
			delete(b.subscribers, id)
			close(current.channel)
		}
		b.mu.Unlock()
	}
}

func (b *EventBus) Publish(event Event) {
	if b == nil {
		return
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}
	b.metrics.Observe(metrics.Observation{
		Operation: string(event.Operation),
		Phase:     string(event.Phase),
		Reason:    event.Reason,
		Timestamp: event.Timestamp,
		Duration:  event.Duration,
	})
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, current := range b.subscribers {
		select {
		case current.channel <- event:
		default:
			b.metrics.RecordDroppedEvent(string(event.Operation))
		}
	}
}

func (b *EventBus) Metrics() metrics.Snapshot {
	if b == nil {
		return metrics.Snapshot{}
	}
	return b.metrics.Snapshot()
}
