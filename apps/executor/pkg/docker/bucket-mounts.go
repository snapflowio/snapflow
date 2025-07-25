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
	"github.com/snapflow/executor/cmd/executor/config"
	"github.com/snapflow/executor/internal/util"
	"github.com/snapflow/executor/pkg/api/dto"
)

func (d *DockerClient) getBucketsMountPathBinds(ctx context.Context, buckets []dto.BucketDTO) ([]string, error) {
	bucketMountPathBinds := make([]string, 0)

	for _, vol := range buckets {
		bucketIdPrefixed := fmt.Sprintf("snapflow-bucket-%s", vol.BucketId)
		executorBucketMountPath := d.getExecutorBucketMountPath(bucketIdPrefixed)

		// Get or create mutex for this bucket
		d.bucketMutexesMutex.Lock()
		bucketMutex, exists := d.bucketMutexes[bucketIdPrefixed]
		if !exists {
			bucketMutex = &sync.Mutex{}
			d.bucketMutexes[bucketIdPrefixed] = bucketMutex
		}
		d.bucketMutexesMutex.Unlock()

		// Lock this specific bucket's mutex
		bucketMutex.Lock()
		defer bucketMutex.Unlock()

		if d.isDirectoryMounted(executorBucketMountPath) {
			log.Infof("bucket %s is already mounted to %s", bucketIdPrefixed, executorBucketMountPath)
			bucketMountPathBinds = append(bucketMountPathBinds, fmt.Sprintf("%s/:%s/", executorBucketMountPath, vol.MountPath))
			continue
		}

		err := os.MkdirAll(executorBucketMountPath, 0755)
		if err != nil {
			return nil, fmt.Errorf("failed to create mount directory %s: %s", executorBucketMountPath, err)
		}

		log.Infof("mounting S3 bucket %s to %s", bucketIdPrefixed, executorBucketMountPath)

		cmd := d.getMountCmd(ctx, bucketIdPrefixed, executorBucketMountPath)
		err = cmd.Run()
		if err != nil {
			return nil, fmt.Errorf("failed to mount S3 bucket %s to %s: %s", bucketIdPrefixed, executorBucketMountPath, err)
		}

		log.Infof("mounted S3 bucket %s to %s", bucketIdPrefixed, executorBucketMountPath)

		bucketMountPathBinds = append(bucketMountPathBinds, fmt.Sprintf("%s/:%s/", executorBucketMountPath, vol.MountPath))
	}

	return bucketMountPathBinds, nil
}

func (d *DockerClient) getExecutorBucketMountPath(bucketId string) string {
	bucketPath := filepath.Join("/mnt", bucketId)
	if config.GetEnvironment() == "development" {
		bucketPath = filepath.Join("/tmp", bucketId)
	}

	return bucketPath
}

func (d *DockerClient) isDirectoryMounted(path string) bool {
	cmd := exec.Command("mountpoint", path)
	_, err := cmd.Output()

	return err == nil
}

func (d *DockerClient) getMountCmd(ctx context.Context, bucket, path string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, "mount-s3", "--allow-other", "--allow-delete", "--allow-overwrite", "--file-mode", "0666", "--dir-mode", "0777", bucket, path)

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
