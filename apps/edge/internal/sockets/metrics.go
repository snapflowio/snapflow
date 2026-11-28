// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sockets

import (
	"context"
	"log/slog"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

const refreshInterval = 5 * time.Second

type registration struct {
	inode              uint64
	receiveBufferBytes int
	sendBufferBytes    int
	lastKernelDrops    uint64
}

type Metrics struct {
	logger            *slog.Logger
	mu                sync.Mutex
	nextID            uint64
	sockets           map[uint64]registration
	receiveQueueBytes atomic.Uint64
	maxReceiveQueue   atomic.Uint64
	kernelDrops       atomic.Uint64
}

type MetricsSnapshot struct {
	Sockets                   int
	MinimumReceiveBufferBytes int
	MinimumSendBufferBytes    int
	ReceiveQueueBytes         uint64
	MaximumReceiveQueueBytes  uint64
	KernelDrops               uint64
}

func (metrics *Metrics) Register(socket *net.UDPConn) uint64 {
	sizes, err := readBufferSizes(socket)
	if err != nil {
		metrics.logger.Warn("could not inspect configured UDP socket buffers", "error", err)
	}
	inode, err := socketInode(socket)
	if err != nil {
		metrics.logger.Warn("could not register UDP socket for kernel metrics", "error", err)
	}
	metrics.mu.Lock()
	defer metrics.mu.Unlock()
	metrics.nextID++
	metrics.sockets[metrics.nextID] = registration{
		inode:              inode,
		receiveBufferBytes: sizes.Read,
		sendBufferBytes:    sizes.Write,
	}
	return metrics.nextID
}

func (metrics *Metrics) Unregister(id uint64) {
	if id == 0 {
		return
	}
	metrics.mu.Lock()
	delete(metrics.sockets, id)
	metrics.mu.Unlock()
}

func (metrics *Metrics) Refresh() error {
	metrics.mu.Lock()
	inodes := make(map[uint64]struct{}, len(metrics.sockets))
	for _, socket := range metrics.sockets {
		if socket.inode != 0 {
			inodes[socket.inode] = struct{}{}
		}
	}
	metrics.mu.Unlock()
	if len(inodes) == 0 {
		metrics.receiveQueueBytes.Store(0)
		metrics.maxReceiveQueue.Store(0)
		return nil
	}
	observed, err := readKernelStats(inodes)
	if err != nil {
		return err
	}
	var receiveQueueBytes uint64
	var maximumReceiveQueue uint64
	metrics.mu.Lock()
	for id, socket := range metrics.sockets {
		stats, exists := observed[socket.inode]
		if !exists {
			continue
		}
		receiveQueueBytes += stats.receiveQueueBytes
		maximumReceiveQueue = max(maximumReceiveQueue, stats.receiveQueueBytes)
		if stats.drops >= socket.lastKernelDrops {
			metrics.kernelDrops.Add(stats.drops - socket.lastKernelDrops)
		} else {
			metrics.kernelDrops.Add(stats.drops)
		}
		socket.lastKernelDrops = stats.drops
		metrics.sockets[id] = socket
	}
	metrics.mu.Unlock()
	metrics.receiveQueueBytes.Store(receiveQueueBytes)
	metrics.maxReceiveQueue.Store(maximumReceiveQueue)
	return nil
}

func (metrics *Metrics) Snapshot() MetricsSnapshot {
	result := MetricsSnapshot{
		ReceiveQueueBytes:        metrics.receiveQueueBytes.Load(),
		MaximumReceiveQueueBytes: metrics.maxReceiveQueue.Load(),
		KernelDrops:              metrics.kernelDrops.Load(),
	}
	metrics.mu.Lock()
	result.Sockets = len(metrics.sockets)
	for _, socket := range metrics.sockets {
		if result.MinimumReceiveBufferBytes == 0 ||
			socket.receiveBufferBytes < result.MinimumReceiveBufferBytes {
			result.MinimumReceiveBufferBytes = socket.receiveBufferBytes
		}
		if result.MinimumSendBufferBytes == 0 ||
			socket.sendBufferBytes < result.MinimumSendBufferBytes {
			result.MinimumSendBufferBytes = socket.sendBufferBytes
		}
	}
	metrics.mu.Unlock()
	return result
}

func NewMetrics(logger *slog.Logger) *Metrics {
	return &Metrics{logger: logger, sockets: make(map[uint64]registration)}
}

func (metrics *Metrics) Run(ctx context.Context) error {
	ticker := time.NewTicker(refreshInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := metrics.Refresh(); err != nil {
				metrics.logger.Debug("could not refresh UDP kernel socket metrics", "error", err)
			}
		}
	}
}
