package docker

import (
	"io"
	"sync"

	"github.com/docker/docker/client"
	"github.com/snapflowio/executor/pkg/cache"
)

type DockerClientConfig struct {
	ApiClient             client.APIClient
	Cache                 cache.IExecutorCache
	LogWriter             io.Writer
	AWSRegion             string
	AWSEndpointUrl        string
	AWSAccessKeyId        string
	AWSSecretAccessKey    string
	NodePath              string
	ComputerUsePluginPath string
}

func NewDockerClient(config DockerClientConfig) *DockerClient {
	return &DockerClient{
		apiClient:             config.ApiClient,
		cache:                 config.Cache,
		logWriter:             config.LogWriter,
		awsRegion:             config.AWSRegion,
		awsEndpointUrl:        config.AWSEndpointUrl,
		awsAccessKeyId:        config.AWSAccessKeyId,
		awsSecretAccessKey:    config.AWSSecretAccessKey,
		volumeMutexes:         make(map[string]*sync.Mutex),
		nodePath:              config.NodePath,
		computerUsePluginPath: config.ComputerUsePluginPath,
	}
}

func (d *DockerClient) ApiClient() client.APIClient {
	return d.apiClient
}

type DockerClient struct {
	apiClient             client.APIClient
	cache                 cache.IExecutorCache
	logWriter             io.Writer
	awsRegion             string
	awsEndpointUrl        string
	awsAccessKeyId        string
	awsSecretAccessKey    string
	volumeMutexes         map[string]*sync.Mutex
	volumeMutexesMutex    sync.Mutex
	nodePath              string
	computerUsePluginPath string
}
