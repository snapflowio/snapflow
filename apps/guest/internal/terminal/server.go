// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package terminal

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"strconv"

	"github.com/gorilla/websocket"
	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/common"
	"github.com/snapflowio/guest/internal/credentials"
	"github.com/snapflowio/guest/internal/serve"
	"github.com/snapflowio/guest/internal/wsstream"
)

const (
	listenNetwork   = "tcp"
	shellDirectory  = "/"
	terminalType    = "xterm-256color"
	websocketRoute  = "/ws"
	staticRoute     = "/"
	staticDirectory = "static"
)

type windowSize struct {
	Rows uint16 `json:"rows"`
	Cols uint16 `json:"cols"`
}

type Config struct {
	BindAddress   string
	AuthHeader    string
	AuthTokenFile string
}

type Dependencies struct {
	Logger *slog.Logger
	Reaper *childreap.Reaper
}

type Server struct {
	cfg    Config
	logger *slog.Logger
	reaper *childreap.Reaper
}

func New(cfg Config, deps Dependencies) *Server {
	return &Server{cfg: cfg, logger: deps.Logger.With(slog.String("component", "terminal")), reaper: deps.Reaper}
}

func (s *Server) Run(ctx context.Context) error {
	if _, err := credentials.ReadFile(s.cfg.AuthTokenFile); err != nil {
		return fmt.Errorf("read terminal service credential: %w", err)
	}
	handler, err := s.handler()
	if err != nil {
		return err
	}
	address := net.JoinHostPort(s.cfg.BindAddress, strconv.Itoa(guestspec.TerminalPort))
	listener, err := new(net.ListenConfig).Listen(ctx, listenNetwork, address)
	if err != nil {
		return fmt.Errorf("listen on terminal address %s: %w", address, err)
	}
	s.logger.Info("Starting terminal server", "address", address)
	return serve.HTTP(ctx, &http.Server{Handler: handler}, listener)
}

func (s *Server) handler() (http.Handler, error) {
	staticFS, err := fs.Sub(static, staticDirectory)
	if err != nil {
		return nil, fmt.Errorf("load terminal frontend: %w", err)
	}
	mux := http.NewServeMux()
	mux.Handle(staticRoute, http.FileServer(http.FS(staticFS)))
	mux.HandleFunc(websocketRoute, s.handleWebSocket)
	return credentials.RequireHeader(s.cfg.AuthHeader, s.cfg.AuthTokenFile, mux), nil
}

func (s *Server) handleWebSocket(writer http.ResponseWriter, request *http.Request) {
	conn, err := wsstream.Upgrade(writer, request)
	if err != nil {
		s.logger.Error("Failed to upgrade terminal WebSocket connection", "error", err)
		return
	}
	defer func() {
		if err := conn.Close(); err != nil {
			s.logger.Debug("Failed to close terminal WebSocket connection", "error", err)
		}
	}()

	ctx, cancel := context.WithCancel(request.Context())
	defer cancel()
	sizes := make(chan common.TTYSize)
	input, inputWriter := io.Pipe()
	defer func() {
		if err := input.Close(); err != nil {
			s.logger.Debug("Failed to close terminal input", "error", err)
		}
	}()
	go s.pumpInput(ctx, cancel, conn, inputWriter, sizes)

	exitCode, err := common.SpawnTTY(ctx, s.reaper, common.SpawnTTYOptions{
		Dir:    shellDirectory,
		StdIn:  input,
		StdOut: &textWriter{conn: conn, decoder: NewUTF8Decoder()},
		Term:   terminalType,
		SizeCh: sizes,
	})
	if err != nil {
		s.logger.Error("Terminal PTY failed", "exitCode", exitCode, "error", err)
		return
	}
	s.logger.Debug("Terminal shell exited", "exitCode", exitCode)
}

func (s *Server) pumpInput(ctx context.Context, cancel context.CancelFunc, conn *websocket.Conn, input *io.PipeWriter, sizes chan<- common.TTYSize) {
	defer cancel()
	defer close(sizes)
	for {
		messageType, payload, err := conn.ReadMessage()
		if err != nil {
			return
		}
		if size, isResize := parseResize(messageType, payload); isResize {
			select {
			case sizes <- size:
			case <-ctx.Done():
				return
			}
			continue
		}
		if _, err := input.Write(payload); err != nil {
			return
		}
	}
}

func parseResize(messageType int, payload []byte) (common.TTYSize, bool) {
	if messageType != websocket.TextMessage {
		return common.TTYSize{}, false
	}
	var size windowSize
	if err := json.Unmarshal(payload, &size); err != nil {
		return common.TTYSize{}, false
	}
	return common.TTYSize{Height: size.Rows, Width: size.Cols}, true
}

type textWriter struct {
	conn    *websocket.Conn
	decoder *UTF8Decoder
}

func (w *textWriter) Write(payload []byte) (int, error) {
	if err := w.conn.WriteMessage(websocket.TextMessage, []byte(w.decoder.Write(payload))); err != nil {
		return 0, err
	}
	return len(payload), nil
}
