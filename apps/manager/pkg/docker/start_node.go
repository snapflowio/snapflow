package docker

import (
	"context"

	"github.com/docker/docker/api/types/container"
	"github.com/snapflow/go-common/pkg/timer"

	log "github.com/sirupsen/logrus"
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
		log.Errorf("Error starting Snapflow node: %s", err.Error())
		return nil
	}

	if result.ExitCode != 0 && result.StdErr != "" {
		log.Errorf("Error starting Snapflow node: %s", string(result.StdErr))
		return nil
	}

	return nil
}
