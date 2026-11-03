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
	"strings"

	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/sandbox"
	"github.com/snapflowio/snapflow/internal/workload"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const bytesPerGiB = 1 << 30

type Snapshots interface {
	sandbox.SnapshotSource
	Adopt(context.Context, string) error
}

func (e *Executor) buildSnapshot(ctx context.Context, job *apiclient.Job) (any, error) {
	payload := &machinev1alpha1.BuildSnapshotPayload{}
	if err := workload.Decode(jobPayload(job), payload); err != nil {
		return nil, err
	}
	release, err := e.snapshots.Ensure(ctx, e.runtime.BuilderImage())
	if err != nil {
		return nil, fmt.Errorf("hold builder image %s: %w", e.runtime.BuilderImage(), err)
	}
	defer release()
	image, err := e.runtime.BuildImage(ctx, payload)
	if err != nil {
		return nil, err
	}
	return e.heldSnapshotInfo(ctx, image)
}

func (e *Executor) publishSnapshot(ctx context.Context, job *apiclient.Job) (any, error) {
	payload := &machinev1alpha1.PublishSnapshotPayload{}
	if err := workload.Decode(jobPayload(job), payload); err != nil {
		return nil, err
	}
	if err := e.runtime.PublishImage(ctx, payload); err != nil {
		return nil, err
	}
	return e.heldSnapshotInfo(ctx, payload.GetDestinationRef())
}

func (e *Executor) heldSnapshotInfo(ctx context.Context, snapshot string) (*machinev1alpha1.SnapshotInfoResult, error) {
	if err := e.snapshots.Adopt(ctx, snapshot); err != nil {
		return nil, fmt.Errorf("record snapshot %s: %w", snapshot, err)
	}
	info, err := e.runtime.ImageInfo(ctx, snapshot)
	if err != nil {
		return nil, err
	}
	return &machinev1alpha1.SnapshotInfoResult{
		Name:       snapshot,
		SizeGb:     bytesToGiB(info.SizeBytes),
		Entrypoint: info.Entrypoint,
		Cmd:        info.Command,
		Hash:       hashWithoutPrefix(info.Digest),
	}, nil
}

func (e *Executor) inspectSnapshotInRegistry(ctx context.Context, job *apiclient.Job) (any, error) {
	payload := &machinev1alpha1.InspectSnapshotPayload{}
	if err := workload.Decode(jobPayload(job), payload); err != nil {
		return nil, err
	}
	digest, err := e.runtime.InspectImageInRegistry(ctx, payload.GetSnapshot(), payload.GetRegistry())
	if err != nil {
		return nil, err
	}
	return &machinev1alpha1.SnapshotDigestResult{
		Hash:   hashWithoutPrefix(digest.Digest),
		SizeGb: bytesToGiB(digest.SizeBytes),
	}, nil
}

func (e *Executor) snapshotSandbox(ctx context.Context, job *apiclient.Job) (any, error) {
	payload := &machinev1alpha1.SnapshotSandboxPayload{}
	if err := workload.Decode(jobPayload(job), payload); err != nil {
		return nil, err
	}
	assignment := sandboxruntime.Assignment{SandboxID: job.ResourceId, Generation: payload.GetAssignmentGeneration()}
	info, err := e.runtime.CreateSnapshot(ctx, assignment, payload.GetRegistry())
	if err != nil {
		return nil, workload.FormatRecoverableError(err)
	}
	return snapshotSandboxResult(info), nil
}

func snapshotSandboxResult(info sandboxruntime.ImageInfo) *machinev1alpha1.SnapshotSandboxResult {
	return &machinev1alpha1.SnapshotSandboxResult{
		Ref:        info.Reference,
		Hash:       hashWithoutPrefix(info.Digest),
		SizeGb:     bytesToGiB(info.SizeBytes),
		Entrypoint: info.Entrypoint,
		Cmd:        info.Command,
	}
}

func hashWithoutPrefix(hash string) string {
	return strings.TrimPrefix(hash, workload.OCIDigestPrefix)
}

func bytesToGiB(size int64) float64 {
	return float64(size) / bytesPerGiB
}
