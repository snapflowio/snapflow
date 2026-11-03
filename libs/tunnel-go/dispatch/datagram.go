// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package dispatch

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"

	"github.com/google/uuid"
)

type Datagram struct {
	BackendID            uuid.UUID
	AssignmentGeneration uint32
	FlowID               uint64
	Payload              []byte
}

type Handler func(context.Context, Datagram) error

type ErrorHandler func(Datagram, error)

type DatagramDispatcherConfig struct {
	Stripes        int
	QueueDepth     int
	MaxQueuedBytes int64
}

type DatagramDispatcher struct {
	stopped        <-chan struct{}
	cancel         context.CancelFunc
	handler        Handler
	onError        ErrorHandler
	queues         []chan Datagram
	queuedBytes    atomic.Int64
	maxQueuedBytes int64
	done           sync.WaitGroup
	once           sync.Once
}

func NewDatagramDispatcher(
	parent context.Context,
	config DatagramDispatcherConfig,
	handler Handler,
	onError ErrorHandler,
) (*DatagramDispatcher, error) {
	if parent == nil || config.Stripes < 1 || config.QueueDepth < 1 ||
		config.MaxQueuedBytes < 1 || handler == nil {
		return nil, errors.New(
			"datagram dispatcher requires a context, positive bounds, and a handler",
		)
	}
	ctx, cancel := context.WithCancel(parent)
	dispatcher := &DatagramDispatcher{
		stopped:        ctx.Done(),
		cancel:         cancel,
		handler:        handler,
		onError:        onError,
		queues:         make([]chan Datagram, config.Stripes),
		maxQueuedBytes: config.MaxQueuedBytes,
	}
	for index := range dispatcher.queues {
		queue := make(chan Datagram, config.QueueDepth)
		dispatcher.queues[index] = queue
		dispatcher.done.Add(1)
		go dispatcher.run(ctx, queue)
	}
	return dispatcher, nil
}

func (dispatcher *DatagramDispatcher) Dispatch(datagram Datagram) bool {
	if datagram.BackendID == uuid.Nil || datagram.FlowID == 0 ||
		len(datagram.Payload) == 0 ||
		!dispatcher.reserveBytes(len(datagram.Payload)) {
		return false
	}
	copied := Datagram{
		BackendID:            datagram.BackendID,
		AssignmentGeneration: datagram.AssignmentGeneration,
		FlowID:               datagram.FlowID,
		Payload:              append([]byte(nil), datagram.Payload...),
	}
	queue := dispatcher.queues[datagramStripe(
		datagram.BackendID,
		datagram.FlowID,
		len(dispatcher.queues),
	)]
	select {
	case <-dispatcher.stopped:
		dispatcher.releaseBytes(len(copied.Payload))
		return false
	case queue <- copied:
		return true
	default:
		dispatcher.releaseBytes(len(copied.Payload))
		return false
	}
}

func (dispatcher *DatagramDispatcher) Close() {
	dispatcher.once.Do(func() {
		dispatcher.cancel()
		dispatcher.done.Wait()
	})
}

func (dispatcher *DatagramDispatcher) run(ctx context.Context, queue <-chan Datagram) {
	defer dispatcher.done.Done()
	for {
		select {
		case <-ctx.Done():
			return
		case datagram := <-queue:
			dispatcher.releaseBytes(len(datagram.Payload))
			if err := dispatcher.handler(ctx, datagram); err != nil &&
				dispatcher.onError != nil {
				dispatcher.onError(datagram, err)
			}
		}
	}
}

func (dispatcher *DatagramDispatcher) reserveBytes(size int) bool {
	if size < 1 || int64(size) > dispatcher.maxQueuedBytes {
		return false
	}
	for {
		current := dispatcher.queuedBytes.Load()
		sizeBytes := int64(size)
		if current > dispatcher.maxQueuedBytes-sizeBytes {
			return false
		}
		if dispatcher.queuedBytes.CompareAndSwap(current, current+sizeBytes) {
			return true
		}
	}
}

func (dispatcher *DatagramDispatcher) releaseBytes(size int) {
	dispatcher.queuedBytes.Add(-int64(size))
}

func datagramStripe(backendID uuid.UUID, flowID uint64, stripes int) int {
	const (
		offset64 = 14_695_981_039_346_656_037
		prime64  = 1_099_511_628_211
	)
	hash := uint64(offset64)
	for _, value := range backendID {
		hash ^= uint64(value)
		hash *= prime64
	}
	for shift := 0; shift < 64; shift += 8 {
		hash ^= uint64(byte(flowID >> shift))
		hash *= prime64
	}
	return int(hash % uint64(stripes))
}
