package docker

import (
	"context"

	"github.com/docker/docker/api/types"
)

func (d *DockerClient) ContainerInspect(ctx context.Context, containerId string) (types.ContainerJSON, error) {
	return d.apiClient.ContainerInspect(ctx, containerId)
}
