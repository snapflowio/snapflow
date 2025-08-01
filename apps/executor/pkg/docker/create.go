package docker

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/docker/docker/errdefs"
	"github.com/rs/zerolog/log"
	"github.com/snapflowio/executor/internal/constants"
	"github.com/snapflowio/executor/pkg/api/dto"
	"github.com/snapflowio/executor/pkg/common"
	"github.com/snapflowio/executor/pkg/models/enums"
	"github.com/snapflowio/go-common/pkg/timer"
)

func (d *DockerClient) Create(ctx context.Context, sandboxDto dto.CreateSandboxDTO) (string, error) {
	defer timer.Timer()()

	startTime := time.Now()
	defer func() {
		obs, err := common.ContainerOperationDuration.GetMetricWithLabelValues("create")
		if err == nil {
			obs.Observe(time.Since(startTime).Seconds())
		}
	}()

	state, err := d.DeduceSandboxState(ctx, sandboxDto.Id)
	if err != nil && state == enums.SandboxStateError {
		return "", err
	}

	if state == enums.SandboxStateStarted || state == enums.SandboxStatePullingImage || state == enums.SandboxStateStarting {
		return sandboxDto.Id, nil
	}

	if state == enums.SandboxStateStopped || state == enums.SandboxStateCreating {
		err = d.Start(ctx, sandboxDto.Id)
		if err != nil {
			return "", err
		}

		return sandboxDto.Id, nil
	}

	d.cache.SetSandboxState(ctx, sandboxDto.Id, enums.SandboxStateCreating)

	ctx = context.WithValue(ctx, constants.ID_KEY, sandboxDto.Id)
	err = d.PullImage(ctx, sandboxDto.Image, sandboxDto.Registry)
	if err != nil {
		return "", err
	}

	d.cache.SetSandboxState(ctx, sandboxDto.Id, enums.SandboxStateCreating)

	err = d.validateImageArchitecture(ctx, sandboxDto.Image)
	if err != nil {
		log.Error().Err(err).Msg("ERROR")
		return "", err
	}

	bucketMountPathBinds := make([]string, 0)
	if sandboxDto.Buckets != nil {
		bucketMountPathBinds, err = d.getBucketsMountPathBinds(ctx, sandboxDto.Buckets)
		if err != nil {
			return "", err
		}
	}

	containerConfig, hostConfig, networkingConfig, err := d.getContainerConfigs(ctx, sandboxDto, bucketMountPathBinds)
	if err != nil {
		return "", err
	}

	c, err := d.apiClient.ContainerCreate(ctx, containerConfig, hostConfig, networkingConfig, nil, sandboxDto.Id)
	if err != nil {
		return "", err
	}

	err = d.Start(ctx, sandboxDto.Id)
	if err != nil {
		return "", err
	}

	return c.ID, nil
}

func (p *DockerClient) validateImageArchitecture(ctx context.Context, image string) error {
	defer timer.Timer()()

	inspect, _, err := p.apiClient.ImageInspectWithRaw(ctx, image)
	if err != nil {
		if errdefs.IsNotFound(err) {
			return err
		}
		return fmt.Errorf("failed to inspect image: %w", err)
	}

	arch := strings.ToLower(inspect.Architecture)
	validArchs := []string{"amd64", "x86_64"}

	for _, validArch := range validArchs {
		if arch == validArch {
			return nil
		}
	}

	return common.NewConflictError(fmt.Errorf("image %s architecture (%s) is not x64 compatible", image, inspect.Architecture))
}
