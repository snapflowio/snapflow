// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v4/process"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
)

func (s *Service) Delete(ctx context.Context, sessionID string) error {
	found, err := s.lookup(sessionID)
	if err != nil {
		return err
	}
	if err := s.terminate(ctx, found); err != nil {
		s.logger.ErrorContext(ctx, "Failed to terminate session", "sessionId", found.id, "error", err)
	}
	found.cancel()
	if err := os.RemoveAll(found.dir); err != nil {
		return common_errors.NewInternalServerError(fmt.Errorf("remove session directory: %w", err))
	}
	s.sessions.Remove(found.id)
	return nil
}

func (s *Service) terminate(ctx context.Context, found *session) error {
	shell := found.process()
	if shell == nil || shell.Process == nil {
		return nil
	}
	pid := shell.Process.Pid
	s.signalSession(ctx, found.id, pid, syscall.SIGTERM)
	if s.waitForTermination(ctx, pid) {
		s.logger.DebugContext(ctx, "Session terminated gracefully", "sessionId", found.id)
		s.reap(found.id, shell)
		return nil
	}
	s.logger.DebugContext(ctx, "Session timeout, sending SIGKILL to process group", "sessionId", found.id)
	s.signalSession(ctx, found.id, pid, syscall.SIGKILL)
	err := shell.Process.Kill()
	s.reap(found.id, shell)
	if errors.Is(err, os.ErrProcessDone) {
		return nil
	}
	return err
}

func (s *Service) signalSession(ctx context.Context, sessionID string, pid int, signal syscall.Signal) {
	if err := syscall.Kill(-pid, signal); err != nil && !errors.Is(err, syscall.ESRCH) {
		s.logger.DebugContext(ctx, "Failed to signal session process group", "sessionId", sessionID, "signal", signal, "error", err)
	}
	s.signalProcessTree(ctx, pid, signal)
}

func (s *Service) reap(sessionID string, shell *exec.Cmd) {
	go func() {
		if _, err := s.reaper.Reap(shell); err != nil {
			s.logger.Debug("Failed to reap session process", "sessionId", sessionID, "error", err)
		}
	}()
}

func (s *Service) signalProcessTree(ctx context.Context, pid int, signal syscall.Signal) {
	parent, err := process.NewProcessWithContext(ctx, int32(pid))
	if err != nil {
		return
	}
	descendants, err := parent.ChildrenWithContext(ctx)
	if err != nil {
		return
	}
	for _, child := range descendants {
		s.signalProcessTree(ctx, int(child.Pid), signal)
	}
	for _, child := range descendants {
		if err := syscall.Kill(int(child.Pid), signal); err != nil && !errors.Is(err, syscall.ESRCH) {
			s.logger.Debug("Failed to signal descendant process", "pid", child.Pid, "signal", signal, "error", err)
		}
	}
}

func (s *Service) waitForTermination(ctx context.Context, pid int) bool {
	timeoutContext, cancel := context.WithTimeout(ctx, s.cfg.TerminationGracePeriod)
	defer cancel()
	ticker := time.NewTicker(s.cfg.TerminationCheckInterval)
	defer ticker.Stop()
	for {
		select {
		case <-timeoutContext.Done():
			return false
		case <-ticker.C:
			parent, err := process.NewProcessWithContext(timeoutContext, int32(pid))
			if err != nil {
				return true
			}
			children, err := parent.ChildrenWithContext(timeoutContext)
			if err != nil || len(children) == 0 {
				return true
			}
		}
	}
}
