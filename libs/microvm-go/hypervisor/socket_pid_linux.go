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

package hypervisor

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func socketOwnerPID(socketPath string) (int, error) {
	if socketRef, err := socketRefForPath(socketPath); err == nil {
		if pid, err := pidBySocketRef(socketRef); err == nil {
			return pid, nil
		}
	}

	if pid, err := pidByCmdline(socketPath); err == nil {
		return pid, nil
	}

	return 0, fmt.Errorf("resolve process pid for socket %s: no owning process found", socketPath)
}

func pidBySocketRef(socketRef string) (int, error) {
	procEntries, err := os.ReadDir("/proc")
	if err != nil {
		return 0, fmt.Errorf("read /proc: %w", err)
	}
	for _, entry := range procEntries {
		if !entry.IsDir() {
			continue
		}
		pid, err := strconv.Atoi(entry.Name())
		if err != nil {
			continue
		}
		fdEntries, err := os.ReadDir(filepath.Join("/proc", entry.Name(), "fd"))
		if err != nil {
			continue
		}
		for _, fdEntry := range fdEntries {
			target, err := os.Readlink(filepath.Join("/proc", entry.Name(), "fd", fdEntry.Name()))
			if err == nil && strings.TrimSpace(target) == socketRef {
				return pid, nil
			}
		}
	}
	return 0, fmt.Errorf("resolve process pid for %s: no owning process found", socketRef)
}

func pidByCmdline(socketPath string) (int, error) {
	procEntries, err := os.ReadDir("/proc")
	if err != nil {
		return 0, fmt.Errorf("read /proc: %w", err)
	}
	for _, entry := range procEntries {
		if !entry.IsDir() {
			continue
		}
		pid, err := strconv.Atoi(entry.Name())
		if err != nil {
			continue
		}
		cmdline, err := os.ReadFile(filepath.Join("/proc", entry.Name(), "cmdline"))
		if err != nil || len(cmdline) == 0 {
			continue
		}
		for _, arg := range strings.Split(string(cmdline), "\x00") {
			if arg == socketPath {
				return pid, nil
			}
		}
	}
	return 0, fmt.Errorf("resolve process pid for socket %s: no matching command line found", socketPath)
}

func socketRefForPath(socketPath string) (string, error) {
	file, err := os.Open("/proc/net/unix")
	if err != nil {
		return "", fmt.Errorf("open /proc/net/unix: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 7 || fields[0] == "Num" {
			continue
		}
		if fields[len(fields)-1] != socketPath {
			continue
		}
		inode := fields[6]
		if inode == "" {
			break
		}
		return fmt.Sprintf("socket:[%s]", inode), nil
	}
	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("scan /proc/net/unix: %w", err)
	}
	return "", fmt.Errorf("resolve process pid for socket %s: socket inode not found", socketPath)
}
