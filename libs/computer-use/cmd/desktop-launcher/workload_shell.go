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
	"bufio"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"

	"github.com/snapflowio/computer-use/pkg/desktopenv"
	"golang.org/x/sys/unix"
)

const (
	passwdPath              = "/etc/passwd"
	passwdNameIndex         = 0
	passwdUserIDIndex       = 2
	passwdGroupIDIndex      = 3
	passwdHomeIndex         = 5
	passwdShellIndex        = 6
	passwdRequiredParts     = 7
	pluginEnvironmentPrefix = "PLUGIN_"
	magicCookieMarker       = "MAGIC_COOKIE"
	executableBits          = 0o111
)

func candidateShells() []string {
	return []string{"/bin/bash", "/bin/sh"}
}

type workloadIdentity struct {
	name  string
	uid   int
	gid   int
	home  string
	shell string
}

func runWorkloadShell() error {
	projectDirectory := filepath.Clean(strings.TrimSpace(os.Getenv(desktopProjectDirectoryEnvironment)))
	if !filepath.IsAbs(projectDirectory) {
		return errors.New("workload project directory must be absolute")
	}
	projectOnHost := filepath.Join(desktopenv.SandboxRoot, strings.TrimPrefix(projectDirectory, "/"))
	if err := requireDirectory(projectOnHost); err != nil {
		return fmt.Errorf("inspect workload project directory: %w", err)
	}
	userName := environmentOrDefault(desktopSandboxUserEnvironment, defaultDesktopUser)
	identity, err := loadWorkloadIdentity(filepath.Join(desktopenv.SandboxRoot, passwdPath), userName)
	if err != nil {
		return err
	}
	if err := unix.Chroot(desktopenv.SandboxRoot); err != nil {
		return fmt.Errorf("enter workload root: %w", err)
	}
	if err := os.Chdir(projectDirectory); err != nil {
		return fmt.Errorf("enter workload project directory: %w", err)
	}
	shell, err := resolveWorkloadShell(identity.shell)
	if err != nil {
		return err
	}
	if err := unix.Setgroups([]int{identity.gid}); err != nil {
		return fmt.Errorf("set workload supplementary groups: %w", err)
	}
	if err := unix.Setgid(identity.gid); err != nil {
		return fmt.Errorf("set workload group: %w", err)
	}
	if err := unix.Setuid(identity.uid); err != nil {
		return fmt.Errorf("set workload user: %w", err)
	}

	environment := sanitizeWorkloadEnvironment(os.Environ())
	environment = setEnvironment(environment, "HOME", identity.home)
	environment = setEnvironment(environment, "USER", identity.name)
	environment = setEnvironment(environment, "LOGNAME", identity.name)
	environment = setEnvironment(environment, "SHELL", shell)
	environment = setEnvironment(environment, "PWD", projectDirectory)
	return syscall.Exec(shell, []string{shell, "-l"}, environment)
}

func sanitizeWorkloadEnvironment(environment []string) []string {
	return filterEnvironment(environment, func(name string) bool {
		return strings.HasPrefix(name, pluginEnvironmentPrefix) || strings.Contains(name, magicCookieMarker)
	})
}

func loadWorkloadIdentity(path, name string) (workloadIdentity, error) {
	if name == defaultDesktopUser {
		fallback := workloadIdentity{name: name, home: "/root"}
		identity, err := findWorkloadIdentity(path, name)
		if errors.Is(err, os.ErrNotExist) {
			return fallback, nil
		}
		return identity, err
	}
	return findWorkloadIdentity(path, name)
}

func findWorkloadIdentity(path, name string) (result workloadIdentity, resultErr error) {
	file, err := os.Open(path)
	if err != nil {
		return workloadIdentity{}, fmt.Errorf("open workload user database: %w", err)
	}
	defer func() {
		if err := file.Close(); err != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close workload user database: %w", err))
		}
	}()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		parts := strings.Split(scanner.Text(), ":")
		if len(parts) < passwdRequiredParts || parts[passwdNameIndex] != name {
			continue
		}
		uid, err := strconv.Atoi(parts[passwdUserIDIndex])
		if err != nil {
			return workloadIdentity{}, fmt.Errorf("parse workload user ID: %w", err)
		}
		gid, err := strconv.Atoi(parts[passwdGroupIDIndex])
		if err != nil {
			return workloadIdentity{}, fmt.Errorf("parse workload group ID: %w", err)
		}
		return workloadIdentity{
			name: name, uid: uid, gid: gid,
			home: parts[passwdHomeIndex], shell: parts[passwdShellIndex],
		}, nil
	}
	if err := scanner.Err(); err != nil {
		return workloadIdentity{}, fmt.Errorf("read workload user database: %w", err)
	}
	return workloadIdentity{}, fmt.Errorf("workload user %q does not exist", name)
}

func resolveWorkloadShell(configured string) (string, error) {
	candidates := candidateShells()
	if filepath.IsAbs(configured) {
		candidates = append([]string{configured}, candidates...)
	}
	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if err == nil && info.Mode().IsRegular() && info.Mode().Perm()&executableBits != 0 {
			return candidate, nil
		}
	}
	return "", errors.New("workload image does not contain an executable login shell")
}
