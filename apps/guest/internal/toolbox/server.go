// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//	@title			Snapflow Toolbox API
//	@version		v0.0.0-dev
//	@description	Snapflow Toolbox API. Clients request the sandbox's protected toolbox system exposure from the Snapflow API and use the returned Edge URL.
//	@schemes		https
//	@license.name	Apache-2.0
//	@license.url	https://www.apache.org/licenses/LICENSE-2.0

//	@securityDefinitions.apikey	Bearer
//	@in							header
//	@name						Authorization
//	@description				Type "Bearer" followed by a space and your API key.

package toolbox

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/computer-use/plugin"
	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/credentials"
	"github.com/snapflowio/guest/internal/serve"
	"github.com/snapflowio/guest/internal/session"
	"github.com/snapflowio/guest/internal/toolbox/computeruse"
	"github.com/snapflowio/guest/internal/toolbox/computeruse/manager"
	"github.com/snapflowio/guest/internal/toolbox/port"
	"github.com/snapflowio/guest/internal/toolbox/process/interpreter"
)

const listenNetwork = "tcp"

type Config struct {
	WorkDir               string
	ComputerUsePluginPath string
	AuthTokenFile         string
	AuthHeader            string
	BindAddress           string
}

type Dependencies struct {
	Logger   *slog.Logger
	Reaper   *childreap.Reaper
	Sessions *session.Service
}

type Server struct {
	cfg         Config
	logger      *slog.Logger
	reaper      *childreap.Reaper
	sessions    *session.Service
	computerUse *computeruse.LazyComputerUse
}

func New(cfg Config, deps Dependencies) *Server {
	cfg.ComputerUsePluginPath = strings.TrimSpace(cfg.ComputerUsePluginPath)
	cfg.AuthTokenFile = strings.TrimSpace(cfg.AuthTokenFile)
	cfg.AuthHeader = strings.TrimSpace(cfg.AuthHeader)
	return &Server{
		cfg:         cfg,
		logger:      deps.Logger.With(slog.String("component", "toolbox_server")),
		reaper:      deps.Reaper,
		sessions:    deps.Sessions,
		computerUse: computeruse.NewLazyComputerUse(),
	}
}

func (s *Server) Run(ctx context.Context) error {
	if _, err := credentials.ReadFile(s.cfg.AuthTokenFile); err != nil {
		return fmt.Errorf("load toolbox authentication credential: %w", err)
	}
	if s.cfg.AuthHeader == "" {
		return errors.New("toolbox authentication header is required")
	}
	address := net.JoinHostPort(s.cfg.BindAddress, strconv.Itoa(guestspec.ToolboxPort))
	listener, err := new(net.ListenConfig).Listen(ctx, listenNetwork, address)
	if err != nil {
		return fmt.Errorf("listen on toolbox address %s: %w", address, err)
	}

	interpreterController := interpreter.NewInterpreterController(s.logger, s.reaper, s.cfg.WorkDir)
	portDetector := port.NewDetector()
	router := s.newRouter(routerDeps{ //nolint:contextcheck // registers echo handlers, which take their context from the request at serve time
		ComputerUse: s.computerUse,
		Interpreter: interpreterController,
		Ports:       portDetector,
	})
	interpreterController.PrewarmDefaultContext(ctx)
	go portDetector.Run(ctx)
	loaded := make(chan *manager.Plugin, 1)
	go func() { loaded <- s.loadComputerUse(ctx) }()

	s.logger.Info("Starting toolbox server", "address", address)
	serveErr := serve.HTTP(ctx, &http.Server{Handler: router}, listener)
	s.stopComputerUse(<-loaded)
	return serveErr
}

func (s *Server) loadComputerUse(ctx context.Context) *manager.Plugin {
	if s.cfg.ComputerUsePluginPath == "" {
		s.computerUse.MarkUnavailable()
		s.logger.Info("Computer use is unavailable because the sandbox was created without the desktop capability")
		return nil
	}
	loaded, err := manager.Load(ctx, s.logger, s.reaper, s.cfg.ComputerUsePluginPath)
	if err != nil {
		s.computerUse.MarkFailed(err)
		s.logger.Error("Failed to load the computer-use plugin; continuing without computer use", "error", err)
		return nil
	}
	s.computerUse.Set(loaded.ComputerUse)
	if err := startDesktop(loaded.ComputerUse); err != nil {
		s.logger.Error("Failed to start the desktop; it can still be started on demand", "error", err)
	}
	return loaded
}

// startDesktop brings the desktop up as soon as the plugin loads, so the first
// desktop view does not wait for the processes to start.
func startDesktop(computerUse plugin.ComputerUse) error {
	started, err := computerUse.Start()
	if err != nil {
		return fmt.Errorf("start computer use: %w", err)
	}
	if started == nil {
		return errors.New("start computer use: the plugin returned no response")
	}
	return nil
}

func (s *Server) stopComputerUse(loaded *manager.Plugin) {
	if loaded == nil {
		return
	}
	defer loaded.Close()
	s.logger.Info("Stopping computer use")
	if _, err := loaded.ComputerUse.Stop(); err != nil {
		s.logger.Error("Failed to stop computer use", "error", err)
	}
}
