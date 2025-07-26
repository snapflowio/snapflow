package docker

import (
	"context"

	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/errdefs"
	"github.com/rs/zerolog/log"
)

func (d *DockerClient) RemoveImage(ctx context.Context, imageName string, force bool) error {
	_, err := d.apiClient.ImageRemove(ctx, imageName, image.RemoveOptions{
		Force:         force,
		PruneChildren: true,
	})

	if err != nil {
		if errdefs.IsNotFound(err) {
			log.Info().Msgf("Image %s already removed and not found", imageName)
			return nil
		}

		return err
	}

	log.Info().Msgf("Image %s deleted successfully", imageName)

	return nil
}
