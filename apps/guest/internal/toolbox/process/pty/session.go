// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package pty

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"syscall"

	"github.com/creack/pty"
	"github.com/shirou/gopsutil/v4/process"
	"github.com/snapflowio/guest/internal/common"
)

const (
	signalExitBase  = 128
	exitSIGINT      = signalExitBase + int(syscall.SIGINT)
	exitSIGKILL     = signalExitBase + int(syscall.SIGKILL)
	exitSIGTERM     = signalExitBase + int(syscall.SIGTERM)
	processFailure  = 1
	cleanExitReason = "clean exit"
)

func exitReason(exitCode int) string {
	switch {
	case exitCode == 0:
		return cleanExitReason
	case exitCode == exitSIGINT:
		return "Ctrl+C"
	case exitCode == exitSIGKILL:
		return "SIGKILL"
	case exitCode == exitSIGTERM:
		return "SIGTERM"
	case exitCode > signalExitBase:
		return fmt.Sprintf("signal %d", exitCode-signalExitBase)
	default:
		return "non-zero exit"
	}
}

func (s *PTYSession) Info() PTYSessionInfo {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.info
}

func (s *PTYSession) start() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.info.Active {
		return nil
	}
	if s.cmd != nil {
		return errors.New("PTY session has already been used and cannot be restarted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, common.GetShell(), shellInteractive, shellLogin)
	cmd.Dir = s.info.Cwd
	cmd.Env = os.Environ()
	for key, value := range s.info.Envs {
		cmd.Env = append(cmd.Env, key+"="+value)
	}
	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: s.info.Rows, Cols: s.info.Cols})
	if err != nil {
		cancel()
		return fmt.Errorf("pty.StartWithSize: %w", err)
	}
	s.cmd = cmd
	s.ptmx = ptmx
	s.cancel = cancel
	s.stopped = ctx.Done()
	s.inCh = make(chan []byte, inputQueueCapacity)
	s.info.Active = true
	s.logger.Debug("Started PTY session", "sessionId", s.info.ID, "pid", cmd.Process.Pid)

	go s.ptyReadLoop(ptmx)
	go s.inputWriteLoop(ptmx, s.inCh, s.stopped)
	go s.awaitExit(cmd)
	return nil
}

func (s *PTYSession) awaitExit(cmd *exec.Cmd) {
	exitCode, err := s.reaper.Reap(cmd)
	if err != nil {
		exitCode = processFailure
	}
	s.mu.Lock()
	s.info.Active = false
	sessionID := s.info.ID
	s.mu.Unlock()
	s.closeClientsWithExitCode(exitCode)
	s.registry.Delete(sessionID)
	s.logger.Debug("PTY session process exited and cleaned up", "sessionId", sessionID, "exitCode", exitCode, "exitReason", exitReason(exitCode), "error", err)
}

func (s *PTYSession) kill() {
	s.mu.Lock()
	if !s.info.Active {
		s.mu.Unlock()
		return
	}
	sessionID := s.info.ID
	if s.cmd.Process != nil {
		killProcessTree(s.logger, s.cmd.Process.Pid)
	}
	s.cancel()
	if err := s.ptmx.Close(); err != nil {
		s.logger.Debug("failed to close PTY", "error", err)
	}
	s.info.Active = false
	s.mu.Unlock()

	s.closeClientsWithExitCode(exitSIGKILL)
	s.registry.Delete(sessionID)
}

func killProcessTree(logger *slog.Logger, pid int) {
	parent, err := process.NewProcess(int32(pid))
	if err != nil {
		return
	}
	descendants, err := parent.Children()
	if err != nil {
		return
	}
	for _, child := range descendants {
		killProcessTree(logger, int(child.Pid))
	}
	for _, child := range descendants {
		if err := syscall.Kill(int(child.Pid), syscall.SIGKILL); err != nil && !errors.Is(err, syscall.ESRCH) {
			logger.Debug("failed to kill PTY descendant", "pid", child.Pid, "error", err)
		}
	}
}

func (s *PTYSession) ptyReadLoop(ptmx *os.File) {
	buffer := make([]byte, readBufferSize)
	for {
		read, err := ptmx.Read(buffer)
		if read > 0 {
			s.broadcast(append([]byte(nil), buffer[:read]...))
		}
		if err != nil {
			return
		}
	}
}

func (s *PTYSession) inputWriteLoop(ptmx *os.File, input <-chan []byte, stopped <-chan struct{}) {
	for {
		select {
		case <-stopped:
			return
		case data := <-input:
			if _, err := ptmx.Write(data); err != nil {
				return
			}
		}
	}
}

func (s *PTYSession) sendToPTY(data []byte) error {
	s.mu.Lock()
	input, stopped := s.inCh, s.stopped
	s.mu.Unlock()
	if input == nil {
		return errors.New("PTY session input channel not available")
	}
	select {
	case input <- data:
		return nil
	case <-stopped:
		return errors.New("PTY session input channel closed")
	}
}

func (s *PTYSession) resize(cols, rows uint16) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.info.Active {
		return errors.New("cannot resize inactive PTY session")
	}
	if cols > maximumDimension || rows > maximumDimension {
		return fmt.Errorf("cols and rows must be at most %d", maximumDimension)
	}
	if err := pty.Setsize(s.ptmx, &pty.Winsize{Cols: cols, Rows: rows}); err != nil {
		s.logger.Debug("PTY resize error", "error", err)
		return err
	}
	s.info.Cols = cols
	s.info.Rows = rows
	return nil
}
