package docker

import (
	"context"
	"strings"

	"github.com/docker/docker/api/types/image"
	"github.com/rs/zerolog/log"
)

func (d *DockerClient) ImageExists(ctx context.Context, imageName string, includeLatest bool) (bool, error) {
	imageName = strings.Replace(imageName, "docker.io/", "", 1)

	if strings.HasSuffix(imageName, ":latest") && !includeLatest {
		return false, nil
	}

	images, err := d.apiClient.ImageList(ctx, image.ListOptions{})
	if err != nil {
		return false, err
	}

	found := false
	for _, image := range images {
		for _, tag := range image.RepoTags {
			if strings.HasPrefix(tag, imageName) {
				found = true
				break
			}
		}
	}

	if found {
		log.Info().Msgf("Image %s already pulled", imageName)
	}

	return found, nil
}
