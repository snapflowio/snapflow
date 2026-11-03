// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package development

import (
	"context"
	"fmt"
	"path/filepath"
	"runtime"

	"github.com/snapflowio/snapflow/internal/config"
)

func buildGuestImages(ctx context.Context, executor commandExecutor, workspace, version string) error {
	for _, component := range []string{"core", "desktop-extension", "benchmark"} {
		reference := config.DevelopmentGuestRepository + ":" + component + "-" + version + "-" + runtime.GOARCH
		arguments := []string{
			"build", "--frontend", "dockerfile.v0", "--local", "context=" + workspace,
			"--local", "dockerfile=" + workspace,
			"--opt", "filename=images/platform/" + component + "/Dockerfile",
			"--opt", "platform=linux/" + runtime.GOARCH,
			"--opt", "build-arg:TARGETARCH=" + runtime.GOARCH,
			"--opt", "build-arg:VERSION=" + version,
			"--output", "type=image,name=" + reference + ",push=true,oci-mediatypes=true,compression=zstd,registry.insecure=true",
		}
		if err := executor.run(ctx, workspace, nil, "buildctl", arguments...); err != nil {
			return fmt.Errorf("build development guest component %s: %w", component, err)
		}
	}
	return nil
}

func buildErofsUtils(ctx context.Context, executor commandExecutor, workspace, outputDir string) (string, error) {
	arguments := []string{
		"build", "--frontend", "dockerfile.v0", "--local", "context=" + workspace,
		"--local", "dockerfile=" + workspace,
		"--opt", "filename=" + erofsUtilsDockerfile,
		"--opt", "platform=linux/" + runtime.GOARCH,
		"--output", "type=local,dest=" + outputDir,
	}
	if err := executor.run(ctx, workspace, nil, "buildctl", arguments...); err != nil {
		return "", fmt.Errorf("build erofs-utils: %w", err)
	}
	return filepath.Join(outputDir, mkfsErofsFileName), nil
}
