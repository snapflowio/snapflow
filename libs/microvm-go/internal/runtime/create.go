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
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"reflect"
	goruntime "runtime"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/healthcheck"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/admission"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/template"
	"github.com/snapflowio/microvm-go/restartpolicy"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) Create(ctx context.Context, request types.CreateRequest) (string, error) {
	if err := validateCreateRequest(&request); err != nil {
		return "", err
	}
	if existingID, exists, err := b.existingCreate(ctx, request); exists || err != nil {
		return existingID, err
	}
	b.reclaimTemplateDisk(ctx, b.createResources(request).DiskGiB)
	selectedHypervisor, selectionErr := hypervisor.SelectRequested(ctx, request, b.defaultHypervisor)
	if selectionErr == nil && b.templateEligible(request, selectedHypervisor) {
		instanceID, err := b.createFromTemplate(ctx, request)
		if err == nil {
			return instanceID, nil
		}
		if err := templateFallbackAllowed(ctx, err); err != nil {
			return "", err
		}
		logTemplateFallback(ctx, request.ID, err)
	}
	return b.createCold(ctx, request)
}

func validateCreateRequest(request *types.CreateRequest) error {
	if err := uuid.Validate(request.ID); err != nil {
		return mvmerrors.NewInvalidRequest(errors.New("instance id must be a UUID"))
	}
	if err := guest.ValidateSandboxCapabilities(request.Capabilities); err != nil {
		return mvmerrors.NewInvalidRequest(err)
	}
	if request.InitialState == "" {
		request.InitialState = types.InitialStateRunning
	}
	if request.InitialState != types.InitialStateRunning && request.InitialState != types.InitialStateStopped {
		return mvmerrors.NewInvalidRequest(fmt.Errorf("unsupported initial state %q", request.InitialState))
	}
	if request.LinkedPeerID == "" {
		return nil
	}
	if request.LinkedPeerID == request.ID {
		return mvmerrors.NewInvalidRequest(errors.New("instance cannot be linked to itself"))
	}
	if request.InitialState == types.InitialStateStopped {
		return mvmerrors.NewInvalidRequest(errors.New("linked instances must be created in the running state"))
	}
	return nil
}

func templateFallbackAllowed(ctx context.Context, err error) error {
	if ctx.Err() != nil {
		return errors.Join(err, ctx.Err())
	}
	var unavailable *templateUnavailableError
	if !errors.As(err, &unavailable) {
		return err
	}
	return nil
}

func logTemplateFallback(ctx context.Context, instanceID string, err error) {
	if errors.Is(err, template.ErrPreparing) {
		slog.InfoContext(ctx, "microVM template is being prepared; using cold boot", "instance_id", instanceID)
		return
	}
	slog.WarnContext(ctx, "microVM template restore unavailable; using cold boot", "instance_id", instanceID, "error", err)
}

type createOptions struct {
	templateSeed bool
}

func (b *Backend) createCold(ctx context.Context, request types.CreateRequest) (string, error) {
	return b.createColdWithOptions(ctx, request, createOptions{})
}

func (b *Backend) createColdWithOptions(ctx context.Context, request types.CreateRequest, options createOptions) (string, error) {
	return runLifecycleOperation(b, request.ID, "", lifecycle.OperationCreate, func() (string, error) {
		guard, err := b.lockCreate(ctx, request)
		if err != nil {
			return "", fmt.Errorf("acquire instance lifecycle lock: %w", err)
		}
		defer guard.Release()
		return b.createLocked(ctx, request, options)
	})
}

func (b *Backend) lockCreate(ctx context.Context, request types.CreateRequest) (*lifecycle.Guard, error) {
	if request.LinkedPeerID == "" {
		return b.lifecycle.Lock(ctx, request.ID)
	}
	return b.lifecycle.LockMany(ctx, request.ID, request.LinkedPeerID)
}

