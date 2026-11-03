// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package microvm

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strings"

	distributionreference "github.com/distribution/reference"
	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/types"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func snapshotRegistrySchemes() []string {
	return []string{"http", "https"}
}

func (runtime *Runtime) BuildImage(ctx context.Context, request *machinev1alpha1.BuildSnapshotPayload) (string, error) {
	image := request.GetSnapshot()
	if request.GetPushToInternalRegistry() {
		repository, err := snapshotRepository(request.GetRegistry())
		if err != nil {
			return "", fmt.Errorf("resolve build destination: %w", err)
		}
		image = repository + "/" + strings.TrimPrefix(request.GetSnapshot(), "/")
	}
	if err := runtime.engine.BuildImage(ctx, types.BuildRequest{
		Image:                  image,
		LogReference:           request.GetSnapshot(),
		BuildLogUploadURL:      request.GetBuildLogUploadUrl(),
		Registry:               toMicroVMRegistry(request.GetRegistry()),
		SourceRegistries:       toMicroVMRegistries(request.GetSourceRegistries()),
		Dockerfile:             request.GetDockerfile(),
		Contexts:               toMicroVMBuildContexts(request.GetContexts()),
		PushToInternalRegistry: request.GetPushToInternalRegistry(),
		CacheRegistry:          toMicroVMRegistry(request.GetCacheRegistry()),
		Tenant:                 request.GetOwnerId(),
	}); err != nil {
		return "", err
	}
	return image, nil
}

func toMicroVMBuildContexts(contexts []*machinev1alpha1.BuildContext) []types.BuildContextArchive {
	result := make([]types.BuildContextArchive, len(contexts))
	for index, buildContext := range contexts {
		result[index] = types.BuildContextArchive{
			Hash: buildContext.GetHash(), DownloadURL: buildContext.GetDownloadUrl(),
		}
	}
	return result
}

func (runtime *Runtime) PullImage(ctx context.Context, image string, registry *machinev1alpha1.Registry) error {
	return runtime.engine.PullImage(ctx, image, runtime.pullRegistry(image, registry), "")
}

func (runtime *Runtime) pullRegistry(image string, registry *machinev1alpha1.Registry) *types.Registry {
	if registry != nil {
		return toMicroVMRegistry(registry)
	}
	named, err := distributionreference.ParseNormalizedNamed(image)
	if err != nil || !strings.EqualFold(distributionreference.Domain(named), runtime.guestRegistryHost) {
		return nil
	}
	return runtime.guestRegistry
}

func (runtime *Runtime) PublishImage(ctx context.Context, request *machinev1alpha1.PublishSnapshotPayload) error {
	source, destination := request.GetSourceRef(), request.GetDestinationRef()
	if err := runtime.engine.PullImage(ctx, source, toMicroVMRegistry(request.GetSourceRegistry()), ""); err != nil {
		return fmt.Errorf("pull snapshot source %s: %w", source, err)
	}
	if err := runtime.engine.TagImage(ctx, source, destination); err != nil {
		return fmt.Errorf("tag snapshot source as %s: %w", destination, err)
	}
	if err := runtime.engine.PushImage(ctx, destination, toMicroVMRegistry(request.GetDestinationRegistry())); err != nil {
		return fmt.Errorf("push snapshot %s: %w", destination, err)
	}
	if err := runtime.engine.RemoveImage(ctx, source); err != nil {
		return fmt.Errorf("remove snapshot source %s: %w", source, err)
	}
	return nil
}

func (runtime *Runtime) PrepareTemplate(ctx context.Context, image string, template *machinev1alpha1.TemplatePreparation) (string, error) {
	if template == nil {
		return "", errors.New("template preparation specification is required")
	}
	if !runtime.preflight.FirecrackerTemplateAvailable {
		return "", nil
	}
	capabilities, err := toMicroVMCapabilities(template.GetCapabilities())
	if err != nil {
		return "", err
	}
	return runtime.engine.PrepareTemplate(ctx, types.CreateRequest{
		ID:              uuid.NewString(),
		Image:           image,
		ImagePullPolicy: types.ImagePullNever,
		InitialState:    types.InitialStateRunning,
		Hypervisor:      string(hypervisor.HypervisorFirecracker),
		CPUQuota:        int64(template.GetCpuQuota()),
		MemoryQuota:     int64(template.GetMemoryQuota()),
		StorageQuota:    int64(template.GetStorageQuota()),
		ManagedWorkload: true,
		Labels: map[string]string{
			profileLabel: string(hypervisor.InstanceProfileEphemeral),
		},
		Capabilities: capabilities,
	})
}

