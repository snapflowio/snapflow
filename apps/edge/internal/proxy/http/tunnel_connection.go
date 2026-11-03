// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"errors"
	"net"
	"time"

	"github.com/snapflowio/tunnel-go/transport"
)

const (
	unknownNetwork       = "unknown"
	edgeEndpointLabel    = "edge"
	machineEndpointLabel = "machine"
)

type stringAddress string

func (address stringAddress) Network() string {
	return unknownNetwork
}

func (address stringAddress) String() string {
	return string(address)
}

type tunnelStreamConnection struct {
	transport.Stream
}

func (connection *tunnelStreamConnection) LocalAddr() net.Addr {
	return stringAddress(edgeEndpointLabel)
}

func (connection *tunnelStreamConnection) RemoteAddr() net.Addr {
	return stringAddress(machineEndpointLabel)
}

type writeTimeoutConnection struct {
	net.Conn
	timeout time.Duration
}

func (connection *writeTimeoutConnection) Write(payload []byte) (int, error) {
	if err := connection.SetWriteDeadline(time.Now().Add(connection.timeout)); err != nil {
		return 0, err
	}
	written, writeErr := connection.Conn.Write(payload)
	clearErr := connection.SetWriteDeadline(time.Time{})
	return written, errors.Join(writeErr, clearErr)
}
