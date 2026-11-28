// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	"errors"
	"fmt"
	"os"
	"strings"

	common_errors "github.com/snapflowio/common-go/pkg/errors"
)

const (
	inputPipeMode = 0o600
	lineEnding    = "\n"
)

func (s *Service) SendInput(sessionID, commandID, data string) error {
	found, target, err := s.lookupCommand(sessionID, commandID)
	if err != nil {
		return err
	}
	if shell := found.process(); shell != nil && shell.ProcessState != nil && shell.ProcessState.Exited() {
		return common_errors.NewGoneError(errors.New("session process has exited"))
	}
	if exitCode := target.recordedExitCode(); exitCode != nil {
		return common_errors.NewGoneError(fmt.Errorf("command has already completed with exit code %d", *exitCode))
	}
	if !strings.HasSuffix(data, lineEnding) {
		data += lineEnding
	}
	if err := appendTo(target.inputPath(), data); err != nil {
		return common_errors.NewInternalServerError(fmt.Errorf("write to input pipe: %w", err))
	}
	if !target.suppressInputEcho {
		if err := appendTo(target.outputPath(), stdoutMarker+data); err != nil {
			s.logger.Debug("Failed to echo input to the command log", "error", err)
		}
	}
	return nil
}

func appendTo(path, data string) error {
	file, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, inputPipeMode)
	if err != nil {
		return err
	}
	_, writeErr := file.WriteString(data)
	return errors.Join(writeErr, file.Close())
}
