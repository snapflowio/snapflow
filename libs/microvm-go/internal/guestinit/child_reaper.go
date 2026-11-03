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
	"errors"
	"fmt"
	"os/exec"
	"sync"
	"syscall"
	"time"

	reaper "github.com/ramr/go-reaper"
)

const (
	reaperStatusBuffer = 1024
	reaperStatusTTL    = 10 * time.Second
	reaperMatchWindow  = time.Second
	reaperSweepPeriod  = 5 * time.Second
	reaperWaitTimeout  = 5 * time.Second
)

type childRegistration struct {
	statuses     chan syscall.WaitStatus
	registeredAt time.Time
}

type pendingChildStatus struct {
	status   syscall.WaitStatus
	reapedAt time.Time
}

type childReaper struct {
	mu            sync.Mutex
	registrations map[int]*childRegistration
	pending       map[int]pendingChildStatus
}

func startChildReaper() *childReaper {
	children := &childReaper{
		registrations: make(map[int]*childRegistration),
		pending:       make(map[int]pendingChildStatus),
	}
	statuses := make(chan reaper.Status, reaperStatusBuffer)
	go children.dispatch(statuses)
	reaper.Start(reaper.Config{Pid: -1, StatusChannel: statuses})
	return children
}

func (children *childReaper) dispatch(statuses <-chan reaper.Status) {
	ticker := time.NewTicker(reaperSweepPeriod)
	defer ticker.Stop()
	for {
		select {
		case status, open := <-statuses:
			if !open {
				return
			}
			if status.Err == nil {
				children.record(status.Pid, status.WaitStatus)
			}
		case <-ticker.C:
			children.sweep()
		}
	}
}

func (children *childReaper) record(pid int, status syscall.WaitStatus) {
	children.mu.Lock()
	defer children.mu.Unlock()
	if registration, exists := children.registrations[pid]; exists {
		select {
		case registration.statuses <- status:
		default:
		}
		return
	}
	children.pending[pid] = pendingChildStatus{status: status, reapedAt: time.Now()}
}

func (children *childReaper) sweep() {
	cutoff := time.Now().Add(-reaperStatusTTL)
	children.mu.Lock()
	defer children.mu.Unlock()
	for pid, pending := range children.pending {
		if pending.reapedAt.Before(cutoff) {
			delete(children.pending, pid)
		}
	}
}

func (children *childReaper) wait(command *exec.Cmd) (int, error) {
	if command == nil || command.Process == nil {
		return -1, fmt.Errorf("wait for unstarted command")
	}
	pid := command.Process.Pid
	registration := children.register(pid)
	defer children.unregister(pid)

	err := command.Wait()
	if err == nil {
		return 0, nil
	}
	var exitError *exec.ExitError
	if errors.As(err, &exitError) {
		return normalizedExitCode(exitError.Sys()), nil
	}
	if status, exists := children.claim(pid, registration.registeredAt); exists {
		return normalizedExitCode(status), nil
	}

	timer := time.NewTimer(reaperWaitTimeout)
	defer timer.Stop()
	select {
	case status := <-registration.statuses:
		return normalizedExitCode(status), nil
	case <-timer.C:
		return -1, fmt.Errorf("recover exit status for child %d: %w", pid, err)
	}
}

func normalizedExitCode(value any) int {
	status, ok := value.(syscall.WaitStatus)
	if !ok {
		return -1
	}
	if status.Signaled() {
		return signalExitCodeBase + int(status.Signal())
	}
	return status.ExitStatus()
}

func (children *childReaper) register(pid int) *childRegistration {
	registration := &childRegistration{statuses: make(chan syscall.WaitStatus, 1), registeredAt: time.Now()}
	children.mu.Lock()
	children.registrations[pid] = registration
	children.mu.Unlock()
	return registration
}

func (children *childReaper) unregister(pid int) {
	children.mu.Lock()
	delete(children.registrations, pid)
	children.mu.Unlock()
}

func (children *childReaper) claim(pid int, registeredAt time.Time) (syscall.WaitStatus, bool) {
	children.mu.Lock()
	defer children.mu.Unlock()
	pending, exists := children.pending[pid]
	if !exists {
		return 0, false
	}
	delete(children.pending, pid)
	if registeredAt.Sub(pending.reapedAt) > reaperMatchWindow {
		return 0, false
	}
	return pending.status, true
}
