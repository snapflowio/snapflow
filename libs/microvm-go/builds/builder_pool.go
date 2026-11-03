// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0
package builds

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/moby/buildkit/client"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/runtimeplatform"
	"github.com/snapflowio/microvm-go/layout"
)

var errBuilderReconfiguring = errors.New("the organization builder is busy with a different daemon configuration")

type warmBuilder struct {
	key       string
	id        string
	config    []byte
	client    *client.Client
	ready     chan struct{}
	startErr  error
	active    int
	lastUsed  time.Time
	phases    BuilderPhases
	readyTime time.Duration
}

type builderLease struct {
	pool    *builderPool
	builder *warmBuilder
	cold    bool
}

type builderPool struct {
	machine  BuilderMachine
	paths    layout.Paths
	config   Config
	capacity int
	now      func() time.Time
	ready    func(context.Context, *client.Client) error
	mu       sync.Mutex
	builders map[string]*warmBuilder
}

func newBuilderPool(machine BuilderMachine, paths layout.Paths, config Config) *builderPool {
	return &builderPool{
		machine:  machine,
		paths:    paths,
		config:   config,
		capacity: config.MaxConcurrent,
		now:      time.Now,
		ready:    waitForDaemon,
		builders: make(map[string]*warmBuilder),
	}
}

func tenantKey(tenant string) string {
	digest := sha256.Sum256([]byte(tenant))
	return hex.EncodeToString(digest[:builderTenantKeyBytes])
}

func (pool *builderPool) acquire(ctx context.Context, tenant string, daemonConfig []byte) (builderLease, error) {
	key := tenantKey(tenant)
	pool.mu.Lock()
	if existing, found := pool.builders[key]; found {
		if !bytes.Equal(existing.config, daemonConfig) {
			if existing.active > 0 {
				pool.mu.Unlock()
				return builderLease{}, errBuilderReconfiguring
			}
			delete(pool.builders, key)
			pool.mu.Unlock()
			pool.stop(ctx, existing)
			return pool.acquire(ctx, tenant, daemonConfig)
		}
		existing.active++
		pool.mu.Unlock()
		return pool.awaitReady(ctx, existing)
	}
	evicted := pool.evictLeastRecentlyUsedLocked()
	builder := &warmBuilder{key: key, id: uuid.NewString(), config: daemonConfig, ready: make(chan struct{}), active: 1}
	pool.builders[key] = builder
	pool.mu.Unlock()
	if evicted != nil {
		pool.stop(ctx, evicted)
	}
	builder.startErr = pool.start(ctx, builder)
	if builder.startErr != nil {
		pool.mu.Lock()
		delete(pool.builders, key)
		pool.mu.Unlock()
		close(builder.ready)
		pool.stop(ctx, builder)
		return builderLease{}, builder.startErr
	}
	close(builder.ready)
	return builderLease{pool: pool, builder: builder, cold: true}, nil
}

func (pool *builderPool) awaitReady(ctx context.Context, builder *warmBuilder) (builderLease, error) {
	select {
	case <-builder.ready:
	case <-ctx.Done():
		pool.release(ctx, builder, true)
		return builderLease{}, fmt.Errorf("wait for organization builder: %w", ctx.Err())
	}
	if builder.startErr != nil {
		return builderLease{}, builder.startErr
	}
	return builderLease{pool: pool, builder: builder}, nil
}

func (pool *builderPool) evictLeastRecentlyUsedLocked() *warmBuilder {
	if len(pool.builders) < pool.capacity {
		return nil
	}
	var oldest *warmBuilder
	for _, candidate := range pool.builders {
		if candidate.active > 0 {
			continue
		}
		if oldest == nil || candidate.lastUsed.Before(oldest.lastUsed) {
			oldest = candidate
		}
	}
	if oldest != nil {
		delete(pool.builders, oldest.key)
	}
	return oldest
}

