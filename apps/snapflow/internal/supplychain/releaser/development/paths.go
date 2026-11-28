// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package development

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const releaseStateMode = 0o700

type releasePaths struct {
	workspace  string
	state      string
	repository string
	keys       string
}

func resolvePaths(workspaceRoot, releaseStateHome string) (releasePaths, error) {
	workspace := filepath.Clean(strings.TrimSpace(workspaceRoot))
	state := filepath.Clean(strings.TrimSpace(releaseStateHome))
	if !filepath.IsAbs(workspace) || !filepath.IsAbs(state) {
		return releasePaths{}, errors.New("workspace root and development release state home must be absolute")
	}
	if info, err := os.Stat(filepath.Join(workspace, "go.work")); err != nil || !info.Mode().IsRegular() {
		return releasePaths{}, errors.New("workspace root does not contain go.work")
	}
	releaseState := filepath.Join(state, "snapflow", "release-tooling", "development")
	if pathContains(workspace, releaseState) || pathContains(releaseState, workspace) {
		return releasePaths{}, errors.New("development release state must not overlap the source workspace")
	}
	if err := os.MkdirAll(releaseState, releaseStateMode); err != nil {
		return releasePaths{}, fmt.Errorf("create development release state: %w", err)
	}
	if err := os.Chmod(releaseState, releaseStateMode); err != nil {
		return releasePaths{}, fmt.Errorf("secure development release state: %w", err)
	}
	return releasePaths{
		workspace:  workspace,
		state:      releaseState,
		repository: filepath.Join(releaseState, "repository"),
		keys:       filepath.Join(releaseState, "private-keys"),
	}, nil
}

func pathContains(parent, candidate string) bool {
	relative, err := filepath.Rel(parent, candidate)
	if err != nil {
		return false
	}
	return relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}
