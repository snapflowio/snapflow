// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package childreap

import (
	"bytes"
	"errors"
	"fmt"
	"os/exec"
	"sync"
	"syscall"
	"time"

	reaper "github.com/ramr/go-reaper"
)

const (
	statusChannelBuf     = 1024
	pendingTTL           = 10 * time.Second
	pendingSweepInterval = 5 * time.Second
	recoveryTimeout      = 5 * time.Second
	pendingMaxAge        = time.Second
	PipeDrainTimeout     = 30 * time.Second
	failedExitCode       = -1
	reapAllChildren      = -1
)

var (
	errNotStarted = errors.New("the command was not started")
	errOutputSet  = errors.New("the command output is already set")
)

type registration struct {
	statuses     chan syscall.WaitStatus
	registeredAt time.Time
}

type pendingStatus struct {
	status  syscall.WaitStatus
	addedAt time.Time
}

type Reaper struct {
	mu       sync.Mutex
	registry map[int]*registration
	pending  map[int]pendingStatus
	start    sync.Once
}

func New() *Reaper {
	return &Reaper{registry: make(map[int]*registration), pending: make(map[int]pendingStatus)}
}

func (r *Reaper) Start() {
	r.start.Do(func() {
		statuses := make(chan reaper.Status, statusChannelBuf)
		go r.dispatch(statuses)
		go reaper.Start(reaper.Config{Pid: reapAllChildren, StatusChannel: statuses})
	})
}

func (r *Reaper) dispatch(statuses chan reaper.Status) {
	ticker := time.NewTicker(pendingSweepInterval)
	defer ticker.Stop()
	for {
		select {
		case reaped, open := <-statuses:
			if !open {
				return
			}
			r.record(reaped.Pid, reaped.WaitStatus)
		case <-ticker.C:
			r.sweepPending()
		}
	}
}

func (r *Reaper) record(pid int, status syscall.WaitStatus) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if registered, ok := r.registry[pid]; ok {
		select {
		case registered.statuses <- status:
		default:
		}
		return
	}
	r.pending[pid] = pendingStatus{status: status, addedAt: time.Now()}
}

func (r *Reaper) sweepPending() {
	cutoff := time.Now().Add(-pendingTTL)
	r.mu.Lock()
	defer r.mu.Unlock()
	for pid, pending := range r.pending {
		if pending.addedAt.Before(cutoff) {
			delete(r.pending, pid)
		}
	}
}

func (r *Reaper) Wait(cmd *exec.Cmd) (int, error) {
	return r.await(cmd, true)
}

func (r *Reaper) Reap(cmd *exec.Cmd) (int, error) {
	return r.await(cmd, false)
}

func (r *Reaper) await(cmd *exec.Cmd, drainOutput bool) (int, error) {
	if cmd == nil || cmd.Process == nil {
		return failedExitCode, errNotStarted
	}
	pid := cmd.Process.Pid
	registered := r.register(pid)
	defer r.unregister(pid)
	waited := waitFor(cmd)
	status, claimed := r.claimPending(pid, registered.registeredAt)
	if !claimed {
		select {
		case result := <-waited:
			return r.resolve(pid, registered, result)
		case status = <-registered.statuses:
		}
	}
	if drainOutput {
		<-waited
	}
	return status.ExitStatus(), nil
}

func (r *Reaper) resolve(pid int, registered *registration, result waitResult) (int, error) {
	if result.resolved {
		return result.exitCode, nil
	}
	if status, ok := r.claimPending(pid, registered.registeredAt); ok {
		return status.ExitStatus(), nil
	}
	select {
	case status := <-registered.statuses:
		return status.ExitStatus(), nil
	case <-time.After(recoveryTimeout):
		return failedExitCode, fmt.Errorf("lost exit status for pid %d: %w", pid, result.err)
	}
}

type waitResult struct {
	exitCode int
	err      error
	resolved bool
}

func waitFor(cmd *exec.Cmd) <-chan waitResult {
	waited := make(chan waitResult, 1)
	go func() {
		err := cmd.Wait()
		var exitErr *exec.ExitError
		switch {
		case err == nil:
			waited <- waitResult{resolved: true}
		case errors.As(err, &exitErr):
			waited <- waitResult{exitCode: exitErr.ExitCode(), resolved: true}
		default:
			waited <- waitResult{exitCode: failedExitCode, err: err}
		}
	}()
	return waited
}

func (r *Reaper) Execute(cmd *exec.Cmd) (int, error) {
	if cmd.WaitDelay == 0 {
		cmd.WaitDelay = PipeDrainTimeout
	}
	if err := cmd.Start(); err != nil {
		return failedExitCode, err
	}
	return r.Wait(cmd)
}

func (r *Reaper) CombinedOutput(cmd *exec.Cmd) ([]byte, int, error) {
	if cmd.Stdout != nil || cmd.Stderr != nil {
		return nil, failedExitCode, errOutputSet
	}
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	exitCode, err := r.Execute(cmd)
	return output.Bytes(), exitCode, err
}

func (r *Reaper) register(pid int) *registration {
	registered := &registration{statuses: make(chan syscall.WaitStatus, 1), registeredAt: time.Now()}
	r.mu.Lock()
	r.registry[pid] = registered
	r.mu.Unlock()
	return registered
}

func (r *Reaper) unregister(pid int) {
	r.mu.Lock()
	delete(r.registry, pid)
	r.mu.Unlock()
}

func (r *Reaper) claimPending(pid int, registeredAt time.Time) (syscall.WaitStatus, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	pending, ok := r.pending[pid]
	if !ok {
		return 0, false
	}
	delete(r.pending, pid)
	if registeredAt.Sub(pending.addedAt) > pendingMaxAge {
		return 0, false
	}
	return pending.status, true
}
