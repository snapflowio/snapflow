// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package interpreter

import (
	"context"
	"io"
	"log/slog"
	"os/exec"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/snapflowio/guest/internal/childreap"
)

const (
	writeWait          = 10 * time.Second
	gracePeriod        = 2 * time.Second
	workerScriptPerms  = 0o700
	defaultTimeout     = 10 * time.Minute
	jobQueueCapacity   = 128
	clientSendCapacity = 1024
	defaultContextID   = "default"
)

const (
	WebSocketCloseTimeout = 4008
)

const (
	ChunkTypeStdout  = "stdout"
	ChunkTypeStderr  = "stderr"
	ChunkTypeError   = "error"
	ChunkTypeControl = "control"
)

const (
	ControlChunkTypeCompleted   = "completed"
	ControlChunkTypeInterrupted = "interrupted"
)

const (
	CommandStatusRunning = "running"
	CommandStatusOK      = "ok"
	CommandStatusError   = "error"
	CommandStatusTimeout = "timeout"
)

const (
	LanguagePython = "python"
)

type Controller struct {
	logger   *slog.Logger
	workDir  string
	contexts *Manager
}

type CreateContextRequest struct {
	Cwd      *string `json:"cwd" validate:"optional"`
	Language *string `json:"language" validate:"optional"`
} //	@name	CreateContextRequest

type ExecuteRequest struct {
	Code      string             `json:"code" binding:"required"`
	ContextID *string            `json:"contextId" validate:"optional"`
	Timeout   *int64             `json:"timeout" validate:"optional"`
	Envs      *map[string]string `json:"envs" validate:"optional"`
} //	@name	ExecuteRequest

type ListContextsResponse struct {
	Contexts []ContextInfo `json:"contexts" binding:"required"`
} //	@name	ListContextsResponse

type ContextInfo struct {
	ID        string    `json:"id" binding:"required"`
	Cwd       string    `json:"cwd" binding:"required"`
	CreatedAt time.Time `json:"createdAt" binding:"required"`
	Active    bool      `json:"active" binding:"required"`
	Language  string    `json:"language" binding:"required"`
} //	@name	InterpreterContext

type Context struct {
	info   ContextInfo
	logger *slog.Logger
	reaper *childreap.Reaper

	mu     sync.Mutex
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser
	cancel context.CancelFunc
	done   chan struct{}
	queue  chan execJob
	client *wsClient

	commandMu     sync.Mutex
	activeCommand *CommandExecution
}

type CommandExecution struct {
	ID        string     `json:"id" binding:"required"`
	Code      string     `json:"code" binding:"required"`
	Status    string     `json:"status" binding:"required"`
	Error     *Error     `json:"error,omitempty"`
	StartedAt time.Time  `json:"startedAt" binding:"required"`
	EndedAt   *time.Time `json:"endedAt,omitempty"`
	finished  chan struct{}
	completed bool
}

type Error struct {
	Name      string `json:"name" binding:"required"`
	Value     string `json:"value" binding:"required"`
	Traceback string `json:"traceback" binding:"required"`
}

type wsClient struct {
	id        string
	conn      *websocket.Conn
	send      chan wsFrame
	done      chan struct{}
	closeOnce sync.Once
	logger    *slog.Logger
}

type wsFrame struct {
	output *OutputMessage
	close  *closeRequest
}

type closeRequest struct {
	code    int
	message string
}

type OutputMessage struct {
	Type      string `json:"type" binding:"required"`
	Text      string `json:"text" binding:"required"`
	Name      string `json:"name" binding:"required"`
	Value     string `json:"value" binding:"required"`
	Traceback string `json:"traceback" binding:"required"`
}

type WorkerCommand struct {
	ID   string            `json:"id" binding:"required"`
	Code string            `json:"code" binding:"required"`
	Envs map[string]string `json:"envs" binding:"required"`
}

type execJob struct {
	code    string
	envs    map[string]string
	timeout time.Duration
	ws      *websocket.Conn
}
