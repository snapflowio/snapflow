package docker

import (
	"io"
	"sync"

	"github.com/docker/docker/client"
	"github.com/snapflow/manager/pkg/cache"
)

type DockerClientConfig struct {
	ApiClient          client.APIClient
	Cache              cache.IRunnerCache
	LogWriter          io.Writer
	AWSRegion          string
	AWSEndpointUrl     string
	AWSAccessKeyId     string
	AWSSecretAccessKey string
	DaemonPath         string
}

func NewDockerClient(config DockerClientConfig) *DockerClient {
	return &DockerClient{
		apiClient:          config.ApiClient,
		cache:              config.Cache,
		logWriter:          config.LogWriter,
		awsRegion:          config.AWSRegion,
		awsEndpointUrl:     config.AWSEndpointUrl,
		awsAccessKeyId:     config.AWSAccessKeyId,
		awsSecretAccessKey: config.AWSSecretAccessKey,
		volumeMutexes:      make(map[string]*sync.Mutex),
		daemonPath:         config.DaemonPath,
	}
}

type DockerClient struct {
	apiClient          client.APIClient
	cache              cache.IRunnerCache
	logWriter          io.Writer
	awsRegion          string
	awsEndpointUrl     string
	awsAccessKeyId     string
	awsSecretAccessKey string
	volumeMutexes      map[string]*sync.Mutex
	volumeMutexesMutex sync.Mutex
	daemonPath         string
}
