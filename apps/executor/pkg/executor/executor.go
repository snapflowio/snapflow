package executor

import (
	"log"

	"github.com/snapflow/executor/pkg/cache"
	"github.com/snapflow/executor/pkg/docker"
	"github.com/snapflow/executor/pkg/services"
)

type ExecutorInstanceConfig struct {
	Cache          cache.IExecutorCache
	Docker         *docker.DockerClient
	SandboxService *services.SandboxService
}

type Executor struct {
	Cache          cache.IExecutorCache
	Docker         *docker.DockerClient
	SandboxService *services.SandboxService
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
