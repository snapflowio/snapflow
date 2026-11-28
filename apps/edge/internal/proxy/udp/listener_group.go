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
	"log/slog"
	"net"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/sockets"
)

const packetRateWindow = time.Second

type listenerGroup struct {
	backendID   uuid.UUID
	machineID   uuid.UUID
	flowLimit   int
	packetLimit int
	workers     []*socketWorker
	flowCount   atomic.Int32
	queuedBytes atomic.Int64
	rateMu      sync.Mutex
	rateWindow  time.Time
	ratePackets int
}

func (frontend *Frontend) openListenerGroup(
	ctx context.Context,
	route routes.UDP,
) (*listenerGroup, error) {
	group := &listenerGroup{
		backendID:   route.BackendID,
		machineID:   route.MachineID,
		flowLimit:   route.Policy.FlowLimit,
		packetLimit: route.Policy.PacketsPerSecond,
	}
	bound, err := bindWorkerSockets(ctx, frontend.logger, route.PublicPort)
	if err != nil {
		return nil, err
	}
	group.workers = make([]*socketWorker, 0, len(bound))
	for index, socket := range bound {
		worker, err := frontend.startWorker(ctx, group, route, socket, index)
		if err != nil {
			group.Close()
			return nil, errors.Join(err, closeSockets(bound[index+1:]))
		}
		group.workers = append(group.workers, worker)
	}
	return group, nil
}

func bindWorkerSockets(ctx context.Context, logger *slog.Logger, port uint16) ([]*net.UDPConn, error) {
	address := net.JoinHostPort("", strconv.Itoa(int(port)))
	workerCount := sockets.WorkerCount()
	bound := make([]*net.UDPConn, 0, workerCount)
	for index := range workerCount {
		socket, err := sockets.Listen(ctx, address, workerCount > 1)
		if err != nil {
			return nil, errors.Join(
				fmt.Errorf("listen on edge UDP port %d worker %d: %w", port, index, err),
				closeSockets(bound),
			)
		}
		sizes, err := sockets.ConfigureBuffers(socket)
		if err != nil {
			return nil, errors.Join(
				fmt.Errorf("configure edge UDP port %d worker %d: %w", port, index, err),
				socket.Close(),
				closeSockets(bound),
			)
		}
		sockets.LogBufferSizes(logger, port, index, sizes)
		bound = append(bound, socket)
	}
	return bound, nil
}

func closeSockets(bound []*net.UDPConn) error {
	var result error
	for _, socket := range bound {
		result = errors.Join(result, socket.Close())
	}
	return result
}

func (group *listenerGroup) Matches(route routes.UDP) bool {
	_, failed := group.Failure()
	return !failed &&
		group.backendID == route.BackendID &&
		group.machineID == route.MachineID &&
		group.flowLimit == route.Policy.FlowLimit &&
		group.packetLimit == route.Policy.PacketsPerSecond
}

func (group *listenerGroup) Failure() (string, bool) {
	for _, worker := range group.workers {
		if reason, failed := worker.health.Failure(); failed {
			return fmt.Sprintf("UDP worker %d stopped: %s", worker.index, reason), true
		}
	}
	return "", false
}

func (group *listenerGroup) Close() {
	for _, worker := range group.workers {
		worker.close()
	}
}

func (group *listenerGroup) allowPacket(now time.Time) bool {
	group.rateMu.Lock()
	defer group.rateMu.Unlock()
	if group.rateWindow.IsZero() || now.Sub(group.rateWindow) >= packetRateWindow {
		group.rateWindow = now
		group.ratePackets = 0
	}
	if group.ratePackets >= group.packetLimit {
		return false
	}
	group.ratePackets++
	return true
}

func (group *listenerGroup) reserveFlow() bool {
	for {
		current := group.flowCount.Load()
		if int(current) >= group.flowLimit {
			return false
		}
		if group.flowCount.CompareAndSwap(current, current+1) {
			return true
		}
	}
}

func (group *listenerGroup) releaseFlow() {
	group.flowCount.Add(-1)
}
