// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package system

import (
	"bytes"
	"context"
	"embed"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"

	"github.com/snapflowio/common-go/pkg/atomicfile"
)

const (
	fileMode      = 0o644
	directoryMode = 0o755
	sysctlFile    = "/etc/sysctl.d/60-snapflow.conf"
	tmpfilesFile  = "/etc/tmpfiles.d/snapflow.conf"
)

//go:embed files
var files embed.FS

type installedFile struct {
	source      string
	destination string
}

func installedFiles() []installedFile {
	return []installedFile{
		{source: "snapflow.service", destination: "/etc/systemd/system/snapflow.service"},
		{source: "snapflow-update.service", destination: "/etc/systemd/system/snapflow-update.service"},
		{source: "snapflow-update.timer", destination: "/etc/systemd/system/snapflow-update.timer"},
		{source: "snapflow-tmpfiles.conf", destination: tmpfilesFile},
		{source: "60-snapflow.conf", destination: sysctlFile},
	}
}

type CommandRunner interface {
	Run(context.Context, io.Writer, io.Writer, string, ...string) error
}

type Config struct {
	Root     string
	Commands CommandRunner
	Stdout   io.Writer
	Stderr   io.Writer
}

func Install(ctx context.Context, cfg Config) error {
	if cfg.Commands == nil || cfg.Stdout == nil || cfg.Stderr == nil {
		return errors.New("system file installation needs a command runner and log output")
	}
	changed := false
	for _, file := range installedFiles() {
		updated, err := installFile(cfg.Root, file)
		if err != nil {
			return err
		}
		changed = changed || updated
	}
	if !changed {
		return nil
	}
	commands := [][]string{
		{"systemctl", "daemon-reload"},
		{"systemd-tmpfiles", "--create", tmpfilesFile},
		{"sysctl", "--load=" + sysctlFile},
	}
	for _, command := range commands {
		if err := cfg.Commands.Run(ctx, cfg.Stdout, cfg.Stderr, command[0], command[1:]...); err != nil {
			return fmt.Errorf("apply Snapflow system files: %w", err)
		}
	}
	return nil
}

func Remove(ctx context.Context, cfg Config) ([]string, error) {
	if cfg.Commands == nil || cfg.Stdout == nil || cfg.Stderr == nil {
		return nil, errors.New("system file removal needs a command runner and log output")
	}
	removed := []string{}
	for _, file := range installedFiles() {
		destination := filepath.Join(cfg.Root, file.destination)
		err := os.Remove(destination)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return removed, fmt.Errorf("remove %s: %w", destination, err)
		}
		removed = append(removed, destination)
	}
	if err := cfg.Commands.Run(ctx, cfg.Stdout, cfg.Stderr, "systemctl", "daemon-reload"); err != nil {
		return removed, fmt.Errorf("reload systemd after removing Snapflow units: %w", err)
	}
	return removed, nil
}

func installFile(root string, file installedFile) (bool, error) {
	contents, err := files.ReadFile(path.Join("files", file.source))
	if err != nil {
		return false, fmt.Errorf("read embedded %s: %w", file.source, err)
	}
	destination := filepath.Join(root, file.destination)
	current, err := os.ReadFile(destination)
	if err == nil && bytes.Equal(current, contents) {
		return false, nil
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return false, fmt.Errorf("read %s: %w", destination, err)
	}
	if err := os.MkdirAll(filepath.Dir(destination), directoryMode); err != nil {
		return false, fmt.Errorf("create %s: %w", filepath.Dir(destination), err)
	}
	if err := atomicfile.WriteFile(destination, contents, fileMode); err != nil {
		return false, fmt.Errorf("write %s: %w", destination, err)
	}
	return true, nil
}
