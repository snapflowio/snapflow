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
	"sync"
	"testing"

	"github.com/google/uuid"
)

func TestDatagramDispatcherPreservesPerFlowOrder(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var mu sync.Mutex
	received := make([]byte, 0, 32)
	completed := make(chan struct{})
	dispatcher, err := NewDatagramDispatcher(
		ctx,
		DatagramDispatcherConfig{
			Stripes:        4,
			QueueDepth:     32,
			MaxQueuedBytes: 1 << 20,
		},
		func(handlerContext context.Context, datagram Datagram) error {
			mu.Lock()
			received = append(received, datagram.Payload[0])
			if len(received) == 32 {
				close(completed)
			}
			mu.Unlock()
			return nil
		},
		nil,
	)
	if err != nil {
		t.Fatalf("NewDatagramDispatcher: %v", err)
	}
	defer dispatcher.Close()
	backendID := uuid.New()
	for sequence := 0; sequence < 32; sequence++ {
		if !dispatcher.Dispatch(Datagram{
			BackendID: backendID,
			FlowID:    7,
			Payload:   []byte{byte(sequence)},
		}) {
			t.Fatalf("dispatch %d rejected", sequence)
		}
	}
	<-completed
	mu.Lock()
	defer mu.Unlock()
	for sequence, value := range received {
		if value != byte(sequence) {
			t.Fatalf("received[%d] = %d", sequence, value)
		}
	}
}

func TestDatagramDispatcherRejectsWhenQueueIsFull(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	started := make(chan struct{})
	release := make(chan struct{})
	dispatcher, err := NewDatagramDispatcher(
		ctx,
		DatagramDispatcherConfig{
			Stripes:        1,
			QueueDepth:     1,
			MaxQueuedBytes: 1 << 20,
		},
		func(handlerContext context.Context, datagram Datagram) error {
			select {
			case <-started:
			default:
				close(started)
			}
			<-release
			return nil
		},
		nil,
	)
	if err != nil {
		t.Fatalf("NewDatagramDispatcher: %v", err)
	}
	backendID := uuid.New()
	if !dispatcher.Dispatch(Datagram{
		BackendID: backendID, FlowID: 1, Payload: []byte{1},
	}) {
		t.Fatal("first datagram rejected")
	}
	<-started
	if !dispatcher.Dispatch(Datagram{
		BackendID: backendID, FlowID: 1, Payload: []byte{2},
	}) {
		t.Fatal("queued datagram rejected")
	}
	if dispatcher.Dispatch(Datagram{
		BackendID: backendID, FlowID: 1, Payload: []byte{3},
	}) {
		t.Fatal("dispatcher accepted beyond its queue bound")
	}
	close(release)
	dispatcher.Close()
}

func TestDatagramDispatcherRejectsWhenByteBudgetIsFull(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	started := make(chan struct{})
	release := make(chan struct{})
	dispatcher, err := NewDatagramDispatcher(
		ctx,
		DatagramDispatcherConfig{
			Stripes:        1,
			QueueDepth:     4,
			MaxQueuedBytes: 2,
		},
		func(handlerContext context.Context, datagram Datagram) error {
			select {
			case <-started:
			default:
				close(started)
			}
			<-release
			return nil
		},
		nil,
	)
	if err != nil {
		t.Fatalf("NewDatagramDispatcher: %v", err)
	}
	backendID := uuid.New()
	if !dispatcher.Dispatch(Datagram{
		BackendID: backendID, FlowID: 1, Payload: []byte{1},
	}) {
		t.Fatal("first datagram rejected")
	}
	<-started
	if !dispatcher.Dispatch(Datagram{
		BackendID: backendID, FlowID: 2, Payload: []byte{2, 3},
	}) {
		t.Fatal("datagram within byte budget was rejected")
	}
	if dispatcher.Dispatch(Datagram{
		BackendID: backendID, FlowID: 3, Payload: []byte{4},
	}) {
		t.Fatal("dispatcher exceeded its byte budget")
	}
	close(release)
	dispatcher.Close()
}
