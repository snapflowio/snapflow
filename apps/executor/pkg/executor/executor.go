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

var runner *Executor

func GetInstance(config *ExecutorInstanceConfig) *Executor {
	if config != nil && runner != nil {
		log.Fatal("Executor already initialized")
	}

	if runner == nil {
		if config == nil {
			log.Fatal("Executor not initialized")
		}

		runner = &Executor{
			Cache:          config.Cache,
			Docker:         config.Docker,
			SandboxService: config.SandboxService,
		}
	}

	return runner
}
