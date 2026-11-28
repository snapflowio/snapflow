// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package proxy

import (
	"errors"
	"net"

	"github.com/snapflowio/edge/internal/traffic"
)

type MeteredConn struct {
	net.Conn
	counter *traffic.Counter
}

func NewMeteredConn(conn net.Conn, counter *traffic.Counter) (*MeteredConn, error) {
	if conn == nil || counter == nil {
		return nil, errors.New("metered connection requires a connection and a counter")
	}
	return &MeteredConn{Conn: conn, counter: counter}, nil
}

func (conn *MeteredConn) Read(destination []byte) (int, error) {
	read, err := conn.Conn.Read(destination)
	if read > 0 {
		conn.counter.AddIngress(uint64(read), 0)
	}
	return read, err
}

func (conn *MeteredConn) Write(payload []byte) (int, error) {
	written, err := conn.Conn.Write(payload)
	if written > 0 {
		conn.counter.AddEgress(uint64(written), 0)
	}
	return written, err
}

func (conn *MeteredConn) CloseWrite() error {
	return CloseWrite(conn.Conn)
}
