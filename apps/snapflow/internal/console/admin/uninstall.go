// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admin

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"

	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/system"
)

type UninstallResult struct {
	ServiceDisabled bool     `json:"serviceDisabled"`
	StatePurged     bool     `json:"statePurged"`
	Removed         []string `json:"removed"`
}

type UninstallConfig struct {
	Config  *config.Config
	Service *ServiceManager
	Purge   bool
	Log     io.Writer
}

func softwarePaths(cfg *config.Config) []string {
	paths := []string{cfg.Profile.InstallationRoot, cfg.Profile.ReleaseStateRoot}
	if cfg.Profile.CommandLink != "" {
		paths = append(paths, cfg.Profile.CommandLink)
	}
	return paths
}

func Uninstall(ctx context.Context, cfg UninstallConfig) (UninstallResult, error) {
	if cfg.Config == nil || cfg.Service == nil || cfg.Log == nil {
		return UninstallResult{}, errors.New("the Snapflow configuration, service manager, and log output are required")
	}
	if err := cfg.Service.Disable(ctx, cfg.Log, cfg.Log); err != nil {
		return UninstallResult{}, fmt.Errorf("disable Snapflow services: %w", err)
	}
	result := UninstallResult{ServiceDisabled: true, Removed: []string{}}
	removed, err := system.Remove(ctx, system.Config{Commands: cfg.Service.commands, Stdout: cfg.Log, Stderr: cfg.Log})
	result.Removed = append(result.Removed, removed...)
	if err != nil {
		return result, err
	}
	candidates := softwarePaths(cfg.Config)
	if cfg.Purge {
		candidates = append(candidates,
			cfg.Config.Machine.StateDirectory, cfg.Config.Runtime.DataDirectory, cfg.Config.Profile.RuntimeRoot)
	}
	paths, err := purgePaths(candidates)
	if err != nil {
		return result, err
	}
	for _, path := range paths {
		if err := os.RemoveAll(path); err != nil {
			return result, fmt.Errorf("purge Snapflow path %s: %w", path, err)
		}
		result.Removed = append(result.Removed, path)
	}
	result.StatePurged = cfg.Purge
	return result, nil
}

func purgePaths(candidates []string) ([]string, error) {
	unique := make(map[string]struct{}, len(candidates))
	for _, candidate := range candidates {
		if !filepath.IsAbs(candidate) {
			return nil, errors.New("the Snapflow purge paths must be absolute")
		}
		path := filepath.Clean(candidate)
		if path == "/" || path == "/opt" || path == "/var" || path == "/var/lib" || path == "/run" {
			return nil, fmt.Errorf("refusing unsafe Snapflow purge path %s", path)
		}
		unique[path] = struct{}{}
	}
	paths := make([]string, 0, len(unique))
	for path := range unique {
		paths = append(paths, path)
	}
	sort.Slice(paths, func(first, second int) bool {
		return len(paths[first]) > len(paths[second])
	})
	return paths, nil
}
