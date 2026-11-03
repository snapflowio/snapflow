// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package development

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/config"
)

type ResetConfig struct {
	WorkspaceRoot    string
	ReleaseStateHome string
	Stdout           io.Writer
	Stderr           io.Writer
	Stdin            io.Reader
}

type ResetResult struct {
	Removed []string `json:"removed"`
}

func Reset(ctx context.Context, cfg ResetConfig) (result ResetResult, resultErr error) {
	paths, err := resolvePaths(cfg.WorkspaceRoot, cfg.ReleaseStateHome)
	if err != nil {
		return ResetResult{}, err
	}
	temporaryRoot, err := os.MkdirTemp(filepath.Dir(paths.state), ".reset-development-")
	if err != nil {
		return ResetResult{}, fmt.Errorf("create reset workspace: %w", err)
	}
	defer func() {
		if removeErr := os.RemoveAll(temporaryRoot); removeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove reset workspace: %w", removeErr))
		}
	}()
	executor := commandExecutor{stdout: cfg.Stdout, stderr: cfg.Stderr, stdin: cfg.Stdin}
	lifecycleCLI := filepath.Join(temporaryRoot, text.Binary)
	buildEnvironment := []string{"CGO_ENABLED=0", "GOOS=linux"}
	if err := executor.run(ctx, paths.workspace, buildEnvironment, "go", "build", "-trimpath", "-o", lifecycleCLI, lifecyclePackage); err != nil {
		return ResetResult{}, err
	}
	if err := runLifecycleCLI(ctx, executor, paths.workspace, lifecycleCLI,
		"release", "reset", "--profile", string(config.Development), "--yes"); err != nil {
		return ResetResult{}, err
	}
	if err := os.RemoveAll(paths.state); err != nil {
		return ResetResult{}, fmt.Errorf("remove development release tooling state %q: %w", paths.state, err)
	}
	return ResetResult{Removed: []string{
		config.DevelopmentInstallationRoot,
		config.DevelopmentReleaseStateRoot,
		config.DevelopmentRuntimeRoot,
		paths.state,
	}}, nil
}