func (b *Backend) createLocked(ctx context.Context, request types.CreateRequest, options createOptions) (createdID string, returnErr error) {
	startupStartedAt := time.Now()
	secretEnv := request.SecretEnv
	request.SecretEnv = nil
	if existingID, exists, err := b.existingCreateTarget(ctx, request); exists || err != nil {
		return existingID, err
	}
	if err := normalizeCreatePolicies(&request); err != nil {
		return "", err
	}
	reservation, err := b.reserveCreate(ctx, request)
	if err != nil {
		return "", err
	}
	defer reservation.Finish()
	transaction := lifecycle.NewTransaction()
	defer func() {
		if rollbackErr := transaction.Rollback(ctx); rollbackErr != nil {
			returnErr = errors.Join(returnErr, rollbackErr)
		}
	}()
	if err := transaction.Defer("instance state directory", func(context.Context) error {
		return b.removeInstanceStateDirectories(request.ID)
	}); err != nil {
		return "", err
	}

	hv, err := b.selectCreateHypervisor(ctx, request)
	if err != nil {
		return "", err
	}
	if err := b.validateBootPrerequisites(); err != nil {
		return "", err
	}

	imageStartedAt := time.Now()
	record, platform, err := b.resolveCreateImage(ctx, request, hv)
	if err != nil {
		return "", err
	}
	imageDuration := time.Since(imageStartedAt)

	preparationStartedAt := time.Now()
	preparation := &phaseTimer{}
	metadata, assets, err := b.prepareCreateInstance(ctx, transaction, createSpec{
		request: request, record: record, platform: platform, hypervisor: hv,
		requiresSecretEnv: len(secretEnv) > 0, options: options,
	}, preparation)
	if err != nil {
		return "", err
	}
	preparationDuration := time.Since(preparationStartedAt)
	if request.InitialState == types.InitialStateStopped {
		if err := b.commitPreparedStopped(ctx, &metadata); err != nil {
			return "", err
		}
		transaction.Commit()
		return metadata.ID, nil
	}
	boot := &phaseTimer{}
	if err := b.bootInstance(ctx, transaction, &metadata, assets, secretEnv, boot); err != nil {
		return "", err
	}
	attributes := []any{
		"instance_id", metadata.ID,
		"hypervisor", metadata.Hypervisor,
		"total_ms", time.Since(startupStartedAt).Milliseconds(),
		"image_ms", imageDuration.Milliseconds(),
		"prepare_ms", preparationDuration.Milliseconds(),
	}
	attributes = append(attributes, preparation.attributes...)
	slog.InfoContext(ctx, "microVM instance ready", append(attributes, boot.attributes...)...)
	transaction.Commit()
	return metadata.ID, nil
}

func (b *Backend) prepareCreateInstance(
	ctx context.Context,
	transaction *lifecycle.Transaction,
	spec createSpec,
	preparation *phaseTimer,
) (state.InstanceMetadata, bootAssets, error) {
	metadata, assets, err := b.prepareCreate(ctx, spec, preparation)
	if err != nil {
		return state.InstanceMetadata{}, bootAssets{}, err
	}
	if err := b.deferPreparedResources(transaction, &metadata); err != nil {
		return state.InstanceMetadata{}, bootAssets{}, err
	}
	if err := preparation.time(prepareLinkedPeerPhase, func() error {
		linkRollback, err := b.establishLinkedPeer(ctx, &metadata, spec.record)
		if err != nil || linkRollback == nil {
			return err
		}
		return transaction.Defer("linked peer", linkRollback)
	}); err != nil {
		return state.InstanceMetadata{}, bootAssets{}, err
	}
	return metadata, assets, nil
}

func (b *Backend) deferPreparedResources(transaction *lifecycle.Transaction, metadata *state.InstanceMetadata) error {
	if len(metadata.GPUAssignments) > 0 {
		if err := transaction.Defer("instance GPU lease", func(rollbackCtx context.Context) error {
			return b.releaseGPUDevices(rollbackCtx, metadata)
		}); err != nil {
			return err
		}
	}
	if instanceHasNetwork(*metadata) {
		if err := transaction.Defer("instance network", func(rollbackCtx context.Context) error {
			return b.releaseNetwork(rollbackCtx, *metadata)
		}); err != nil {
			return err
		}
	}
	if len(metadata.VolumeAttachments) > 0 {
		if err := transaction.Defer("instance volumes", func(rollbackCtx context.Context) error {
			return b.detachVolumeAttachments(rollbackCtx, *metadata)
		}); err != nil {
			return err
		}
	}
	return nil
}

func (b *Backend) commitPreparedStopped(ctx context.Context, metadata *state.InstanceMetadata) error {
	if err := b.releaseGPUDevices(ctx, metadata); err != nil {
		return fmt.Errorf("release prepared instance GPU assignment: %w", err)
	}
	if instanceHasNetwork(*metadata) {
		if err := b.releaseNetwork(ctx, *metadata); err != nil {
			return fmt.Errorf("release prepared instance network: %w", err)
		}
		clearNetworkIdentity(metadata)
	}
	metadata.State = types.RuntimeStateStopped
	metadata.PID = 0
	now := time.Now().UTC()
	metadata.StoppedAt = &now
	if err := b.writeInstance(*metadata); err != nil {
		return fmt.Errorf("persist prepared stopped instance: %w", err)
	}
	return nil
}

func (b *Backend) existingCreate(ctx context.Context, request types.CreateRequest) (string, bool, error) {
	metadata, err := state.ReadInstanceMetadata(b.paths, request.ID)
	if errors.Is(err, os.ErrNotExist) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("inspect existing instance before create: %w", err)
	}
	if !reflect.DeepEqual(metadata.RawRequest, types.PersistentCreateRequest(request)) ||
		metadata.RequiresSecretEnv != (len(request.SecretEnv) > 0) {
		return "", true, mvmerrors.New(
			http.StatusConflict,
			"instance exists with an incompatible specification",
			"MICROVM_INSTANCE_SPECIFICATION_CONFLICT",
		)
	}
	if request.InitialState == types.InitialStateStopped && metadata.State == types.RuntimeStateStopped {
		return metadata.ID, true, nil
	}
	if metadata.State != types.RuntimeStateStarted || !b.processRunning(ctx, metadata) {
		return "", true, mvmerrors.New(
			http.StatusConflict,
			"instance creation is not locally satisfied",
			"MICROVM_INSTANCE_CREATE_INCOMPLETE",
		)
	}
	return metadata.ID, true, nil
}

