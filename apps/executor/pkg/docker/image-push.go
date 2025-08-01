package docker

import (
	"context"
	"io"

	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/pkg/jsonmessage"
	"github.com/rs/zerolog/log"
	"github.com/snapflowio/executor/internal/util"
	"github.com/snapflowio/executor/pkg/api/dto"
)

func (d *DockerClient) PushImage(ctx context.Context, imageName string, reg *dto.RegistryDTO) error {
	log.Info().Msgf("Pushing image %s...", imageName)

	responseBody, err := d.apiClient.ImagePush(ctx, imageName, image.PushOptions{
		RegistryAuth: getRegistryAuth(reg),
	})
	if err != nil {
		return err
	}

	defer responseBody.Close()

	err = jsonmessage.DisplayJSONMessagesStream(responseBody, io.Writer(&util.DebugLogWriter{}), 0, true, nil)
	if err != nil {
		return err
	}

	log.Info().Msgf("Image %s pushed successfully", imageName)

	return nil
}
