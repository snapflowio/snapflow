// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package notices

import (
	"context"
	"fmt"
	"os"
)

const outputMode = 0o644

type Config struct {
	WorkspaceRoot string
	Template      string
	Output        string
}

func Generate(ctx context.Context, cfg Config) error {
	template, err := os.ReadFile(cfg.Template)
	if err != nil {
		return fmt.Errorf("read notices template: %w", err)
	}
	modules, err := listModules(ctx, cfg.WorkspaceRoot)
	if err != nil {
		return err
	}
	rendered, err := renderModules(modules)
	if err != nil {
		return err
	}
	notices, err := fillTemplate(string(template), rendered)
	if err != nil {
		return err
	}
	if err := os.WriteFile(cfg.Output, []byte(notices), outputMode); err != nil {
		return fmt.Errorf("write third-party notices: %w", err)
	}
	return nil
}
