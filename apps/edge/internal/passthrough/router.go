// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package passthrough

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/netip"
	"sync"
	"sync/atomic"
	"time"

	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	tcpNetwork             = "tcp"
	clientHelloTimeout     = 10 * time.Second
	maxClassifyingSessions = 8192
)

type OriginStreams interface {
	OpenOriginStream(ctx context.Context, open protocol.OriginStreamOpen) (transport.Stream, error)
}

type Admission interface {
	AdmitHTTPConnection(source netip.Addr) (*admit.Permit, admit.Result)
}

type Dependencies struct {
	Origins   OriginStreams
	Admission Admission
}

type Counters struct {
	Forwarded         uint64
	OriginUnavailable uint64
	Rejected          uint64
	Fallback          uint64
	Dropped           uint64
}

type counters struct {
	forwarded         atomic.Uint64
	originUnavailable atomic.Uint64
	rejected          atomic.Uint64
	fallback          atomic.Uint64
	dropped           atomic.Uint64
}

type Router struct {
	address     string
	hosts       map[string]struct{}
	origins     OriginStreams
	admission   Admission
	fallback    *fallbackListener
	classifying chan struct{}
	logger      *slog.Logger
	counters    counters
}

func New(address string, config Config, dependencies Dependencies, opts ...Option) (*Router, error) {
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("origin passthrough: %w", err)
	}
	if dependencies.Origins == nil || dependencies.Admission == nil {
		return nil, errors.New("origin passthrough requires origin streams and admission")
	}
	resolved, err := net.ResolveTCPAddr(tcpNetwork, address)
	if err != nil {
		return nil, fmt.Errorf("resolve HTTPS listen address: %w", err)
	}
	hosts := make(map[string]struct{}, len(config.Hosts))
	for _, host := range config.Hosts {
		hosts[host] = struct{}{}
	}
	return &Router{
		address:     address,
		hosts:       hosts,
		origins:     dependencies.Origins,
		admission:   dependencies.Admission,
		fallback:    newFallbackListener(resolved),
		classifying: make(chan struct{}, maxClassifyingSessions),
		logger:      newOptions(opts).logger,
	}, nil
}

func (router *Router) Fallback() net.Listener {
	return router.fallback
}

func (router *Router) Counters() Counters {
	return Counters{
		Forwarded:         router.counters.forwarded.Load(),
		OriginUnavailable: router.counters.originUnavailable.Load(),
		Rejected:          router.counters.rejected.Load(),
		Fallback:          router.counters.fallback.Load(),
		Dropped:           router.counters.dropped.Load(),
	}
}

func (router *Router) Run(ctx context.Context) error {
	var listenConfig net.ListenConfig
	listener, err := listenConfig.Listen(ctx, tcpNetwork, router.address)
	if err != nil {
		return fmt.Errorf("listen for edge HTTPS ingress: %w", err)
	}
	router.logger.Info("edge HTTPS router started", "address", listener.Addr(), "origin_hosts", len(router.hosts))
	stop := context.AfterFunc(ctx, func() {
		if closeErr := listener.Close(); closeErr != nil {
			router.logger.Debug("could not close the edge HTTPS listener", "error", closeErr)
		}
	})
	defer stop()
	var connections sync.WaitGroup
	var acceptErr error
	for {
		connection, err := listener.Accept()
		if err != nil {
			acceptErr = err
			break
		}
		select {
		case router.classifying <- struct{}{}:
		default:
			router.counters.dropped.Add(1)
			proxy.CloseAndLog(router.logger, "unclassified HTTPS connection", connection)
			continue
		}
		connections.Go(func() { router.handle(ctx, connection) })
	}
	closeErr := router.fallback.Close()
	connections.Wait()
	if ctx.Err() != nil {
		return closeErr
	}
	return errors.Join(acceptErr, closeErr)
}

func (router *Router) handle(ctx context.Context, connection net.Conn) {
	serverName, consumed, err := router.classify(ctx, connection)
	<-router.classifying
	if err != nil {
		router.logger.Debug("could not read the TLS client hello", "remote_address", connection.RemoteAddr(), "error", err)
	}
	if _, origin := router.hosts[serverName]; origin && err == nil {
		router.forward(ctx, connection, serverName, consumed)
		return
	}
	if router.fallback.deliver(newReplayConn(connection, consumed)) {
		router.counters.fallback.Add(1)
		return
	}
	router.counters.dropped.Add(1)
	proxy.CloseAndLog(router.logger, "undeliverable HTTPS connection", connection)
}

func (router *Router) classify(ctx context.Context, connection net.Conn) (string, []byte, error) {
	if err := connection.SetReadDeadline(time.Now().Add(clientHelloTimeout)); err != nil {
		return "", nil, fmt.Errorf("set client hello deadline: %w", err)
	}
	serverName, consumed, err := readServerName(ctx, connection)
	if clearErr := connection.SetReadDeadline(time.Time{}); clearErr != nil {
		return "", consumed, errors.Join(err, fmt.Errorf("clear client hello deadline: %w", clearErr))
	}
	return serverName, consumed, err
}
