package services

import (
	"context"

	"github.com/snapflow/executor/pkg/cache"
	"github.com/snapflow/executor/pkg/docker"
	"github.com/snapflow/executor/pkg/models"
	"github.com/snapflow/executor/pkg/models/enums"
)

type SandboxService struct {
	cache  cache.IExecutorCache
	docker *docker.DockerClient
}

func NewSandboxService(cache cache.IExecutorCache, docker *docker.DockerClient) *SandboxService {
	return &SandboxService{
		cache:  cache,
		docker: docker,
	}
}

func (s *SandboxService) GetSandboxStatesInfo(ctx context.Context, sandboxId string) *models.CacheData {
	sandboxState, err := s.docker.DeduceSandboxState(ctx, sandboxId)
	if err == nil {
		s.cache.SetSandboxState(ctx, sandboxId, sandboxState)
	}

	data := s.cache.Get(ctx, sandboxId)

	if data == nil {
		return &models.CacheData{
			SandboxState:    enums.SandboxStateUnknown,
			BackupState:     enums.BackupStateNone,
			DestructionTime: nil,
		}
	}

	return data
}

func (s *SandboxService) RemoveDestroyedSandbox(ctx context.Context, sandboxId string) error {
	info := s.GetSandboxStatesInfo(ctx, sandboxId)

	if info != nil && info.SandboxState != enums.SandboxStateDestroyed && info.SandboxState != enums.SandboxStateDestroying {
		err := s.docker.Destroy(ctx, sandboxId)
		if err != nil {
			return err
		}
	}

	return nil
}
