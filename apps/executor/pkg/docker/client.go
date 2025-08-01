package docker

import (
	"io"
	"sync"

	"github.com/docker/docker/client"
	"github.com/snapflowio/executor/pkg/cache"
)

type DockerClientConfig struct {
	ApiClient          client.APIClient
	Cache              cache.IExecutorCache
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
		bucketMutexes:      make(map[string]*sync.Mutex),
		nodePath:           config.DaemonPath,
	}
}

type DockerClient struct {
	apiClient          client.APIClient
	cache              cache.IExecutorCache
	logWriter          io.Writer
	awsRegion          string
	awsEndpointUrl     string
	awsAccessKeyId     string
	awsSecretAccessKey string
	bucketMutexes      map[string]*sync.Mutex
	bucketMutexesMutex sync.Mutex
	nodePath           string
}
