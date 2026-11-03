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

package guestinit

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"syscall"
	"time"
)

const (
	commandNotExecutableExitCode = 126
	commandNotFoundExitCode      = 127
	signalExitCodeBase           = 128
)

func describeExitCode(code int) string {
	switch {
	case code == 0:
		return "success"
	case code == commandNotExecutableExitCode:
		return "permission denied (command not executable)"
	case code == commandNotFoundExitCode:
		return "command not found"
	case code > signalExitCodeBase:
		signal := syscall.Signal(code - signalExitCodeBase)
		return fmt.Sprintf("killed by signal %d (%s)", code-signalExitCodeBase, signal.String())
	default:
		return fmt.Sprintf("exit code %d", code)
	}
}

func checkOOMKill() bool {
	file, err := os.OpenFile("/dev/kmsg", os.O_RDONLY|syscall.O_NONBLOCK, 0)
	if err != nil {
		return false
	}
	defer file.Close()
	result := make(chan bool, 1)
	go func() {
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.Contains(line, "Out of memory") || strings.Contains(line, "oom-kill") || strings.Contains(line, "oom_reaper") {
				result <- true
				return
			}
		}
		result <- false
	}()
	select {
	case found := <-result:
		return found
	case <-time.After(time.Second):
		return false
	}
}
