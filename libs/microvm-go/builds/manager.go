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
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/transferpolicy"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

const (
	bytesPerGiB      = 1024 * 1024 * 1024
	contextDirectory = "context"
	outputArchive    = "output.tar"
	ociDirectory     = "oci"
)

type Manager struct {
	paths     layout.Paths
	images    *imagecache.ImageStore
	config    Config
	transfers transferpolicy.Policy
	machine   BuilderMachine
	builders  *builderPool
	slots     chan struct{}
}

func NewManager(
	paths layout.Paths,
	images *imagecache.ImageStore,
	machine BuilderMachine,
	config Config,
	transfers transferpolicy.Policy,
) (*Manager, error) {
	if machine == nil {
		return nil, errors.New("isolated build machine is required")
	}
	config = config.Normalize()
	return &Manager{
		paths:     paths,
		images:    images,
		config:    config,
		transfers: transfers,
		machine:   machine,
		builders:  newBuilderPool(machine, paths, config),
		slots:     make(chan struct{}, config.MaxConcurrent),
	}, nil
}

func (m *Manager) Run(ctx context.Context) {
	m.builders.run(ctx)
}

type buildWorkspace struct {
	dir     string
	context string
	output  string
	oci     string
}

func newBuildWorkspace(dir string) buildWorkspace {
	return buildWorkspace{
		dir:     dir,
		context: filepath.Join(dir, contextDirectory),
		output:  filepath.Join(dir, outputArchive),
		oci:     filepath.Join(dir, ociDirectory),
	}
}

func (w buildWorkspace) remove() error {
	if err := os.RemoveAll(w.dir); err != nil {
		return fmt.Errorf("remove build workspace %s: %w", w.dir, err)
	}
	return nil
}

func (m *Manager) Build(ctx context.Context, request types.BuildRequest) (record imagecache.ImageRecord, resultErr error) {
	if strings.TrimSpace(request.Image) == "" {
		return imagecache.ImageRecord{}, errors.New("build image reference is required")
	}
	if strings.TrimSpace(request.Tenant) == "" {
		return imagecache.ImageRecord{}, errors.New("build tenant is required")
	}
	if err := m.acquire(ctx); err != nil {
		return imagecache.ImageRecord{}, err
	}
	defer m.release()
	buildCtx, cancel := context.WithTimeout(ctx, m.config.Timeout)
	defer cancel()

	startedAt := time.Now()
	phases := buildPhases{}
	workspace := newBuildWorkspace(m.paths.SystemBuild(newBuilderInstanceID()))
	defer func() {
		resultErr = errors.Join(resultErr, workspace.remove())
	}()
	cache, err := resolveCacheRegistry(request.CacheRegistry, m.config.HostGateway)
	if err != nil {
		return imagecache.ImageRecord{}, err
	}
	if err := PrepareContext(buildCtx, workspace.context, request, m.config, m.transfers); err != nil {
		return imagecache.ImageRecord{}, err
	}
	credentials, err := newRegistryCredentials(request.SourceRegistries, cache)
	if err != nil {
		return imagecache.ImageRecord{}, err
	}
	daemonConfig, err := cache.daemonConfig()
	if err != nil {
		return imagecache.ImageRecord{}, err
	}
	phases.context = time.Since(startedAt)
	job := buildJob{workspace: workspace, request: request, cache: cache, credentials: credentials, daemonConfig: daemonConfig}
	if err := m.runBuild(ctx, buildCtx, job, &phases); err != nil {
		return imagecache.ImageRecord{}, err
	}
	record, err = m.importOutput(buildCtx, workspace, request, &phases)
	if err != nil {
		return imagecache.ImageRecord{}, err
	}
	phases.total = time.Since(startedAt)
	phases.log(ctx, request.Image)
	return record, nil
}

type buildJob struct {
	workspace    buildWorkspace
	request      types.BuildRequest
	cache        cacheRegistry
	credentials  registryCredentials
	daemonConfig []byte
}

func (m *Manager) runBuild(ctx, buildCtx context.Context, job buildJob, phases *buildPhases) error {
	acquiredAt := time.Now()
	lease, err := m.builders.acquire(buildCtx, job.request.Tenant, job.daemonConfig)
	if err != nil {
		return m.writeFailedBuildLogs(ctx, job, buildLog{}, fmt.Errorf("acquire organization builder: %w", err))
	}
	phases.builder = time.Since(acquiredAt)
	phases.cold = lease.cold
	phases.machine = lease.builder.phases
	phases.daemonReady = lease.builder.readyTime
	if err := m.machine.ReserveBuildDisk(buildCtx, lease.builder.id); err != nil {
		lease.finish(buildCtx, nil)
		return m.writeFailedBuildLogs(ctx, job, buildLog{}, fmt.Errorf("reserve build disk: %w", err))
	}
	solvedAt := time.Now()
	progress, solveErr := solve(buildCtx, lease.client(), job)
	phases.solve = time.Since(solvedAt)
	phases.progress = progress
	m.machine.ReleaseBuildDisk(lease.builder.id)
	lease.finish(buildCtx, solveErr)
	result := buildLog{progress: progress}
	if solveErr != nil {
		result.builder = m.machine.BuilderLogs(lease.builder.id)
		return m.writeFailedBuildLogs(ctx, job, result, solveErr)
	}
	return m.writeBuildLogs(ctx, job.workspace.dir, logReference(job.request), job.request.BuildLogUploadURL, result)
}

func (m *Manager) writeFailedBuildLogs(ctx context.Context, job buildJob, result buildLog, buildErr error) error {
	if result.progress != "" && !strings.HasSuffix(result.progress, "\n") {
		result.progress += "\n"
	}
	result.progress += "[snapflow] isolated build failed: " + buildErr.Error() + "\n"
	logErr := m.writeBuildLogs(ctx, job.workspace.dir, logReference(job.request), job.request.BuildLogUploadURL, result)
	return errors.Join(fmt.Errorf("isolated build failed: %w", buildErr), logErr)
}

func logReference(request types.BuildRequest) string {
	if strings.TrimSpace(request.LogReference) == "" {
		return request.Image
	}
	return request.LogReference
}

func (m *Manager) importOutput(ctx context.Context, workspace buildWorkspace, request types.BuildRequest, phases *buildPhases) (imagecache.ImageRecord, error) {
	startedAt := time.Now()
	image, err := imageFromOCITar(workspace.output, workspace.oci)
	if err != nil {
		return imagecache.ImageRecord{}, fmt.Errorf("load BuildKit OCI output image: %w", err)
	}
	phases.load = time.Since(startedAt)
	startedAt = time.Now()
	record, err := m.images.ImportImage(ctx, request.Image, image)
	if err != nil {
		return imagecache.ImageRecord{}, err
	}
	phases.convert = time.Since(startedAt)
	if !request.PushToInternalRegistry {
		return record, nil
	}
	if request.Registry == nil {
		return imagecache.ImageRecord{}, errors.New("internal registry is required when build push is enabled")
	}
	startedAt = time.Now()
	if err := imagecache.Push(ctx, image, request.Image, request.Registry); err != nil {
		return imagecache.ImageRecord{}, err
	}
	phases.push = time.Since(startedAt)
	return record, nil
}

func newBuilderInstanceID() string {
	return uuid.NewString()
}

func (m *Manager) acquire(ctx context.Context) error {
	select {
	case m.slots <- struct{}{}:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("wait for isolated builder capacity: %w", ctx.Err())
	}
}

func (m *Manager) release() {
	<-m.slots
}
