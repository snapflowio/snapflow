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
	"maps"
	"time"

	"github.com/snapflowio/microvm-go/healthcheck"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/admission"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/forkvm"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/template"
	"github.com/snapflowio/microvm-go/restartpolicy"
	"github.com/snapflowio/microvm-go/types"
)

const (
	templateSeedGeneration     = 1
	templateSeedSpecification  = 0
	templateIntentDigestPrefix = "sha256:"
	imageDigestSeparator       = "@"
	templateSeedRetryInterval  = 5 * time.Second
	templateSeedDiscardTimeout = 30 * time.Second
)

var (
	errSeedPreempted  = errors.New("a workload needed the capacity held by the template seed")
	errMachineBusy    = errors.New("the machine is admitting workloads")
	errNoSeedCapacity = errors.New("the machine lacks free capacity for the seed")
)

type templateUnavailableError struct {
	cause error
}

func (e *templateUnavailableError) Error() string { return e.cause.Error() }

func (e *templateUnavailableError) Unwrap() error { return e.cause }

func templateUnavailable(cause error) error {
	if cause == nil {
		return nil
	}
	return &templateUnavailableError{cause: cause}
}

type templateNotPreparedError struct {
	keyID       string
	key         template.Key
	seedRequest types.CreateRequest
}

func (e *templateNotPreparedError) Error() string { return template.ErrNotPrepared.Error() }

func (e *templateNotPreparedError) Unwrap() error { return template.ErrNotPrepared }

func (b *Backend) prepareTemplateAfter(ctx context.Context, templateErr error) {
	var notPrepared *templateNotPreparedError
	if errors.As(templateErr, &notPrepared) {
		b.templates.Prepare(ctx, notPrepared.keyID, notPrepared.key, notPrepared.seedRequest)
	}
}

func (b *Backend) seedReady(request types.CreateRequest) error {
	if !b.admission.Idle() {
		return errMachineBusy
	}
	if !b.admission.Fits(seedResources(b.createResources(request), request)) {
		return errNoSeedCapacity
	}
	return nil
}

func seedResources(create admission.Resources, request types.CreateRequest) admission.Resources {
	create.DiskGiB += request.MemoryQuota
	return create
}

func (b *Backend) scheduleTemplateSeeds(ctx context.Context) {
	retry := time.NewTicker(templateSeedRetryInterval)
	defer retry.Stop()
	for {
		released := b.admission.Released()
		b.templates.BuildQueued(ctx, b.seedReady)
		select {
		case <-ctx.Done():
			return
		case <-released:
		case <-b.templates.Queued():
		case <-retry.C:
		}
	}
}

type templateSeeds struct {
	backend *Backend
}

func (seeds templateSeeds) BuildSeed(ctx context.Context, request types.CreateRequest) (returnErr error) {
	buildContext, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)
	seeds.backend.admission.BeginPreemptible(request.ID, func() { cancel(errSeedPreempted) })
	defer seeds.backend.admission.EndPreemptible(request.ID)
	defer func() {
		if returnErr != nil {
			returnErr = errors.Join(returnErr, seeds.discard(ctx, request.ID))
		}
	}()
	err := runLifecycleAction(seeds.backend, request.ID, lifecycle.OperationTemplateBuild, func() error {
		if _, err := seeds.backend.createColdWithOptions(buildContext, request, createOptions{templateSeed: true}); err != nil {
			return fmt.Errorf("boot runtime template seed: %w", err)
		}
		if err := seeds.backend.Standby(buildContext, request.ID); err != nil {
			return fmt.Errorf("snapshot runtime template seed: %w", err)
		}
		return nil
	})
	cause := seedDeferral(buildContext, err)
	if cause == nil {
		return err
	}
	slog.InfoContext(ctx, "runtime template seed gave way to workloads", "instance_id", request.ID, "reason", cause)
	return fmt.Errorf("%w: %w", template.ErrDeferred, cause)
}

func seedDeferral(buildContext context.Context, err error) error {
	if err == nil {
		return nil
	}
	if cause := context.Cause(buildContext); errors.Is(cause, errSeedPreempted) || errors.Is(cause, context.Canceled) {
		return cause
	}
	var insufficient *admission.InsufficientError
	if errors.As(err, &insufficient) {
		return insufficient
	}
	return nil
}

func (seeds templateSeeds) discard(ctx context.Context, seedID string) error {
	discardContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), templateSeedDiscardTimeout)
	defer cancel()
	return wrapOptionalError("discard unfinished template seed", seeds.backend.Destroy(discardContext, seedID))
}

func (seeds templateSeeds) DestroySeed(ctx context.Context, seedID string) error {
	return seeds.backend.Destroy(ctx, seedID)
}

func (seeds templateSeeds) CurrentKey(ctx context.Context, stored template.Key, request types.CreateRequest) (template.Key, error) {
	return seeds.backend.currentTemplateKey(ctx, stored, request)
}

