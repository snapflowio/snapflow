package executor

import (
	"log"

	"github.com/snapflowio/executor/pkg/cache"
	"github.com/snapflowio/executor/pkg/docker"
	"github.com/snapflowio/executor/pkg/services"
)

type ExecutorInstanceConfig struct {
	Cache          cache.IExecutorCache
	Docker         *docker.DockerClient
	SandboxService *services.SandboxService
	MetricsService *services.MetricsService
}

type Executor struct {
	Cache          cache.IExecutorCache
	Docker         *docker.DockerClient
	SandboxService *services.SandboxService
	MetricsService *services.MetricsService
}

var executor *Executor

func GetInstance(config *ExecutorInstanceConfig) *Executor {
	if config != nil && executor != nil {
		log.Fatal("Executor already initialized")
	}

	if executor == nil {
		if config == nil {
			log.Fatal("Executor not initialized")
		}

		executor = &Executor{
			Cache:          config.Cache,
			Docker:         config.Docker,
			SandboxService: config.SandboxService,
		}
	}

	return executor
}
