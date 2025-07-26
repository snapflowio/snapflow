package docker

import (
	"context"
	"fmt"

	"github.com/docker/docker/api/types/container"
	"github.com/rs/zerolog/log"
)

func (d *DockerClient) commitContainer(ctx context.Context, containerId, imageName string) error {
	const maxRetries = 3

	for attempt := 1; attempt <= maxRetries; attempt++ {
		log.Info().Msgf("Committing container %s (attempt %d/%d)...", containerId, attempt, maxRetries)

		commitResp, err := d.apiClient.ContainerCommit(ctx, containerId, container.CommitOptions{
			Reference: imageName,
			Pause:     false,
		})
		if err == nil {
			log.Info().Msgf("Container %s committed successfully with image ID: %s", containerId, commitResp.ID)
			return nil
		}

		if attempt < maxRetries {
			log.Warn().Err(err).Msgf("Failed to commit container %s (attempt %d/%d)", containerId, attempt, maxRetries)
			continue
		}

		return fmt.Errorf("failed to commit container after %d attempts: %w", maxRetries, err)
	}

	return nil
}
