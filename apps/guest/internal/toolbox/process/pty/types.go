// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package pty

import (
	"context"
	"log/slog"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	cmap "github.com/orcaman/concurrent-map/v2"
	"github.com/snapflowio/guest/internal/childreap"
)

const (
	writeWait           = 10 * time.Second
	readLimit           = 64 << 10
	readBufferSize      = 32 << 10
	inputQueueCapacity  = 1024
	clientSendCapacity  = 256
	terminalEnvironment = "TERM"
	defaultTerminal     = "xterm-256color"
	shellInteractive    = "-i"
	shellLogin          = "-l"
)

const (
	defaultCols      uint16 = 80
	defaultRows      uint16 = 24
	maximumDimension uint16 = 1000
)

type PTYController struct {
	logger   *slog.Logger
	reaper   *childreap.Reaper
	workDir  string
	sessions *PTYManager
}

type PTYManager struct {
	sessions cmap.ConcurrentMap[string, *PTYSession]
}

type wsClient struct {
	id        string
	conn      *websocket.Conn
	logger    *slog.Logger
	send      chan []byte
	done      chan struct{}
	closeOnce sync.Once
	writeMu   sync.Mutex
}

type PTYSession struct {
	logger *slog.Logger

	info PTYSessionInfo

	registry *PTYManager
	reaper   *childreap.Reaper

	cmd     *exec.Cmd
	ptmx    *os.File
	stopped <-chan struct{}
	cancel  context.CancelFunc

	clients   cmap.ConcurrentMap[string, *wsClient]
	clientsMu sync.RWMutex

	inCh chan []byte

	mu sync.Mutex
}

type PTYSessionInfo struct {
	ID        string            `json:"id" validate:"required"`
	Cwd       string            `json:"cwd" validate:"required"`
	Envs      map[string]string `json:"envs" validate:"required"`
	Cols      uint16            `json:"cols" validate:"required"`
	Rows      uint16            `json:"rows" validate:"required"`
	CreatedAt time.Time         `json:"createdAt" validate:"required"`
	Active    bool              `json:"active" validate:"required"`
	LazyStart bool              `json:"lazyStart" validate:"required"` // Whether this session uses lazy start
} //	@name	PtySessionInfo

type PTYCreateRequest struct {
	ID        string            `json:"id"`
	Cwd       string            `json:"cwd,omitempty"`
	Envs      map[string]string `json:"envs,omitempty"`
	Cols      *uint16           `json:"cols" validate:"optional"`
	Rows      *uint16           `json:"rows" validate:"optional"`
	LazyStart bool              `json:"lazyStart,omitempty"` // Don't start PTY until first client connects
} //	@name	PtyCreateRequest

type PTYCreateResponse struct {
	SessionID string `json:"sessionId" validate:"required"`
} //	@name	PtyCreateResponse

type PTYListResponse struct {
	Sessions []PTYSessionInfo `json:"sessions" validate:"required"`
} //	@name	PtyListResponse

type PTYResizeRequest struct {
	Cols uint16 `json:"cols" binding:"required,min=1,max=1000"`
	Rows uint16 `json:"rows" binding:"required,min=1,max=1000"`
} //	@name	PtyResizeRequest
