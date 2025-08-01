package docker

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"strings"

	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/registry"
	"github.com/docker/docker/pkg/jsonmessage"
	"github.com/rs/zerolog/log"
	"github.com/snapflowio/executor/internal/constants"
	"github.com/snapflowio/executor/internal/util"
	"github.com/snapflowio/executor/pkg/api/dto"
	"github.com/snapflowio/executor/pkg/models/enums"
	"github.com/snapflowio/go-common/pkg/timer"
)

func (d *DockerClient) PullImage(ctx context.Context, imageName string, reg *dto.RegistryDTO) error {
	defer timer.Timer()()

	tag := "latest"
	lastColonIndex := strings.LastIndex(imageName, ":")
	if lastColonIndex != -1 {
		tag = imageName[lastColonIndex+1:]
	}

	if tag != "latest" {
		exists, err := d.ImageExists(ctx, imageName, true)
		if err != nil {
			return err
		}

		if exists {
			return nil
		}
	}

	log.Info().Msgf("Pulling image %s...", imageName)

	sandboxIdValue := ctx.Value(constants.ID_KEY)

	if sandboxIdValue != nil {
		sandboxId := sandboxIdValue.(string)
		d.cache.SetSandboxState(ctx, sandboxId, enums.SandboxStatePullingImage)
	}

	responseBody, err := d.apiClient.ImagePull(ctx, imageName, image.PullOptions{
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

	log.Info().Msgf("Image %s pulled successfully", imageName)

	return nil
}

func getRegistryAuth(reg *dto.RegistryDTO) string {
	if reg == nil {
		// Sometimes registry auth fails if "" is sent, so sending "empty" instead
		return "empty"
	}

	authConfig := registry.AuthConfig{
		Username: reg.Username,
		Password: reg.Password,
	}
	encodedJSON, err := json.Marshal(authConfig)
	if err != nil {
		// Sometimes registry auth fails if "" is sent, so sending "empty" instead
		return "empty"
	}

	return base64.URLEncoding.EncodeToString(encodedJSON)
}