func (b *Backend) PrepareTemplate(ctx context.Context, request types.CreateRequest) (string, error) {
	selectedHypervisor, err := hypervisor.SelectRequested(ctx, request, b.defaultHypervisor)
	if err != nil {
		return "", fmt.Errorf("select template hypervisor: %w", err)
	}
	if !b.templateEligible(request, selectedHypervisor) {
		return "", errors.New("runtime request is not eligible for template preparation")
	}
	key, imageRecord, err := b.resolveTemplateKey(ctx, request)
	if err != nil {
		return "", fmt.Errorf("resolve runtime template key: %w", err)
	}
	keyID, err := template.KeyID(key)
	if err != nil {
		return "", err
	}
	b.templates.Prepare(ctx, keyID, key, templateSeedRequest(keyID, imageRecord, request))
	return keyID, nil
}

func (b *Backend) RetainTemplates(keyIDs []string) {
	b.templates.Retain(keyIDs)
}

func (b *Backend) collectTemplates(ctx context.Context) {
	interval := time.NewTicker(b.templates.CollectionInterval())
	defer interval.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-interval.C:
		case <-b.templates.Collections():
		}
		if err := b.templates.Collect(ctx); err != nil && ctx.Err() == nil {
			slog.WarnContext(ctx, "could not fully collect runtime templates", "error", err)
		}
		if err := b.releaseOrphanedImages(ctx); err != nil && ctx.Err() == nil {
			slog.WarnContext(ctx, "could not release orphaned images", "error", err)
		}
	}
}

func (b *Backend) PreparedTemplateKeys(ctx context.Context) ([]string, error) {
	return b.templates.PreparedKeys(ctx)
}

func templateSeedRequest(keyID string, imageRecord imagecache.ImageRecord, request types.CreateRequest) types.CreateRequest {
	seedID := template.SeedID(keyID)
	seedRequest := request
	seedRequest.ID = seedID
	seedRequest.Identity = templateSeedIdentity(seedID, keyID)
	seedRequest.Image = imageRecord.Repository + imageDigestSeparator + imageRecord.Digest
	seedRequest.ImagePullPolicy = types.ImagePullNever
	seedRequest.Hypervisor = string(hypervisor.HypervisorFirecracker)
	seedRequest.Env = nil
	seedRequest.SecretEnv = nil
	seedRequest.Entrypoint = nil
	seedRequest.Registry = nil
	seedRequest.HealthCheck = nil
	seedRequest.RestartPolicy = nil
	seedRequest.NetworkBlockAll = nil
	seedRequest.NetworkAllowList = nil
	seedRequest.UserID = ""
	seedRequest.OSUser = ""
	profile := hypervisor.InstanceProfileForLabels(request.Labels)
	seedRequest.Labels = map[string]string{hypervisor.InstanceProfileLabel: string(profile)}
	return seedRequest
}

func templateSeedIdentity(seedID, keyID string) types.RuntimeArtifactIdentity {
	return types.RuntimeArtifactIdentity{
		InstanceID:              seedID,
		AssignmentGeneration:    templateSeedGeneration,
		LifecycleGeneration:     templateSeedGeneration,
		SpecificationGeneration: templateSeedSpecification,
		IntentDigest:            templateIntentDigestPrefix + keyID,
	}
}

type templateTimings struct {
	startedAt          time.Time
	keyResolvedAt      time.Time
	seedReadyAt        time.Time
	forkReadyAt        time.Time
	targetConfiguredAt time.Time
}

func (b *Backend) createFromTemplate(ctx context.Context, request types.CreateRequest) (string, error) {
	timings := templateTimings{startedAt: time.Now()}
	type resolvedTemplate struct {
		key   template.Key
		image imagecache.ImageRecord
	}
	resolved, err := runLifecycleOperation(b, request.ID, "", lifecycle.OperationTemplateLookup, func() (resolvedTemplate, error) {
		key, imageRecord, resolveErr := b.resolveTemplateKey(ctx, request)
		return resolvedTemplate{key: key, image: imageRecord}, resolveErr
	})
	if err != nil {
		return "", templateUnavailable(err)
	}
	timings.keyResolvedAt = time.Now()
	keyID, err := template.KeyID(resolved.key)
	if err != nil {
		return "", err
	}
	seedID, err := b.templates.PreparedSeed(ctx, keyID, resolved.key)
	if errors.Is(err, template.ErrNotPrepared) {
		return "", templateUnavailable(&templateNotPreparedError{
			keyID: keyID, key: resolved.key, seedRequest: templateSeedRequest(keyID, resolved.image, request),
		})
	}
	if err != nil {
		return "", templateUnavailable(err)
	}
	timings.seedReadyAt = time.Now()
	if err := b.forkTemplate(ctx, keyID, resolved.key, seedID, request); err != nil {
		return "", err
	}
	timings.forkReadyAt = time.Now()
	if err := b.startTemplateTarget(ctx, keyID, request, &timings); err != nil {
		return "", err
	}
	slog.InfoContext(
		ctx,
		"microVM instance restored from template",
		"instance_id", request.ID,
		"template_key", keyID,
		"total_ms", time.Since(timings.startedAt).Milliseconds(),
		"key_ms", timings.keyResolvedAt.Sub(timings.startedAt).Milliseconds(),
		"seed_ms", timings.seedReadyAt.Sub(timings.keyResolvedAt).Milliseconds(),
		"fork_ms", timings.forkReadyAt.Sub(timings.seedReadyAt).Milliseconds(),
		"configure_ms", timings.targetConfiguredAt.Sub(timings.forkReadyAt).Milliseconds(),
		"restore_init_ms", time.Since(timings.targetConfiguredAt).Milliseconds(),
	)
	return request.ID, nil
}

