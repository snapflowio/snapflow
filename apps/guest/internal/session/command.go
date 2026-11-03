// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	common_errors "github.com/snapflowio/common-go/pkg/errors"
)

func (s *Service) GetCommand(sessionID, commandID string) (*Command, error) {
	_, found, err := s.lookupCommand(sessionID, commandID)
	if err != nil {
		return nil, err
	}
	return snapshot(found)
}

func (s *Service) Get(sessionID string) (*Session, error) {
	found, err := s.lookup(sessionID)
	if err != nil {
		return nil, err
	}
	return s.describe(found)
}

func (s *Service) List() ([]Session, error) {
	sessions := []Session{}
	for _, found := range s.sessions.Items() {
		if found.id == EntrypointID {
			continue
		}
		described, err := s.describe(found)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, *described)
	}
	return sessions, nil
}

func (s *Service) describe(found *session) (*Session, error) {
	described := &Session{ID: found.id, Commands: []Command{}}
	for _, item := range found.commands.Items() {
		current, err := snapshot(item)
		if err != nil {
			return nil, err
		}
		described.Commands = append(described.Commands, *current)
	}
	return described, nil
}

func snapshot(item *command) (*Command, error) {
	current := &Command{ID: item.id, Command: item.text, ExitCode: item.recordedExitCode()}
	if current.ExitCode != nil {
		return current, nil
	}
	exitCode, exited, err := readExitCode(item.exitCodePath())
	if err != nil {
		return nil, common_errors.NewInternalServerError(err)
	}
	if exited {
		item.recordExitCode(exitCode)
		current.ExitCode = &exitCode
	}
	return current, nil
}