func (pool *builderPool) start(ctx context.Context, builder *warmBuilder) error {
	stateDisk, err := pool.ensureStateDisk(ctx, builder.key)
	if err != nil {
		return err
	}
	startedAt := time.Now()
	builder.phases, err = pool.machine.StartBuilder(ctx, BuilderSpec{
		ID:           builder.id,
		BuilderImage: pool.config.BuilderImage,
		Platform:     runtimeplatform.CurrentContainerPlatform(),
		StateDisk:    stateDisk,
		StateMount:   builderStateMount,
		Command:      builderDaemonCommand(),
		ConfigFile:   BuilderFile{Path: builderDaemonConfig, Content: builder.config},
		CPUVCPUs:     pool.config.CPUVCPUs,
		MemoryGiB:    pool.config.MemoryGiB,
		WorkspaceGiB: pool.config.WorkspaceGiB,
	})
	if err != nil {
		return fmt.Errorf("start organization builder: %w", err)
	}
	builder.client, err = client.New(ctx, builderDaemonAddress, client.WithContextDialer(func(dialCtx context.Context, address string) (net.Conn, error) {
		return pool.machine.DialBuilder(dialCtx, builder.id, builderDaemonPort)
	}))
	if err != nil {
		return fmt.Errorf("connect to organization builder: %w", err)
	}
	if err := pool.ready(ctx, builder.client); err != nil {
		return err
	}
	builder.readyTime = time.Since(startedAt)
	return nil
}

func waitForDaemon(ctx context.Context, daemon *client.Client) error {
	readyCtx, cancel := context.WithTimeout(ctx, builderDaemonReadyTimeout)
	defer cancel()
	ticker := time.NewTicker(builderDaemonPollInterval)
	defer ticker.Stop()
	for {
		lastErr := probeDaemon(readyCtx, daemon)
		if lastErr == nil {
			return nil
		}
		select {
		case <-readyCtx.Done():
			return fmt.Errorf("wait for BuildKit in the organization builder: %w", errors.Join(readyCtx.Err(), lastErr))
		case <-ticker.C:
		}
	}
}

func probeDaemon(ctx context.Context, daemon *client.Client) error {
	probeCtx, cancel := context.WithTimeout(ctx, builderDaemonProbeTimeout)
	defer cancel()
	_, err := daemon.ListWorkers(probeCtx)
	return err
}

func (pool *builderPool) ensureStateDisk(ctx context.Context, key string) (string, error) {
	path := pool.paths.SystemBuilderState(key)
	if err := os.MkdirAll(filepath.Dir(path), builderStateDirPermission); err != nil {
		return "", fmt.Errorf("create organization builder state directory: %w", err)
	}
	now := pool.now()
	err := os.Chtimes(path, now, now)
	if err == nil {
		return path, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return "", fmt.Errorf("record organization builder state use: %w", err)
	}
	empty, err := os.MkdirTemp(filepath.Dir(path), "empty-")
	if err != nil {
		return "", fmt.Errorf("prepare organization builder state disk: %w", err)
	}
	_, createErr := imagecache.CreateExt4Disk(ctx, empty, path, pool.config.WorkspaceGiB*bytesPerGiB)
	if err := errors.Join(createErr, os.Remove(empty)); err != nil {
		return "", fmt.Errorf("create organization builder state disk: %w", err)
	}
	return path, nil
}

func (pool *builderPool) release(ctx context.Context, builder *warmBuilder, healthy bool) {
	pool.mu.Lock()
	builder.active--
	builder.lastUsed = pool.now()
	discard := !healthy && pool.builders[builder.key] == builder
	if discard {
		delete(pool.builders, builder.key)
	}
	pool.mu.Unlock()
	if discard {
		pool.stop(ctx, builder)
	}
}

func (pool *builderPool) stop(ctx context.Context, builder *warmBuilder) {
	stopContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), builderStopTimeout)
	defer cancel()
	var stopErrors []error
	if builder.client != nil {
		stopErrors = append(stopErrors, builder.client.Close())
	}
	stopErrors = append(stopErrors, pool.machine.StopBuilder(stopContext, builder.id))
	if err := errors.Join(stopErrors...); err != nil {
		slog.Warn("could not stop organization builder", "builder_id", builder.id, "error", err)
	}
}

func (lease builderLease) client() *client.Client {
	return lease.builder.client
}

func (lease builderLease) finish(ctx context.Context, buildErr error) {
	healthy := buildErr == nil || probeDaemon(context.WithoutCancel(ctx), lease.builder.client) == nil
	lease.pool.release(ctx, lease.builder, healthy)
}
