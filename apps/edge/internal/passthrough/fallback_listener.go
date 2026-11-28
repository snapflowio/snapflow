// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package passthrough

import (
	"net"
	"sync"
)

const fallbackQueueDepth = 1024

type fallbackListener struct {
	address     net.Addr
	connections chan net.Conn
	done        chan struct{}
	closeOnce   sync.Once
}

func newFallbackListener(address net.Addr) *fallbackListener {
	return &fallbackListener{
		address:     address,
		connections: make(chan net.Conn, fallbackQueueDepth),
		done:        make(chan struct{}),
	}
}

func (listener *fallbackListener) Accept() (net.Conn, error) {
	select {
	case connection := <-listener.connections:
		return connection, nil
	case <-listener.done:
		return nil, net.ErrClosed
	}
}

func (listener *fallbackListener) Close() error {
	listener.closeOnce.Do(func() { close(listener.done) })
	return nil
}

func (listener *fallbackListener) Addr() net.Addr {
	return listener.address
}

func (listener *fallbackListener) deliver(connection net.Conn) bool {
	select {
	case <-listener.done:
		return false
	default:
	}
	select {
	case listener.connections <- connection:
		return true
	default:
		return false
	}
}
