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

package control

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mdlayher/vsock"
	guestconfig "github.com/snapflowio/microvm-go/guest/config"
)

const (
	controlReadHeaderTimeout = 10 * time.Second
	controlIdleTimeout       = 60 * time.Second
	controlShutdownTimeout   = 10 * time.Second
	controlMaximumHeaderSize = 64 * 1024
)

type ListenerFactory func() (net.Listener, error)

type Service struct {
	server   *http.Server
	listener net.Listener
	errors   chan error
	done     chan struct{}

	closeOnce sync.Once
	closeErr  error
	closing   atomic.Bool
}

func StartService(store *guestconfig.Store, listen ListenerFactory) (*Service, error) {
	if store == nil {
		return nil, fmt.Errorf("guest init configuration store is required")
	}
	if listen == nil {
		return nil, fmt.Errorf("guest init listener factory is required")
	}
	controlServer, err := NewServer(
		NopSessionResetter{},
		store,
		withFilesystemQuiescer(newRootFilesystemQuiescer()),
	)
	if err != nil {
		return nil, fmt.Errorf("create sandbox control server: %w", err)
	}
	listener, err := listen()
	if err != nil {
		return nil, fmt.Errorf("listen for sandbox control: %w", err)
	}
	service := &Service{
		server: &http.Server{
			Handler:           controlServer.Handler(),
			ReadHeaderTimeout: controlReadHeaderTimeout,
			IdleTimeout:       controlIdleTimeout,
			MaxHeaderBytes:    controlMaximumHeaderSize,
		},
		listener: listener,
		errors:   make(chan error, 1),
		done:     make(chan struct{}),
	}
	go service.serve()
	return service, nil
}

func ListenVSock() (net.Listener, error) {
	listener, err := vsock.Listen(uint32(Port), nil)
	if err != nil {
		return nil, fmt.Errorf("listen on vsock port %d: %w", Port, err)
	}
	return listener, nil
}

func (service *Service) Errors() <-chan error {
	return service.errors
}

func (service *Service) Close() error {
	service.closeOnce.Do(func() {
		service.closing.Store(true)
		ctx, cancel := context.WithTimeout(context.Background(), controlShutdownTimeout)
		defer cancel()
		shutdownErr := service.server.Shutdown(ctx)
		var forceCloseErr error
		if shutdownErr != nil {
			forceCloseErr = service.server.Close()
		}
		listenerErr := service.listener.Close()
		<-service.done
		if errors.Is(shutdownErr, http.ErrServerClosed) {
			shutdownErr = nil
		}
		if errors.Is(listenerErr, net.ErrClosed) {
			listenerErr = nil
		}
		if errors.Is(forceCloseErr, http.ErrServerClosed) {
			forceCloseErr = nil
		}
		service.closeErr = errors.Join(shutdownErr, forceCloseErr, listenerErr)
	})
	return service.closeErr
}

func (service *Service) serve() {
	defer close(service.done)
	err := service.server.Serve(service.listener)
	if err == nil || service.closing.Load() && (errors.Is(err, http.ErrServerClosed) || errors.Is(err, net.ErrClosed)) {
		return
	}
	service.errors <- fmt.Errorf("serve sandbox control API: %w", err)
}
