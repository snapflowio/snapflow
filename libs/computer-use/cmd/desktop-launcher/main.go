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

//go:build linux

package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"

	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/computer-use/pkg/desktopenv"
	"golang.org/x/sys/unix"
)

const (
	desktopExtensionRoot               = guestspec.DesktopMountPath
	desktopStateRoot                   = "/run/snapflow/desktop"
	desktopWorkspace                   = "/workspace"
	desktopHome                        = "/home/snapflow"
	desktopRuntimeRoot                 = "/run/snapflow"
	desktopTemporaryRoot               = "/tmp"
	desktopExecutablePath              = "/components/snapflow-desktop"
	desktopPluginPath                  = "/components/snapflow-computer-use"
	desktopProjectDirectoryEnvironment = "SNAPFLOW_DESKTOP_PROJECT_DIR"
	desktopSandboxUserEnvironment      = "SNAPFLOW_SANDBOX_USER"
	defaultDesktopUser                 = "root"
	terminalExecutable                 = "xfce4-terminal"
	workloadShellMode                  = "workload-shell"
	modeArgument                       = 1
	exitFailure                        = 1
	environmentAssignment              = "="
	desktopStateMode                   = 0o700
)

func main() {
	if err := run(os.Args); err != nil {
		fmt.Fprintf(os.Stderr, "desktop launcher: %v\n", err)
		os.Exit(exitFailure)
	}
}

func run(arguments []string) error {
	if filepath.Base(arguments[0]) == terminalExecutable {
		return runTerminalClient()
	}
	if len(arguments) <= modeArgument {
		return runDesktopDriver()
	}
	switch mode := arguments[modeArgument]; mode {
	case workloadShellMode:
		return runWorkloadShell()
	case guestspec.ComputerUseSelfCheckArgument:
		return runPluginSelfCheck()
	default:
		return fmt.Errorf("unknown desktop launcher mode %q", mode)
	}
}

func runPluginSelfCheck() error {
	if err := enterDesktopRoot(desktopSystemMounts()); err != nil {
		return err
	}
	return syscall.Exec(
		desktopPluginPath,
		[]string{desktopPluginPath, guestspec.ComputerUseSelfCheckArgument},
		platformEnvironment(),
	)
}

func platformEnvironment() []string {
	environment := sanitizePlatformEnvironment(os.Environ())
	return setEnvironment(environment, "PATH", platformExecutablePath)
}

func runDesktopDriver() error {
	projectDir := filepath.Clean(strings.TrimSpace(os.Getenv(desktopProjectDirectoryEnvironment)))
	if !filepath.IsAbs(projectDir) {
		return errors.New("desktop project directory must be absolute")
	}
	if err := requireDirectory(projectDir); err != nil {
		return fmt.Errorf("inspect desktop project directory: %w", err)
	}
	if err := requireDirectory(desktopExtensionRoot); err != nil {
		return fmt.Errorf("inspect desktop extension: %w", err)
	}
	stateRoot := filepath.Join(desktopStateRoot, strconv.Itoa(os.Getpid()))
	homeSource := filepath.Join(stateRoot, "home")
	if err := os.MkdirAll(homeSource, desktopStateMode); err != nil {
		return fmt.Errorf("create desktop state directory: %w", err)
	}
	mounts := append([]desktopMount{
		{source: stateRoot, target: desktopRuntimeRoot},
		{source: projectDir, target: desktopWorkspace, recursive: true},
		{source: homeSource, target: desktopHome},
	}, desktopSystemMounts()...)
	if err := enterDesktopRoot(mounts); err != nil {
		return err
	}
	if err := os.Chdir(desktopWorkspace); err != nil {
		return fmt.Errorf("enter desktop workspace: %w", err)
	}
	environment := platformEnvironment()
	environment = setEnvironment(environment, "HOME", desktopHome)
	environment = setEnvironment(environment, "PWD", desktopWorkspace)
	environment = setEnvironment(
		environment,
		desktopSandboxUserEnvironment,
		environmentOrDefault(desktopSandboxUserEnvironment, defaultDesktopUser),
	)
	return syscall.Exec(desktopPluginPath, []string{desktopPluginPath}, environment)
}

type desktopMount struct {
	source    string
	target    string
	recursive bool
}

func desktopSystemMounts() []desktopMount {
	return []desktopMount{
		{source: "/proc", target: "/proc", recursive: true},
		{source: "/sys", target: "/sys", recursive: true},
		{source: "/dev", target: "/dev", recursive: true},
		{source: desktopTemporaryRoot, target: desktopTemporaryRoot, recursive: true},
	}
}

func enterDesktopRoot(mounts []desktopMount) error {
	runtime.LockOSThread()
	if err := unix.Unshare(unix.CLONE_NEWNS); err != nil {
		return fmt.Errorf("create desktop mount namespace: %w", err)
	}
	if err := unix.Mount("", "/", "", unix.MS_REC|unix.MS_PRIVATE, ""); err != nil {
		return fmt.Errorf("make desktop mounts private: %w", err)
	}
	if err := unix.PivotRoot(desktopExtensionRoot, extensionPath(desktopenv.SandboxRoot)); err != nil {
		return fmt.Errorf("enter desktop extension root: %w", err)
	}
	if err := os.Chdir("/"); err != nil {
		return fmt.Errorf("enter desktop root directory: %w", err)
	}
	for _, item := range mounts {
		if err := requireDirectory(item.target); err != nil {
			return fmt.Errorf("inspect desktop mount target %s: %w", item.target, err)
		}
		source := workloadPath(item.source)
		if err := bindMount(source, item.target, item.recursive); err != nil {
			return fmt.Errorf("mount %s on %s: %w", source, item.target, err)
		}
	}
	return nil
}

func environmentOrDefault(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func bindMount(source, target string, recursive bool) error {
	flags := uintptr(unix.MS_BIND)
	if recursive {
		flags |= unix.MS_REC
	}
	return unix.Mount(source, target, "", flags, "")
}

func extensionPath(path string) string {
	return filepath.Join(desktopExtensionRoot, strings.TrimPrefix(filepath.Clean(path), "/"))
}

func workloadPath(path string) string {
	return filepath.Join(desktopenv.SandboxRoot, strings.TrimPrefix(filepath.Clean(path), "/"))
}

func requireDirectory(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("%s is not a directory", path)
	}
	return nil
}

func setEnvironment(environment []string, name, value string) []string {
	prefix := name + environmentAssignment
	for index, entry := range environment {
		if strings.HasPrefix(entry, prefix) {
			environment[index] = prefix + value
			return environment
		}
	}
	return append(environment, prefix+value)
}

func sanitizePlatformEnvironment(environment []string) []string {
	unsafeNames := map[string]struct{}{
		"GCONV_PATH": {}, "GTK_PATH": {}, "LD_LIBRARY_PATH": {},
		"LD_PRELOAD": {}, "PYTHONPATH": {},
	}
	return filterEnvironment(environment, func(name string) bool {
		_, unsafe := unsafeNames[name]
		return unsafe
	})
}

func filterEnvironment(environment []string, drop func(name string) bool) []string {
	result := make([]string, 0, len(environment))
	for _, entry := range environment {
		if name, _, found := strings.Cut(entry, environmentAssignment); found && drop(name) {
			continue
		}
		result = append(result, entry)
	}
	return result
}
