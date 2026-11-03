// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package snapshot

import (
	"strings"
	"time"

	"github.com/snapflowio/snapflow/internal/state"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const maximumReasonLength = 2048

type entry struct {
	state       machinev1alpha1.SnapshotInventoryState
	record      state.SnapshotRecord
	errorReason string
	backoff     reconnect.Backoff
	retryAt     time.Time
}

func presentEntry(record state.SnapshotRecord) *entry {
	return &entry{state: machinev1alpha1.SnapshotInventoryState_SNAPSHOT_INVENTORY_STATE_PRESENT, record: record}
}

func (current *entry) present() bool {
	return current != nil && current.state == machinev1alpha1.SnapshotInventoryState_SNAPSHOT_INVENTORY_STATE_PRESENT
}

type taskKind int

const (
	taskPull taskKind = iota
	taskTemplate
	taskRemoval
)

type task struct {
	kind taskKind
	done chan struct{}
	err  error
}

func newTask(kind taskKind) *task {
	return &task{kind: kind, done: make(chan struct{})}
}

func templateMatches(prepared *machinev1alpha1.PreparedTemplate, preparation *machinev1alpha1.TemplatePreparation) bool {
	return prepared != nil &&
		prepared.GetCpuQuota() == preparation.GetCpuQuota() &&
		prepared.GetMemoryQuota() == preparation.GetMemoryQuota() &&
		prepared.GetStorageQuota() == preparation.GetStorageQuota() &&
		strings.Join(prepared.GetCapabilities(), ",") == strings.Join(preparation.GetCapabilities(), ",")
}

func boundedReason(reason string) string {
	runes := []rune(strings.TrimSpace(reason))
	if len(runes) <= maximumReasonLength {
		return string(runes)
	}
	return string(runes[:maximumReasonLength])
}
