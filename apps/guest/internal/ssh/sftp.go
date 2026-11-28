// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package ssh

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"

	"github.com/gliderlabs/ssh"
	"github.com/pkg/sftp"
	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/sandbox"
)

const (
	SFTPServerCommand = "sftp-server"
	selfExecutable    = "/proc/self/exe"
)

type standardStreams struct {
	io.Reader
	io.WriteCloser
}

func ServeSFTP() error {
	server, err := sftp.NewServer(standardStreams{Reader: os.Stdin, WriteCloser: os.Stdout}, sftp.WithDebug(io.Discard))
	if err != nil {
		return fmt.Errorf("start the SFTP server: %w", err)
	}
	serveErr := server.Serve()
	if errors.Is(serveErr, io.EOF) {
		serveErr = nil
	}
	return errors.Join(serveErr, server.Close())
}

func (s *Server) sftpHandler(session ssh.Session) {
	user, err := sandbox.DefaultUser()
	if err != nil {
		s.logger.Error("Failed to resolve the sandbox user for SFTP", "error", err)
		s.reportExit(session, genericFailureExitStatus)
		return
	}
	cmd := exec.CommandContext(session.Context(), selfExecutable, SFTPServerCommand)
	cmd.Dir = user.Home
	cmd.Stdin = session
	cmd.Stdout = session
	cmd.Stderr = session.Stderr()
	cmd.WaitDelay = childreap.PipeDrainTimeout
	user.Configure(cmd)
	if err := cmd.Start(); err != nil {
		s.logger.Error("Failed to start the SFTP server", "error", err)
		s.reportExit(session, genericFailureExitStatus)
		return
	}
	exitCode, err := s.reaper.Wait(cmd)
	if err != nil {
		s.logger.Error("SFTP server completed with error", "exitCode", exitCode, "error", err)
	}
	s.reportExit(session, exitCode)
}
