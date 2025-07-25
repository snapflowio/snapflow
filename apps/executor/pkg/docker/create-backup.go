package docker

import (
	"context"

	"github.com/snapflow/executor/pkg/api/dto"
	"github.com/snapflow/executor/pkg/models/enums"

	log "github.com/sirupsen/logrus"
)

func (d *DockerClient) CreateBackup(ctx context.Context, containerId string, backupDto dto.CreateBackupDTO) error {
	d.cache.SetBackupState(ctx, containerId, enums.BackupStatePending)

	log.Infof("Creating backup for container %s...", containerId)

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

	log.Infof("Backp (%s) for container %s created successfully", backupDto.Image, containerId)

	err = d.RemoveImage(ctx, backupDto.Image, true)
	if err != nil {
		log.Errorf("Error removing image %s: %v", backupDto.Image, err)
	}

	return nil
}
