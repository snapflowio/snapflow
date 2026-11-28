// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import "github.com/snapflowio/guest/internal/session"

type CreateSessionRequest struct {
	SessionId string `json:"sessionId" validate:"required"`
} //	@name	CreateSessionRequest

type SessionExecuteRequest struct {
	Command           string `json:"command" validate:"required"`
	RunAsync          bool   `json:"runAsync" validate:"optional"`
	SuppressInputEcho bool   `json:"suppressInputEcho" validate:"optional"`
} //	@name	SessionExecuteRequest

type SessionSendInputRequest struct {
	Data string `json:"data" validate:"required"`
} //	@name	SessionSendInputRequest

type SessionExecuteResponse struct {
	CommandId string  `json:"cmdId" validate:"required"`
	Output    *string `json:"output" validate:"optional"`
	Stdout    *string `json:"stdout" validate:"optional"`
	Stderr    *string `json:"stderr" validate:"optional"`
	ExitCode  *int    `json:"exitCode" validate:"optional"`
} //	@name	SessionExecuteResponse

type SessionCommandLogsResponse struct {
	Output string `json:"output" validate:"required"`
	Stdout string `json:"stdout" validate:"required"`
	Stderr string `json:"stderr" validate:"required"`
} //	@name	SessionCommandLogsResponse

type CommandDTO struct {
	Id       string `json:"id" validate:"required"`
	Command  string `json:"command" validate:"required"`
	ExitCode *int   `json:"exitCode,omitempty" validate:"optional"`
} //	@name	Command

type SessionDTO struct {
	SessionId string        `json:"sessionId" validate:"required"`
	Commands  []*CommandDTO `json:"commands" validate:"required"`
} //	@name	Session

func CommandToDTO(c *session.Command) *CommandDTO {
	return &CommandDTO{
		Id:       c.ID,
		Command:  c.Command,
		ExitCode: c.ExitCode,
	}
}

func SessionToDTO(s *session.Session) *SessionDTO {
	commands := make([]*CommandDTO, 0, len(s.Commands))
	for index := range s.Commands {
		commands = append(commands, CommandToDTO(&s.Commands[index]))
	}

	return &SessionDTO{
		SessionId: s.ID,
		Commands:  commands,
	}
}
