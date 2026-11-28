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

//go:build linux

package guestinit

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"sync"
	"time"

	"github.com/mdlayher/vsock"
	"github.com/snapflowio/microvm-go/guest"
)

const relayDirections = 2

const serviceRelayDialTimeout = 5 * time.Second

type serviceRelayDialer func(context.Context) (net.Conn, error)

type platformServiceRelays struct {
	relays []*platformServiceRelay
	errors chan error
}

type platformServiceRelay struct {
	service       guest.Service
	listener      net.Listener
	dial          serviceRelayDialer
	errors        chan<- error
	closing       chan struct{}
	done          chan struct{}
	closeOnce     sync.Once
	connectionsMu sync.Mutex
	connections   map[net.Conn]struct{}
}

func startPlatformServiceRelays(cfg *Config) (*platformServiceRelays, error) {
	services := automaticPlatformServices(cfg)
	relays := &platformServiceRelays{
		relays: make([]*platformServiceRelay, 0, len(services)),
		errors: make(chan error, len(services)),
	}
	for _, service := range services {
		listener, err := vsock.Listen(service.Port, nil)
		if err != nil {
			return nil, errors.Join(
				fmt.Errorf("listen for platform service %q on vsock port %d: %w", service.Name, service.Port, err),
				relays.Close(),
			)
		}
		address := net.JoinHostPort(guest.ServiceLoopbackAddress, strconv.FormatUint(uint64(service.Port), 10))
		relay := newPlatformServiceRelay(service, listener, func(ctx context.Context) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "tcp", address)
		}, relays.errors)
		relays.relays = append(relays.relays, relay)
		go relay.serve()
	}
	return relays, nil
}

func automaticPlatformServices(cfg *Config) []guest.Service {
	seenPorts := make(map[uint32]struct{})
	var services []guest.Service
	for _, component := range platformComponents(cfg) {
		if !component.Activation.StartsAutomatically() {
			continue
		}
		for _, service := range component.Services {
			if _, exists := seenPorts[service.Port]; exists {
				continue
			}
			seenPorts[service.Port] = struct{}{}
			services = append(services, service)
		}
	}
	return services
}

func newPlatformServiceRelay(
	service guest.Service,
	listener net.Listener,
	dial serviceRelayDialer,
	errors chan<- error,
) *platformServiceRelay {
	return &platformServiceRelay{
		service:     service,
		listener:    listener,
		dial:        dial,
		errors:      errors,
		closing:     make(chan struct{}),
		done:        make(chan struct{}),
		connections: make(map[net.Conn]struct{}),
	}
}

func (relays *platformServiceRelays) Errors() <-chan error {
	return relays.errors
}

func (relays *platformServiceRelays) Close() error {
	var closeErr error
	for _, relay := range relays.relays {
		closeErr = errors.Join(closeErr, relay.Close())
	}
	return closeErr
}

func (relay *platformServiceRelay) serve() {
	defer close(relay.done)
	for {
		connection, err := relay.listener.Accept()
		if err != nil {
			select {
			case <-relay.closing:
				return
			default:
				relay.errors <- fmt.Errorf("accept platform service %q vsock connection: %w", relay.service.Name, err)
				return
			}
		}
		relay.track(connection)
		go relay.forward(connection)
	}
}

func (relay *platformServiceRelay) forward(source net.Conn) {
	defer relay.untrack(source)
	defer closeConnection(source, relay.service.Name, "vsock")

	ctx, cancel := context.WithTimeout(context.Background(), serviceRelayDialTimeout)
	target, err := relay.dial(ctx)
	cancel()
	if err != nil {
		Log("platform service %q relay could not connect to loopback service: %v", relay.service.Name, err)
		return
	}
	defer closeConnection(target, relay.service.Name, "loopback")
	relay.track(target)
	defer relay.untrack(target)

	copyDone := make(chan error, relayDirections)
	go copyRelayStream(copyDone, target, source)
	go copyRelayStream(copyDone, source, target)
	firstErr := <-copyDone
	closeConnection(source, relay.service.Name, "vsock")
	closeConnection(target, relay.service.Name, "loopback")
	secondErr := <-copyDone
	if err := errors.Join(normalizeRelayError(firstErr), normalizeRelayError(secondErr)); err != nil {
		Log("platform service %q relay stopped with an I/O error: %v", relay.service.Name, err)
	}
}

func copyRelayStream(done chan<- error, destination io.Writer, source io.Reader) {
	_, err := io.Copy(destination, source)
	done <- err
}

func normalizeRelayError(err error) error {
	if err == nil || errors.Is(err, net.ErrClosed) {
		return nil
	}
	return err
}

func closeConnection(connection net.Conn, serviceName, endpoint string) {
	if err := connection.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		Log("platform service %q relay failed to close %s connection: %v", serviceName, endpoint, err)
	}
}

func (relay *platformServiceRelay) Close() error {
	var closeErr error
	relay.closeOnce.Do(func() {
		close(relay.closing)
		if err := relay.listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
			closeErr = fmt.Errorf("close platform service %q vsock listener: %w", relay.service.Name, err)
		}
		relay.closeTracked()
		<-relay.done
	})
	return closeErr
}

func (relay *platformServiceRelay) track(connection net.Conn) {
	relay.connectionsMu.Lock()
	defer relay.connectionsMu.Unlock()
	relay.connections[connection] = struct{}{}
}

func (relay *platformServiceRelay) untrack(connection net.Conn) {
	relay.connectionsMu.Lock()
	defer relay.connectionsMu.Unlock()
	delete(relay.connections, connection)
}

func (relay *platformServiceRelay) closeTracked() {
	relay.connectionsMu.Lock()
	defer relay.connectionsMu.Unlock()
	for connection := range relay.connections {
		closeConnection(connection, relay.service.Name, "active")
	}
}
