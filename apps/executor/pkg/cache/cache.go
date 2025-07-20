package cache

import (
	"context"
	"sync"
	"time"

	"github.com/snapflow/executor/pkg/models"
	"github.com/snapflow/executor/pkg/models/enums"
)

type IExecutorCache interface {
	SetSandboxState(ctx context.Context, sandboxId string, state enums.SandboxState)
	SetBackupState(ctx context.Context, sandboxId string, state enums.BackupState)

	Set(ctx context.Context, sandboxId string, data models.CacheData)
	Get(ctx context.Context, sandboxId string) *models.CacheData
	Remove(ctx context.Context, sandboxId string)
	List(ctx context.Context) []string
	Cleanup(ctx context.Context)
}

type InMemoryExecutorCacheConfig struct {
	Cache         map[string]*models.CacheData
	RetentionDays int
}

type InMemoryExecutorCache struct {
	mutex         sync.RWMutex
	cache         map[string]*models.CacheData
	retentionDays int
}

func NewInMemoryExecutorCache(config InMemoryExecutorCacheConfig) IExecutorCache {
	retentionDays := config.RetentionDays
	if retentionDays <= 0 {
		retentionDays = 7
	}

	cache := config.Cache
	if cache == nil {
		cache = make(map[string]*models.CacheData)
	}

	return &InMemoryExecutorCache{
		cache:         cache,
		retentionDays: config.RetentionDays,
	}
}

func (c *InMemoryExecutorCache) SetSandboxState(ctx context.Context, sandboxId string, state enums.SandboxState) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	data, ok := c.cache[sandboxId]
	if !ok {
		data = &models.CacheData{
			SandboxState:    state,
			BackupState:     enums.BackupStateNone,
			DestructionTime: nil,
		}
	} else {
		data.SandboxState = state
	}

	c.cache[sandboxId] = data
}

func (c *InMemoryExecutorCache) SetBackupState(ctx context.Context, sandboxId string, state enums.BackupState) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	data, ok := c.cache[sandboxId]
	if !ok {
		data = &models.CacheData{
			SandboxState:    enums.SandboxStateUnknown,
			BackupState:     state,
			DestructionTime: nil,
		}
	} else {
		data.BackupState = state
	}

	c.cache[sandboxId] = data
}

func (c *InMemoryExecutorCache) Set(ctx context.Context, sandboxId string, data models.CacheData) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	c.cache[sandboxId] = &models.CacheData{
		SandboxState:    data.SandboxState,
		BackupState:     data.BackupState,
		DestructionTime: data.DestructionTime,
	}
}

func (c *InMemoryExecutorCache) Get(ctx context.Context, sandboxId string) *models.CacheData {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	data, ok := c.cache[sandboxId]
	if !ok {
		data = &models.CacheData{
			SandboxState:    enums.SandboxStateUnknown,
			BackupState:     enums.BackupStateNone,
			DestructionTime: nil,
		}
	}

	return data
}

func (c *InMemoryExecutorCache) Remove(ctx context.Context, sandboxId string) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	destructionTime := time.Now().Add(time.Duration(c.retentionDays) * 24 * time.Hour)
	c.cache[sandboxId] = &models.CacheData{
		SandboxState:    enums.SandboxStateDestroyed,
		BackupState:     enums.BackupStateNone,
		DestructionTime: &destructionTime,
	}
}

func (c *InMemoryExecutorCache) List(ctx context.Context) []string {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	keys := make([]string, 0, len(c.cache))
	for k := range c.cache {
		keys = append(keys, k)
	}

	return keys
}

func (c *InMemoryExecutorCache) Cleanup(ctx context.Context) {
	go func() {
		// Run cleanup every hour
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				c.cleanupExpiredEntries()
			case <-ctx.Done():
				return
			}
		}
	}()
}

func (c *InMemoryExecutorCache) cleanupExpiredEntries() {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	now := time.Now()
	for id, data := range c.cache {
		if data.DestructionTime != nil && (now.After(*data.DestructionTime) || now.Equal(*data.DestructionTime)) {
			delete(c.cache, id)
		}
	}
}
