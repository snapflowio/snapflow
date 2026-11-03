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

package hypervisor

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"syscall"
	"time"

	"github.com/snapflowio/microvm-go/internal/atomicfile"
)

const (
	processExitPollInterval = 2 * time.Millisecond
	processKillWait         = 2 * time.Second
	pidRecordMode           = 0o600
	minimumProcessPID       = 2
)

type Process struct {
	PID        int    `json:"pid"`
	StartToken string `json:"startToken"`
	exited     <-chan struct{}
}

func IdentifyProcess(pid int) (Process, error) {
	if pid < minimumProcessPID {
		return Process{}, fmt.Errorf("invalid VMM pid %d", pid)
	}
	token, err := processStartToken(pid)
	if err != nil {
		return Process{}, fmt.Errorf("read VMM process %d identity: %w", pid, err)
	}
	return Process{PID: pid, StartToken: token}, nil
}

func ResolveProcess(socketPath string) (Process, error) {
	pid, err := socketOwnerPID(socketPath)
	if err != nil {
		return Process{}, err
	}
	return IdentifyProcess(pid)
}

func (process Process) Running() bool {
	if process.PID < minimumProcessPID || process.StartToken == "" {
		return false
	}
	if process.exited != nil {
		select {
		case <-process.exited:
			return false
		default:
		}
	}
	token, err := processStartToken(process.PID)
	return err == nil && token == process.StartToken
}

func WritePID(path string, process Process) error {
	if !process.Running() {
		return fmt.Errorf("cannot persist invalid or stopped VMM pid %d", process.PID)
	}
	data, err := json.Marshal(process)
	if err != nil {
		return fmt.Errorf("encode VMM pid record: %w", err)
	}
	if err := atomicfile.Replace(path, append(data, '\n'), pidRecordMode); err != nil {
		return fmt.Errorf("write VMM pid record: %w", err)
	}
	return nil
}

func ReadPID(path string) (Process, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Process{}, err
	}
	var record Process
	if err := json.Unmarshal(data, &record); err != nil {
		return Process{}, fmt.Errorf("malformed VMM pid record is not trusted: %w", err)
	}
	if record.PID < minimumProcessPID || record.StartToken == "" {
		return Process{}, errors.New("vmm pid record is incomplete")
	}
	if !record.Running() {
		return Process{}, fmt.Errorf("vmm pid %d is no longer the recorded process", record.PID)
	}
	return record, nil
}

func Terminate(process Process, gracePeriod time.Duration) error {
	if !process.Running() {
		return nil
	}
	if err := process.signal(syscall.SIGTERM); err != nil {
		return fmt.Errorf("signal VMM process %d: %w", process.PID, err)
	}
	if process.waitForExit(gracePeriod) {
		return nil
	}
	return Kill(process)
}

func Kill(process Process) error {
	if !process.Running() {
		return nil
	}
	if err := process.signal(syscall.SIGKILL); err != nil {
		return fmt.Errorf("kill VMM process %d: %w", process.PID, err)
	}
	if !process.waitForExit(processKillWait) {
		return fmt.Errorf("VMM process %d is still running after SIGKILL", process.PID)
	}
	return nil
}

func (process Process) signal(signal syscall.Signal) error {
	if !process.Running() {
		return nil
	}
	if err := signalProcessGroup(process.PID, signal); err != nil && !errors.Is(err, syscall.ESRCH) {
		return err
	}
	return nil
}

func (process Process) waitForExit(timeout time.Duration) bool {
	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	if process.exited != nil {
		select {
		case <-process.exited:
			return true
		case <-deadline.C:
			return !process.Running()
		}
	}
	ticker := time.NewTicker(processExitPollInterval)
	defer ticker.Stop()
	for process.Running() {
		select {
		case <-deadline.C:
			return !process.Running()
		case <-ticker.C:
		}
	}
	return true
}

func signalProcessGroup(pid int, signal syscall.Signal) error {
	if err := syscall.Kill(-pid, signal); err == nil || !errors.Is(err, syscall.ESRCH) {
		return err
	}
	return syscall.Kill(pid, signal)
}
