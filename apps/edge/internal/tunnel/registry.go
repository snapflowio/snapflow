// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	heartbeatInterval         = 10 * time.Second
	heartbeatResponseTimeout  = 5 * time.Second
	datagramDispatchStripes   = 16
	datagramDispatchDepth     = 64
	datagramDispatchByteLimit = 16 << 20
	maxSteadyTunnelSessions   = 20_000
	maxTunnelSessions         = 40_000
	maxSessionsPerBinding     = 2
	negativeTargetCacheLimit  = 10_000
	targetUnavailableCacheTTL = 2 * time.Second
	targetCapacityCacheTTL    = time.Second
)

var ErrMachineUnavailable = errors.New("machine tunnel is unavailable")

type Routes interface {
	Load() *routes.Snapshot
}

type DatagramReceiver interface {
	HandleMachineDatagram(
		ctx context.Context,
		machineID uuid.UUID,
		backendID uuid.UUID,
		flowID uint64,
		payload []byte,
	) error
}

type Config struct {
	ListenAddress string
}

type Dependencies struct {
	EdgeID     uuid.UUID
	TLS        *tls.Config
	ServerKeys transport.ServerKeys
	Routes     Routes
	Receiver   DatagramReceiver
}

type Registry struct {
	config                 Config
	logger                 *slog.Logger
	edgeID                 uuid.UUID
	tls                    *tls.Config
	serverKeys             transport.ServerKeys
	routes                 Routes
	receiver               DatagramReceiver
	mu                     sync.RWMutex
	sessions               map[uuid.UUID]*sessionPool
	backendStreams         map[uuid.UUID]int64
	negativeTargets        map[negativeTargetKey]time.Time
	sessionNum             atomic.Int32
	handshakes             *handshakeGate
	datagrams              datagramMetrics
	bindingFenceRejections atomic.Uint64
	draining               atomic.Bool
	acknowledgementChanges chan struct{}
}

func New(
	config Config,
	dependencies Dependencies,
	opts ...Option,
) (*Registry, error) {
	if dependencies.EdgeID == uuid.Nil || config.ListenAddress == "" || dependencies.TLS == nil ||
		dependencies.Routes == nil || dependencies.Receiver == nil {
		return nil, errors.New(
			"tunnel registry requires edge identity, a listener, TLS, routes, and a datagram receiver",
		)
	}
	handshakes, err := newHandshakeGate(
		maxConcurrentTunnelHandshakes,
		maxTunnelHandshakesPerIP,
	)
	if err != nil {
		return nil, fmt.Errorf("initialize tunnel handshake admission: %w", err)
	}
	return &Registry{
		config:                 config,
		logger:                 newOptions(opts).logger,
		edgeID:                 dependencies.EdgeID,
		tls:                    dependencies.TLS,
		serverKeys:             dependencies.ServerKeys,
		routes:                 dependencies.Routes,
		receiver:               dependencies.Receiver,
		sessions:               make(map[uuid.UUID]*sessionPool),
		backendStreams:         make(map[uuid.UUID]int64),
		negativeTargets:        make(map[negativeTargetKey]time.Time),
		handshakes:             handshakes,
		acknowledgementChanges: make(chan struct{}, 1),
	}, nil
}

func (registry *Registry) Run(ctx context.Context) error {
	runContext, cancel := context.WithCancel(ctx)
	transportConfig := transport.DefaultServerConfig()
	transportConfig.ServerAdmission = registry.handshakes.Admit
	serverKeys := registry.serverKeys
	transportConfig.ServerKeys = &serverKeys
	listener, err := transport.Listen(
		runContext,
		registry.config.ListenAddress,
		registry.tls,
		transportConfig,
	)
	if err != nil {
		cancel()
		return fmt.Errorf("listen for Machine tunnels: %w", err)
	}
	registry.logger.Info("edge tunnel listener started", "address", listener.Addr())
	var sessions sync.WaitGroup
	var acceptErr error
	for {
		session, err := listener.Accept(runContext)
		if err != nil {
			acceptErr = err
			break
		}
		sessions.Add(1)
		go func() {
			defer sessions.Done()
			if err := registry.serve(runContext, session); err != nil &&
				runContext.Err() == nil {
				registry.logger.Debug("Machine tunnel ended", "error", err)
			}
		}()
	}
	cancel()
	closeErr := listener.Close()
	sessions.Wait()
	if ctx.Err() != nil {
		return closeErr
	}
	return errors.Join(acceptErr, closeErr)
}

func (registry *Registry) BeginDrain() {
	registry.draining.Store(true)
}

func (registry *Registry) BindingAcknowledgementChanges() <-chan struct{} {
	return registry.acknowledgementChanges
}

func (registry *Registry) markAcknowledged(session *machineSession) {
	if session.acknowledged.Swap(true) {
		return
	}
	select {
	case registry.acknowledgementChanges <- struct{}{}:
	default:
	}
}
