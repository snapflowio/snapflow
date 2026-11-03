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

	"github.com/snapflowio/snapflow/internal/workload"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func (e *Executor) deleteVolume(ctx context.Context, job *apiclient.Job) (any, error) {
	return nil, e.runtime.DeleteVolume(ctx, job.ResourceId)
}

func (e *Executor) resizeVolume(ctx context.Context, job *apiclient.Job) (any, error) {
	payload := &machinev1alpha1.ResizeVolumePayload{}
	if err := workload.Decode(jobPayload(job), payload); err != nil {
		return nil, err
	}
	if err := e.runtime.ResizeVolume(ctx, job.ResourceId, payload); err != nil {
		return nil, fmt.Errorf("resize volume: %w", err)
	}
	return nil, nil
}

func (e *Executor) restoreVolume(ctx context.Context, job *apiclient.Job) (any, error) {
	payload := &machinev1alpha1.RestoreVolumePayload{}
	if err := workload.Decode(jobPayload(job), payload); err != nil {
		return nil, err
	}
	if err := e.runtime.RestoreVolume(ctx, job.ResourceId, payload); err != nil {
		return nil, fmt.Errorf("restore volume: %w", err)
	}
	return nil, nil
}
