// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sshgateway

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"

	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"golang.org/x/crypto/ssh"
	"golang.org/x/sync/singleflight"
)

const (
	sshSandboxUser               = "snapflow"
	sshDialTimeout               = 30 * time.Second
	sshAccessTimeout             = 10 * time.Second
	sshHandshakeTimeout          = 30 * time.Second
	maximumConcurrentConnections = 256
	sshLoopbackHost              = "127.0.0.1"
	loopbackNetwork              = "tcp"
)

type Service struct {
	log          *slog.Logger
	runtime      sandboxruntime.GuestServices
	access       AccessControl
	port         int
	serverConfig *ssh.ServerConfig
	hostKey      string
	slots        chan struct{}
	resolutions  singleflight.Group
	mu           sync.Mutex
	listener     net.Listener
}

func (s *Service) Prepare(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.listener != nil {
		return errors.New("machine SSH gateway is already prepared")
	}
	listener, err := (&net.ListenConfig{}).Listen(
		ctx,
		loopbackNetwork,
		net.JoinHostPort(sshLoopbackHost, strconv.Itoa(s.port)),
	)
	if err != nil {
		return fmt.Errorf("listen on host-local SSH port %d: %w", s.port, err)
	}
	s.listener = listener
	if address, ok := listener.Addr().(*net.TCPAddr); ok {
		s.port = address.Port
	}
	return nil
}

func New(cfg Config, deps Dependencies, opts ...Option) (*Service, error) {
	if deps.Runtime == nil || deps.Access == nil {
		return nil, errors.New("machine SSH relay dependencies are incomplete")
	}
	hostKey, err := cfg.load()
	if err != nil {
		return nil, err
	}

	service := &Service{
		log:     newOptions(opts).logger.With(slog.String("component", "ssh_relay_service")),
		runtime: deps.Runtime,
		access:  deps.Access,
		port:    cfg.Port,
		slots:   make(chan struct{}, maximumConcurrentConnections),
	}
	service.serverConfig = &ssh.ServerConfig{
		NoClientAuth: true,
	}
	service.serverConfig.AddHostKey(hostKey)
	service.hostKey = strings.TrimSpace(string(ssh.MarshalAuthorizedKey(hostKey.PublicKey())))

	return service, nil
}

func (s *Service) GetPort() int {
	return s.port
}

func (s *Service) PublicHostKey() string {
	return s.hostKey
}

func (s *Service) DialSSHGateway(ctx context.Context) (net.Conn, error) {
	connection, err := (&net.Dialer{}).DialContext(
		ctx,
		loopbackNetwork,
		net.JoinHostPort(sshLoopbackHost, strconv.Itoa(s.port)),
	)
	if err != nil {
		return nil, fmt.Errorf("dial host-local SSH gateway: %w", err)
	}
	return connection, nil
}

func (s *Service) Run(ctx context.Context) error {
	s.mu.Lock()
	listener := s.listener
	s.mu.Unlock()
	if listener == nil {
		return errors.New("machine SSH gateway is not prepared")
	}
	stopClosing := context.AfterFunc(ctx, func() {
		if err := listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
			s.log.WarnContext(ctx, "Failed to close SSH gateway listener", "error", err)
		}
	})
	defer stopClosing()
	var connections sync.WaitGroup
	defer connections.Wait()
	s.log.InfoContext(ctx, "SSH relay listening on loopback", "port", s.port)
	return s.acceptLoop(ctx, listener, &connections)
}

func (s *Service) acceptLoop(ctx context.Context, listener net.Listener, connections *sync.WaitGroup) error {
	for {
		conn, err := listener.Accept()
		if err != nil {
			return s.acceptFailed(ctx, listener, err)
		}
		s.admit(ctx, conn, connections)
	}
}

func (s *Service) acceptFailed(ctx context.Context, listener net.Listener, err error) error {
	if ctx.Err() != nil || errors.Is(err, net.ErrClosed) {
		return nil
	}
	closeErr := listener.Close()
	if closeErr != nil && !errors.Is(closeErr, net.ErrClosed) {
		return errors.Join(fmt.Errorf("accept SSH connection: %w", err), closeErr)
	}
	return fmt.Errorf("accept SSH connection: %w", err)
}

func (s *Service) admit(ctx context.Context, conn net.Conn, connections *sync.WaitGroup) {
	select {
	case s.slots <- struct{}{}:
	default:
		s.log.WarnContext(ctx, "Rejected SSH connection: the concurrent connection limit is reached", "limit", maximumConcurrentConnections)
		if err := conn.Close(); err != nil {
			s.log.DebugContext(ctx, "Failed to close rejected SSH connection", "error", err)
		}
		return
	}
	connections.Go(func() {
		defer func() { <-s.slots }()
		stopClosing := context.AfterFunc(ctx, func() {
			if err := conn.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
				s.log.DebugContext(ctx, "Failed to close SSH connection on shutdown", "error", err)
			}
		})
		defer stopClosing()
		s.handleConnection(ctx, conn)
	})
}

func (s *Service) Close() error {
	s.mu.Lock()
	listener := s.listener
	s.listener = nil
	s.mu.Unlock()
	if listener == nil {
		return nil
	}
	if err := listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		return fmt.Errorf("close SSH gateway listener: %w", err)
	}
	return nil
}
