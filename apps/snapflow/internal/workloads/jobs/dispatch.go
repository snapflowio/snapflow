// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package jobs

import (
	"context"
	"fmt"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type jobHandler func(*Executor, context.Context, *apiclient.Job) (any, error)

func jobHandlers() map[apiclient.JobType]jobHandler {
	return map[apiclient.JobType]jobHandler{
		apiclient.JobTypeCreateBackup:              (*Executor).createBackup,
		apiclient.JobTypeBackupVolumes:             (*Executor).backupVolumes,
		apiclient.JobTypeBuildSnapshot:             (*Executor).buildSnapshot,
		apiclient.JobTypePublishSnapshot:           (*Executor).publishSnapshot,
		apiclient.JobTypeInspectSnapshotInRegistry: (*Executor).inspectSnapshotInRegistry,
		apiclient.JobTypeSnapshotSandbox:           (*Executor).snapshotSandbox,
		apiclient.JobTypeDeleteVolume:              (*Executor).deleteVolume,
		apiclient.JobTypeResizeVolume:              (*Executor).resizeVolume,
		apiclient.JobTypeRestoreVolume:             (*Executor).restoreVolume,
		apiclient.JobTypeQualifyMachine:            (*Executor).qualifyMachine,
		apiclient.JobTypeBenchmarkMachine:          (*Executor).benchmarkMachine,
	}
}

func (e *Executor) executeJob(ctx context.Context, job *apiclient.Job) (any, error) {
	handler, found := jobHandlers()[job.Type]
	if !found {
		return nil, fmt.Errorf("unknown job type: %s", job.Type)
	}
	return handler(e, ctx, job)
}
