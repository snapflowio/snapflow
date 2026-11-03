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
)

const (
	builderLogHeader    = "[builder]"
	builderVMMLogHeader = "[builder-vmm]"
	logFilePermission   = 0o600
	logDirPermission    = 0o700
)

type buildLog struct {
	progress string
	builder  BuilderLogs
}

func (log buildLog) content() string {
	content := log.progress
	for _, section := range []struct {
		header string
		body   string
	}{
		{header: builderLogHeader, body: log.builder.Application},
		{header: builderVMMLogHeader, body: log.builder.VMM},
	} {
		if section.body == "" {
			continue
		}
		if content != "" && !strings.HasSuffix(content, "\n") {
			content += "\n"
		}
		content += "\n" + section.header + "\n" + section.body
	}
	return content
}

func (m *Manager) writeBuildLogs(
	ctx context.Context,
	buildDir string,
	imageRef string,
	uploadURL string,
	result buildLog,
) error {
	var writeErrors []error
	content := result.content()
	if err := os.MkdirAll(buildDir, logDirPermission); err != nil {
		writeErrors = append(writeErrors, fmt.Errorf("create internal build log directory: %w", err))
	} else if err := os.WriteFile(filepath.Join(buildDir, "build.log"), []byte(content), logFilePermission); err != nil {
		writeErrors = append(writeErrors, fmt.Errorf("write internal build log: %w", err))
	}
	if m.config.LogPath != nil {
		path, err := m.config.LogPath(imageRef)
		if err != nil {
			writeErrors = append(writeErrors, fmt.Errorf("resolve build log path: %w", err))
		} else if err := os.MkdirAll(filepath.Dir(path), logDirPermission); err != nil {
			writeErrors = append(writeErrors, fmt.Errorf("create build log directory: %w", err))
		} else if err := os.WriteFile(path, []byte(content), logFilePermission); err != nil {
			writeErrors = append(writeErrors, fmt.Errorf("write public build log: %w", err))
		}
	}
	if err := uploadBuildLog(ctx, m.transfers, uploadURL, []byte(content)); err != nil {
		writeErrors = append(writeErrors, err)
	}
	return errors.Join(writeErrors...)
}
