// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package udp

import (
	"context"
	"errors"
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/sockets"
	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	flowMaintenanceInterval = 5 * time.Second
	workerGoroutines        = 3
)

type socketWorker struct {
	parent      *Frontend
	group       *listenerGroup
	backendID   uuid.UUID
	port        uint16
	index       int
	socket      *net.UDPConn
	socketID    uint64
	batch       *sockets.BatchConn
	responses   chan outboundResponse
	closed      chan struct{}
	cancel      context.CancelFunc
	done        sync.WaitGroup
	closeOnce   sync.Once
	health      proxy.Health
	queuedBytes atomic.Int64
	mu          sync.Mutex
	flows       map[string]*peerFlow
}

func (frontend *Frontend) startWorker(
	ctx context.Context,
	group *listenerGroup,
	route routes.UDP,
	socket *net.UDPConn,
	index int,
) (*socketWorker, error) {
	batch, err := sockets.NewBatchConn(socket)
	if err != nil {
		return nil, errors.Join(
			fmt.Errorf("initialize UDP batch I/O: %w", err),
			socket.Close(),
		)
	}
	workerContext, cancel := context.WithCancel(ctx)
	worker := &socketWorker{
		parent:    frontend,
		group:     group,
		backendID: route.BackendID,
		port:      route.PublicPort,
		index:     index,
		socket:    socket,
		socketID:  frontend.sockets.Register(socket),
		batch:     batch,
		responses: make(chan outboundResponse, responseQueueDepth),
		closed:    make(chan struct{}),
		cancel:    cancel,
		flows:     make(map[string]*peerFlow),
	}
	worker.done.Add(workerGoroutines)
	go worker.serve()
	go worker.writeResponses(workerContext)
	go worker.maintain(workerContext)
	worker.parent.logger.Info(
		"edge UDP route listening",
		"backend_id", route.BackendID,
		"port", route.PublicPort,
		"worker", index,
	)
	return worker, nil
}

func (worker *socketWorker) serve() {
	defer worker.done.Done()
	for {
		packets, err := worker.batch.ReadBatch()
		if err != nil {
			worker.recordReadFailure(err)
			return
		}
		now := time.Now()
		for index := range packets {
			packet := &packets[index]
			if len(packet.Payload) > protocol.MaxUDPApplicationPayloadBytes {
				continue
			}
			if err := worker.forward(&packet.Peer, packet.Payload, now); err != nil {
				worker.parent.logger.Warn(
					"edge UDP packet dropped",
					"backend_id", worker.backendID,
					"error", err,
				)
			}
		}
	}
}

func (worker *socketWorker) recordReadFailure(err error) {
	select {
	case <-worker.closed:
		return
	default:
	}
	worker.health.Fail(err.Error())
	worker.parent.logger.Debug(
		"edge UDP listener stopped",
		"backend_id", worker.backendID,
		"port", worker.port,
		"worker", worker.index,
		"error", err,
	)
}

func (worker *socketWorker) maintain(ctx context.Context) {
	defer worker.done.Done()
	ticker := time.NewTicker(flowMaintenanceInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			worker.pruneIdleFlows(now)
		}
	}
}

func (worker *socketWorker) close() {
	worker.closeOnce.Do(func() {
		close(worker.closed)
		worker.cancel()
		proxy.CloseAndLog(worker.parent.logger, "edge UDP listener", worker.socket)
		worker.parent.sockets.Unregister(worker.socketID)
		worker.done.Wait()
		worker.mu.Lock()
		flows := make([]*peerFlow, 0, len(worker.flows))
		for _, owned := range worker.flows {
			flows = append(flows, owned)
		}
		worker.flows = make(map[string]*peerFlow)
		worker.mu.Unlock()
		for _, owned := range flows {
			worker.parent.removeFlow(owned)
		}
	})
}
