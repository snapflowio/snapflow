package docker

import (
	"context"

	"github.com/docker/docker/api/types/container"
	"github.com/rs/zerolog/log"
	"github.com/snapflowio/go-common/pkg/timer"
)

func (d *DockerClient) startSnapflowNode(ctx context.Context, containerId string) error {
	defer timer.Timer()()

	execOptions := container.ExecOptions{
		Cmd:          []string{"sh", "-c", "/usr/local/bin/snapflow"},
		AttachStdout: true,
		AttachStderr: true,
		Tty:          true,
	}

	execStartOptions := container.ExecStartOptions{
		Detach: false,
	}

	result, err := d.execSync(ctx, containerId, execOptions, execStartOptions)
	if err != nil {
		log.Error().Err(err).Msg("Error starting Snapflow node")
		return nil
	}

	if result.ExitCode != 0 && result.StdErr != "" {
		log.Error().Msgf("Error starting Snapflow node: %s", string(result.StdErr))
		return nil
	}

	return nil
}
