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
	"net"
	"sync/atomic"

	"github.com/snapflowio/edge/internal/sockets"
)

const (
	responseQueueDepth           = 1_024
	workerResponseQueueByteLimit = 4 << 20
	routeResponseQueueByteLimit  = 16 << 20
	globalResponseQueueByteLimit = 256 << 20
)

func (worker *socketWorker) enqueueResponse(
	ctx context.Context,
	payload []byte,
	peer net.UDPAddr,
) error {
	if !worker.reserveQueuedBytes(len(payload)) {
		worker.parent.responseQueueRejections.Add(1)
		return errors.New("machine UDP response queue byte limit reached")
	}
	result := make(chan error, 1)
	response := outboundResponse{packet: sockets.Packet{Payload: payload, Peer: peer}, result: result}
	select {
	case <-ctx.Done():
		worker.releaseQueuedBytes(len(payload))
		return ctx.Err()
	case <-worker.closed:
		worker.releaseQueuedBytes(len(payload))
		return net.ErrClosed
	case worker.responses <- response:
	default:
		worker.releaseQueuedBytes(len(payload))
		worker.parent.responseQueueRejections.Add(1)
		return errors.New("machine UDP response queue is saturated")
	}

	return <-result
}

type outboundResponse struct {
	packet sockets.Packet
	result chan error
}

func (worker *socketWorker) writeResponses(ctx context.Context) {
	defer worker.done.Done()
	defer worker.failQueuedResponses()
	batch := make([]outboundResponse, 0, sockets.BatchSize)
	packets := make([]sockets.Packet, 0, sockets.BatchSize)
	for {
		select {
		case <-ctx.Done():
			return
		case first := <-worker.responses:
			batch = worker.collectResponses(append(batch[:0], first))
		}
		packets = packets[:0]
		for index := range batch {
			packets = append(packets, batch[index].packet)
		}
		written, err := worker.batch.WriteBatch(packets)
		if err == nil && written != len(batch) {
			err = errors.New("machine UDP batch write was incomplete")
		}
		for index := range batch {
			responseErr := err
			if index < written {
				responseErr = nil
			}
			worker.releaseQueuedBytes(len(batch[index].packet.Payload))
			batch[index].result <- responseErr
		}
	}
}

func (worker *socketWorker) collectResponses(batch []outboundResponse) []outboundResponse {
	for len(batch) < cap(batch) {
		select {
		case response := <-worker.responses:
			batch = append(batch, response)
		default:
			return batch
		}
	}
	return batch
}

func (worker *socketWorker) reserveQueuedBytes(size int) bool {
	if size < 0 || size > workerResponseQueueByteLimit ||
		!reserveByteCapacity(
			&worker.parent.queuedResponseBytes,
			globalResponseQueueByteLimit,
			size,
		) {
		return false
	}
	if !reserveByteCapacity(
		&worker.group.queuedBytes,
		routeResponseQueueByteLimit,
		size,
	) {
		releaseByteCapacity(&worker.parent.queuedResponseBytes, size)
		return false
	}
	if reserveByteCapacity(
		&worker.queuedBytes,
		workerResponseQueueByteLimit,
		size,
	) {
		return true
	}
	releaseByteCapacity(&worker.group.queuedBytes, size)
	releaseByteCapacity(&worker.parent.queuedResponseBytes, size)
	return false
}

func (worker *socketWorker) releaseQueuedBytes(size int) {
	releaseByteCapacity(&worker.queuedBytes, size)
	releaseByteCapacity(&worker.group.queuedBytes, size)
	releaseByteCapacity(&worker.parent.queuedResponseBytes, size)
}

func (worker *socketWorker) failQueuedResponses() {
	for {
		select {
		case response := <-worker.responses:
			worker.releaseQueuedBytes(len(response.packet.Payload))
			response.result <- net.ErrClosed
		default:
			return
		}
	}
}

func reserveByteCapacity(counter *atomic.Int64, limit, size int) bool {
	for {
		current := counter.Load()
		if current > int64(limit-size) {
			return false
		}
		if counter.CompareAndSwap(current, current+int64(size)) {
			return true
		}
	}
}

func releaseByteCapacity(counter *atomic.Int64, size int) {
	counter.Add(-int64(size))
}
