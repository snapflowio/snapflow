package docker

import (
	"context"

	"github.com/rs/zerolog/log"
	"github.com/snapflowio/executor/pkg/api/dto"
	"github.com/snapflowio/executor/pkg/models/enums"
)

func (d *DockerClient) CreateBackup(ctx context.Context, containerId string, backupDto dto.CreateBackupDTO) error {
	d.cache.SetBackupState(ctx, containerId, enums.BackupStatePending)

	log.Info().Msgf("Creating backup for container %s...", containerId)

	d.cache.SetBackupState(ctx, containerId, enums.BackupStateInProgress)

	err := d.commitContainer(ctx, containerId, backupDto.Image)
	if err != nil {
		return err
	}

	err = d.PushImage(ctx, backupDto.Image, &backupDto.Registry)
	if err != nil {
		return err
	}

	d.cache.SetBackupState(ctx, containerId, enums.BackupStateCompleted)

	log.Info().Msgf("Backp (%s) for container %s created successfully", backupDto.Image, containerId)

	err = d.RemoveImage(ctx, backupDto.Image, true)
	if err != nil {
		log.Error().Err(err).Msgf("Error removing image %s", backupDto.Image)
	}

	return nil
}
