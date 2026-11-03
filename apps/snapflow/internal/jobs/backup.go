// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package jobs

import (
	"context"

	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/workload"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func (e *Executor) createBackup(ctx context.Context, job *apiclient.Job) (any, error) {
	payload := &machinev1alpha1.CreateBackupPayload{}
	if err := workload.Decode(jobPayload(job), payload); err != nil {
		return nil, err
	}
	assignment := sandboxruntime.Assignment{SandboxID: job.ResourceId, Generation: payload.GetAssignmentGeneration()}
	result, err := e.runtime.CreateBackup(ctx, assignment, payload)
	if err != nil {
		return nil, workload.FormatRecoverableError(err)
	}
	return result, nil
}

func (e *Executor) backupVolumes(ctx context.Context, job *apiclient.Job) (any, error) {
	payload := &machinev1alpha1.BackupVolumesPayload{}
	if err := workload.Decode(jobPayload(job), payload); err != nil {
		return nil, err
	}
	assignment := sandboxruntime.Assignment{SandboxID: job.ResourceId, Generation: payload.GetAssignmentGeneration()}
	result, err := e.runtime.BackupVolumes(ctx, assignment, payload)
	if err != nil {
		return nil, workload.FormatRecoverableError(err)
	}
	return result, nil
}
