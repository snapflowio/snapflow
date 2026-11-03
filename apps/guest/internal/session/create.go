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

	cmap "github.com/orcaman/concurrent-map/v2"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/common"
)

const directoryMode = 0o755

func (s *Service) Create(ctx context.Context, sessionID string) error {
	if err := ValidateID(sessionID); err != nil {
		return err
	}
	dir, err := s.directory(sessionID)
	if err != nil {
		return err
	}
	sessionContext, cancel := context.WithCancel(context.WithoutCancel(ctx))
	reserved := &session{id: sessionID, dir: dir, commands: cmap.New[*command](), ended: sessionContext.Done(), cancel: cancel}
	if !s.sessions.SetIfAbsent(sessionID, reserved) {
		cancel()
		return common_errors.NewConflictError(errors.New("session already exists"))
	}
	if err := s.start(sessionContext, reserved); err != nil {
		s.sessions.Remove(sessionID)
		cancel()
		return err
	}
	return nil
}

func (s *Service) start(ctx context.Context, reserved *session) error {
	if err := os.MkdirAll(reserved.dir, directoryMode); err != nil {
		return fmt.Errorf("create session directory: %w", err)
	}
	cmd := exec.CommandContext(ctx, common.GetShell())
	cmd.Env = os.Environ()
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	stdinWriter, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("open session shell input: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start session shell: %w", err)
	}
	reserved.attach(cmd, stdinWriter)
	return nil
}