func (b *Backend) forkTemplate(ctx context.Context, keyID string, key template.Key, seedID string, request types.CreateRequest) error {
	release, err := b.templates.Pin(keyID, key)
	if err != nil {
		return templateUnavailable(fmt.Errorf("validate pinned runtime template: %w", err))
	}
	defer release()
	_, err = b.forkWithOptions(ctx, seedID, types.ForkRequest{ID: request.ID, AssignmentGeneration: request.Identity.AssignmentGeneration}, forkOptions{
		shareSnapshotMemory: true,
	})
	if err == nil {
		return nil
	}
	if errors.Is(err, forkvm.ErrHardlinkUnsupported) {
		b.templates.MarkCloneUnavailable()
	}
	return templateUnavailable(fmt.Errorf("fork runtime template: %w", err))
}

func (b *Backend) startTemplateTarget(ctx context.Context, keyID string, request types.CreateRequest, timings *templateTimings) error {
	metadata, err := b.configureTemplateTarget(ctx, keyID, request)
	if err != nil {
		cleanupErr := b.cleanupTemplateTarget(ctx, request.ID)
		failure := errors.Join(err, cleanupErr)
		if cleanupErr != nil {
			return failure
		}
		return templateUnavailable(failure)
	}
	timings.targetConfiguredAt = time.Now()
	initialization := &types.WorkloadInitialization{
		InstanceID:   metadata.ID,
		GenerationID: metadata.GenerationID,
		OSUser:       request.OSUser,
		Env:          maps.Clone(request.Env),
		SecretEnv:    maps.Clone(request.SecretEnv),
		Entrypoint:   append([]string(nil), request.Entrypoint...),
	}
	startErr := b.Start(ctx, request.ID, types.StartOptions{Initialization: initialization})
	if startErr == nil {
		return nil
	}
	cleanupErr := b.cleanupTemplateTarget(ctx, request.ID)
	failure := errors.Join(fmt.Errorf("start runtime from template: %w", startErr), cleanupErr)
	var unavailable *templateUnavailableError
	if errors.As(startErr, &unavailable) {
		b.templates.Invalidate(keyID)
	}
	if cleanupErr != nil {
		slog.ErrorContext(ctx, "could not fully clean up failed template target", "instance_id", request.ID, "error", failure)
	}
	return failure
}

func (b *Backend) cleanupTemplateTarget(ctx context.Context, instanceID string) error {
	return wrapOptionalError("clean up failed template target", b.Destroy(context.WithoutCancel(ctx), instanceID))
}

func (b *Backend) configureTemplateTarget(ctx context.Context, keyID string, request types.CreateRequest) (state.InstanceMetadata, error) {
	guard, err := b.lifecycle.Lock(ctx, request.ID)
	if err != nil {
		return state.InstanceMetadata{}, fmt.Errorf("lock template target: %w", err)
	}
	defer guard.Release()
	metadata, err := b.readInstance(request.ID)
	if err != nil {
		return state.InstanceMetadata{}, err
	}
	healthPolicy, err := healthcheck.Normalize(request.HealthCheck)
	if err != nil {
		return state.InstanceMetadata{}, fmt.Errorf("normalize template target health policy: %w", err)
	}
	restartPolicy, err := restartpolicy.Normalize(request.RestartPolicy)
	if err != nil {
		return state.InstanceMetadata{}, fmt.Errorf("normalize template target restart policy: %w", err)
	}
	metadata.UserID = request.UserID
	metadata.Identity = request.Identity
	metadata.Image = request.Image
	metadata.OSUser = request.OSUser
	metadata.Env = maps.Clone(request.Env)
	metadata.RequiresSecretEnv = len(request.SecretEnv) > 0
	metadata.Labels = maps.Clone(request.Labels)
	metadata.Entrypoint = append([]string(nil), request.Entrypoint...)
	metadata.HealthCheck = healthPolicy
	metadata.RestartPolicy = restartPolicy
	metadata.RawRequest = types.PersistentCreateRequest(request)
	metadata.TemplateSeed = false
	metadata.TemplateKey = keyID
	metadata.WorkloadInitialized = false
	if _, err := instanceEgressPolicy(metadata); err != nil {
		return state.InstanceMetadata{}, mvmerrors.NewInvalidRequest(err)
	}
	if err := b.writeInstance(metadata); err != nil {
		return state.InstanceMetadata{}, fmt.Errorf("persist template target configuration: %w", err)
	}
	return metadata, nil
}
