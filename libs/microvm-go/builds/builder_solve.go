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
	"fmt"
	"io"
	"os"

	"github.com/moby/buildkit/client"
	"github.com/moby/buildkit/session"
	"github.com/moby/buildkit/util/progress/progressui"
	"github.com/snapflowio/microvm-go/internal/runtimeplatform"
	"github.com/tonistiigi/fsutil"
	"golang.org/x/sync/errgroup"
)

const (
	dockerfileFrontend     = "dockerfile.v0"
	contextMount           = "context"
	dockerfileMount        = "dockerfile"
	platformAttribute      = "platform"
	ociMediaTypesAttribute = "oci-mediatypes"
	compressionAttribute   = "compression"
	uncompressedLayers     = "uncompressed"
	enabledAttribute       = "true"
	outputPermission       = 0o600
)

func solveOptions(job buildJob, contextFS fsutil.FS) client.SolveOpt {
	return client.SolveOpt{
		Frontend:      dockerfileFrontend,
		FrontendAttrs: map[string]string{platformAttribute: runtimeplatform.CurrentContainerPlatform()},
		LocalMounts:   map[string]fsutil.FS{contextMount: contextFS, dockerfileMount: contextFS},
		Exports: []client.ExportEntry{{
			Type: client.ExporterOCI,
			Attrs: map[string]string{
				ociMediaTypesAttribute: enabledAttribute,
				compressionAttribute:   uncompressedLayers,
			},
			Output: func(map[string]string) (io.WriteCloser, error) {
				return os.OpenFile(job.workspace.output, os.O_CREATE|os.O_EXCL|os.O_WRONLY, outputPermission)
			},
		}},
		CacheImports: job.cache.cacheImports(job.request.Dockerfile),
		CacheExports: job.cache.cacheExports(job.request.Dockerfile),
		Session:      []session.Attachable{job.credentials.attachable()},
	}
}

func solve(ctx context.Context, daemon *client.Client, job buildJob) (string, error) {
	contextFS, err := fsutil.NewFS(job.workspace.context)
	if err != nil {
		return "", fmt.Errorf("open build context: %w", err)
	}
	var progress bytes.Buffer
	display, err := progressui.NewDisplay(&progress, progressui.PlainMode)
	if err != nil {
		return "", fmt.Errorf("open build progress log: %w", err)
	}
	status := make(chan *client.SolveStatus)
	group, groupCtx := errgroup.WithContext(ctx)
	group.Go(func() error {
		_, solveErr := daemon.Solve(groupCtx, nil, solveOptions(job, contextFS), status)
		return solveErr
	})
	group.Go(func() error {
		_, displayErr := display.UpdateFrom(context.WithoutCancel(ctx), status)
		return displayErr
	})
	err = group.Wait()
	return progress.String(), err
}
