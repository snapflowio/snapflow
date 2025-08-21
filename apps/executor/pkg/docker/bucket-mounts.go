package docker

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"

	log "github.com/sirupsen/logrus"
	"github.com/snapflowio/executor/cmd/executor/config"
	"github.com/snapflowio/executor/internal/util"
	"github.com/snapflowio/executor/pkg/api/dto"
)

func (d *DockerClient) getBucketsMountPathBinds(ctx context.Context, volumes []dto.BucketDTO) ([]string, error) {
	volumeMountPathBinds := make([]string, 0)

	for _, vol := range volumes {
		volumeIdPrefixed := fmt.Sprintf("daytona-volume-%s", vol.BucketId)
		executorBucketMountPath := d.getRunnerBucketMountPath(volumeIdPrefixed)

		// Get or create mutex for this volume
		d.volumeMutexesMutex.Lock()
		volumeMutex, exists := d.volumeMutexes[volumeIdPrefixed]
		if !exists {
			volumeMutex = &sync.Mutex{}
			d.volumeMutexes[volumeIdPrefixed] = volumeMutex
		}
		d.volumeMutexesMutex.Unlock()

		// Lock this specific volume's mutex
		volumeMutex.Lock()
		defer volumeMutex.Unlock()

		if d.isDirectoryMounted(executorBucketMountPath) {
			log.Infof("volume %s is already mounted to %s", volumeIdPrefixed, executorBucketMountPath)
			volumeMountPathBinds = append(volumeMountPathBinds, fmt.Sprintf("%s/:%s/", executorBucketMountPath, vol.MountPath))
			continue
		}

		err := os.MkdirAll(executorBucketMountPath, 0755)
		if err != nil {
			return nil, fmt.Errorf("failed to create mount directory %s: %s", executorBucketMountPath, err)
		}

		log.Infof("mounting S3 volume %s to %s", volumeIdPrefixed, executorBucketMountPath)

		cmd := d.getMountCmd(ctx, volumeIdPrefixed, executorBucketMountPath)
		err = cmd.Run()
		if err != nil {
			return nil, fmt.Errorf("failed to mount S3 volume %s to %s: %s", volumeIdPrefixed, executorBucketMountPath, err)
		}

		log.Infof("mounted S3 volume %s to %s", volumeIdPrefixed, executorBucketMountPath)

		volumeMountPathBinds = append(volumeMountPathBinds, fmt.Sprintf("%s/:%s/", executorBucketMountPath, vol.MountPath))
	}

	return volumeMountPathBinds, nil
}

func (d *DockerClient) getRunnerBucketMountPath(volumeId string) string {
	volumePath := filepath.Join("/mnt", volumeId)
	if config.GetEnvironment() == "development" {
		volumePath = filepath.Join("/tmp", volumeId)
	}

	return volumePath
}

func (d *DockerClient) isDirectoryMounted(path string) bool {
	cmd := exec.Command("mountpoint", path)
	_, err := cmd.Output()

	return err == nil
}

func (d *DockerClient) getMountCmd(ctx context.Context, volume, path string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, "mount-s3", "--allow-other", "--allow-delete", "--allow-overwrite", "--file-mode", "0666", "--dir-mode", "0777", volume, path)

	if d.awsEndpointUrl != "" {
		cmd.Env = append(cmd.Env, "AWS_ENDPOINT_URL="+d.awsEndpointUrl)
	}

	if d.awsAccessKeyId != "" {
		cmd.Env = append(cmd.Env, "AWS_ACCESS_KEY_ID="+d.awsAccessKeyId)
	}

	if d.awsSecretAccessKey != "" {
		cmd.Env = append(cmd.Env, "AWS_SECRET_ACCESS_KEY="+d.awsSecretAccessKey)
	}

	if d.awsRegion != "" {
		cmd.Env = append(cmd.Env, "AWS_REGION="+d.awsRegion)
	}

	cmd.Stderr = io.Writer(&util.ErrorLogWriter{})
	cmd.Stdout = io.Writer(&util.InfoLogWriter{})

	return cmd
}
