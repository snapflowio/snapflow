package docker

import (
	"context"
	"fmt"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/errdefs"
	"github.com/rs/zerolog/log"
	"github.com/snapflow/executor/pkg/common"
	"github.com/snapflow/executor/pkg/models/enums"
)

func (d *DockerClient) Destroy(ctx context.Context, containerId string) error {
	startTime := time.Now()
	defer func() {
		obs, err := common.ContainerOperationDuration.GetMetricWithLabelValues("destroy")
		if err == nil {
			obs.Observe(time.Since(startTime).Seconds())
		}
	}()

	// Ignore err because we want to destroy the container even if it exited
	state, _ := d.DeduceSandboxState(ctx, containerId)
	if state == enums.SandboxStateDestroyed || state == enums.SandboxStateDestroying {
		return nil
	}

	d.cache.SetSandboxState(ctx, containerId, enums.SandboxStateDestroying)

	_, err := d.ContainerInspect(ctx, containerId)
	if err != nil {
		if errdefs.IsNotFound(err) {
			d.cache.SetSandboxState(ctx, containerId, enums.SandboxStateDestroyed)
		}
		return err
	}

	err = d.apiClient.ContainerRemove(ctx, containerId, container.RemoveOptions{
		Force: true,
	})
	if err != nil {
		if errdefs.IsNotFound(err) {
			d.cache.SetSandboxState(ctx, containerId, enums.SandboxStateDestroyed)
		}
		return err
	}

	d.cache.SetSandboxState(ctx, containerId, enums.SandboxStateDestroyed)

	return nil
}

func (d *DockerClient) RemoveDestroyed(ctx context.Context, containerId string) error {

	// Check if container exists and is in destroyed state
	state, err := d.DeduceSandboxState(ctx, containerId)
	if err != nil {
		return err
	}

	if state != enums.SandboxStateDestroyed {
		return common.NewBadRequestError(fmt.Errorf("container %s is not in destroyed state", containerId))
	}

	// Remove the container
	err = d.apiClient.ContainerRemove(ctx, containerId, container.RemoveOptions{
		Force: true,
	})
	if err != nil {
		if errdefs.IsNotFound(err) {
			return nil // Container already removed
		}
		return err
	}

	log.Info().Msgf("Destroyed container %s removed successfully", containerId)

	return nil
}
