package docker

import (
	"context"
	"io"

	"github.com/snapflow/manager/internal/util"
	"github.com/snapflow/manager/pkg/api/dto"

	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/pkg/jsonmessage"

	log "github.com/sirupsen/logrus"
)

func (d *DockerClient) PushImage(ctx context.Context, imageName string, reg *dto.RegistryDTO) error {
	log.Infof("Pushing image %s...", imageName)

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

	log.Infof("Image %s pushed successfully", imageName)

	return nil
}