func (b *Backend) selectCreateHypervisor(ctx context.Context, request types.CreateRequest) (hypervisor.Hypervisor, error) {
	hv, err := hypervisor.SelectRequested(ctx, request, b.defaultHypervisor)
	if err != nil {
		return "", mvmerrors.NewInvalidRequest(fmt.Errorf("select hypervisor: %w", err))
	}
	if _, enabled := b.enabledHypervisors[hv]; !enabled {
		return "", mvmerrors.New(
			http.StatusUnprocessableEntity,
			fmt.Sprintf("the %s hypervisor is not enabled for this runtime", hv),
			"MICROVM_HYPERVISOR_DISABLED",
		)
	}
	if !hypervisor.SupportedOnHost(hv) {
		return "", mvmerrors.New(
			http.StatusFailedDependency,
			fmt.Sprintf("the %s hypervisor is not supported on %s", hv, goruntime.GOOS),
			"MICROVM_HYPERVISOR_UNSUPPORTED_ON_HOST",
		)
	}
	return hv, nil
}

func (b *Backend) existingCreateTarget(ctx context.Context, request types.CreateRequest) (string, bool, error) {
	_, err := os.Stat(b.paths.InstanceDir(request.ID))
	if errors.Is(err, os.ErrNotExist) {
		return "", false, nil
	}
	if err != nil {
		return "", true, fmt.Errorf("check instance state directory: %w", err)
	}
	if existingID, exists, existingErr := b.existingCreate(ctx, request); exists || existingErr != nil {
		return existingID, true, existingErr
	}
	return "", true, mvmerrors.New(
		http.StatusConflict,
		"instance creation is incomplete and requires reconciliation",
		"MICROVM_INSTANCE_CREATE_INCOMPLETE",
	)
}

func normalizeCreatePolicies(request *types.CreateRequest) error {
	healthPolicy, err := healthcheck.Normalize(request.HealthCheck)
	if err != nil {
		return mvmerrors.New(http.StatusBadRequest, err.Error(), "MICROVM_INVALID_HEALTH_CHECK")
	}
	restartPolicy, err := restartpolicy.Normalize(request.RestartPolicy)
	if err != nil {
		return mvmerrors.New(http.StatusBadRequest, err.Error(), "MICROVM_INVALID_RESTART_POLICY")
	}
	request.HealthCheck = healthPolicy
	request.RestartPolicy = restartPolicy
	return nil
}

func (b *Backend) createResources(request types.CreateRequest) admission.Resources {
	persistentVolumeGiB := int64(0)
	for _, volume := range request.Volumes {
		persistentVolumeGiB += volume.SizeGiB
	}
	resources := requestedResources(request.CPUQuota, request.MemoryQuota, request.StorageQuota+persistentVolumeGiB, request.GPUQuota)
	if b.networks.Capacity() > 0 {
		resources.NetworkSlots = 1
	}
	return resources
}

func (b *Backend) reserveCreate(ctx context.Context, request types.CreateRequest) (*resourceReservation, error) {
	resources := b.createResources(request)
	if err := b.validateResourceShape(resources); err != nil {
		return nil, err
	}
	return b.reserveResources(ctx, request.ID, resources)
}

func (b *Backend) resolveCreateImage(
	ctx context.Context,
	request types.CreateRequest,
	hv hypervisor.Hypervisor,
) (imagecache.ImageRecord, imagecache.Platform, error) {
	record, err := runLifecycleOperation(b, request.ID, "", lifecycle.OperationImageResolution, func() (imagecache.ImageRecord, error) {
		return b.images.Ensure(ctx, request.Image, request.Registry, request.Platform, request.ImagePullPolicy)
	})
	if err != nil {
		if errors.Is(err, imagecache.ErrInvalidImageRef) || errors.Is(err, imagecache.ErrInvalidPlatform) {
			return imagecache.ImageRecord{}, imagecache.Platform{}, mvmerrors.NewWithCause(
				http.StatusUnprocessableEntity,
				"the workload image is incompatible with its requested platform",
				"MICROVM_IMAGE_INCOMPATIBLE",
				err,
			)
		}
		return imagecache.ImageRecord{}, imagecache.Platform{}, err
	}
	platform, err := imagecache.ParsePlatform(record.Platform)
	if err != nil {
		return imagecache.ImageRecord{}, imagecache.Platform{}, err
	}
	if err := requireNativePlatform(platform); err != nil {
		return imagecache.ImageRecord{}, imagecache.Platform{}, err
	}
	return record, platform, nil
}