func (runtime *Runtime) RemoveTemplate(ctx context.Context, key string) error {
	return runtime.engine.RemoveTemplate(ctx, key)
}

func (runtime *Runtime) RemoveImage(ctx context.Context, image string) error {
	return runtime.engine.RemoveImage(ctx, image)
}

func (runtime *Runtime) ImageInfo(ctx context.Context, image string) (sandboxruntime.ImageInfo, error) {
	info, err := runtime.engine.ImageInfo(ctx, image)
	if err != nil {
		return sandboxruntime.ImageInfo{}, err
	}
	return fromMicroVMImageInfo(info), nil
}

func (runtime *Runtime) InspectImageInRegistry(ctx context.Context, image string, registry *machinev1alpha1.Registry) (sandboxruntime.ImageDigest, error) {
	info, err := runtime.engine.InspectImage(ctx, image, toMicroVMRegistry(registry), "")
	if err != nil {
		return sandboxruntime.ImageDigest{}, err
	}
	return sandboxruntime.ImageDigest{Digest: info.Digest, SizeBytes: info.SizeBytes}, nil
}

func (runtime *Runtime) CreateSnapshot(
	ctx context.Context,
	assignment sandboxruntime.Assignment,
	registry *machinev1alpha1.Registry,
) (sandboxruntime.ImageInfo, error) {
	repository, err := snapshotRepository(registry)
	if err != nil {
		return sandboxruntime.ImageInfo{}, err
	}
	if err := runtime.Adopt(ctx, assignment); err != nil {
		return sandboxruntime.ImageInfo{}, err
	}
	info, err := runtime.engine.ExportInstanceImage(ctx, assignment.SandboxID, types.ExportImageRequest{
		Repository: repository,
		NamePrefix: snapshotImagePrefix,
		Tag:        snapshotImageTag,
		Registry:   toMicroVMRegistry(registry),
	})
	if err != nil {
		return sandboxruntime.ImageInfo{}, err
	}
	return fromMicroVMImageInfo(info), nil
}

func fromMicroVMImageInfo(info types.ImageInfo) sandboxruntime.ImageInfo {
	return sandboxruntime.ImageInfo{
		Reference: info.Reference, SizeBytes: info.SizeBytes,
		Entrypoint: slices.Clone(info.Entrypoint), Command: slices.Clone(info.Command),
		Digest: info.Digest,
	}
}

func snapshotRepository(registry *machinev1alpha1.Registry) (string, error) {
	if registry == nil {
		return "", errors.New("registry is required for sandbox snapshot")
	}
	endpoint, err := url.Parse(strings.TrimSpace(registry.GetUrl()))
	if err != nil {
		return "", fmt.Errorf("parse snapshot registry URL: %w", err)
	}
	if endpoint.Host == "" {
		return "", errors.New("snapshot registry URL must include a host")
	}
	if endpoint.User != nil {
		return "", errors.New("snapshot registry URL must not include credentials")
	}
	if !slices.Contains(snapshotRegistrySchemes(), endpoint.Scheme) {
		return "", errors.New("snapshot registry URL must use http or https")
	}
	if strings.Trim(endpoint.Path, "/") != "" || endpoint.RawQuery != "" || endpoint.Fragment != "" {
		return "", errors.New("snapshot registry URL must contain only a scheme and host")
	}
	project := snapshotDefaultProject
	if configured := strings.TrimSpace(registry.GetProject()); configured != "" {
		project = strings.Trim(configured, "/")
	}
	if project == "" || strings.Contains(project, "//") {
		return "", errors.New("snapshot registry project is invalid")
	}
	return endpoint.Host + "/" + project, nil
}
