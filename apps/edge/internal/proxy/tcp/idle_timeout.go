// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tcp

import (
	"io"
	"time"

	"github.com/snapflowio/edge/internal/proxy"
)

type deadlineReadWriteCloser interface {
	io.ReadWriteCloser
	SetDeadline(time.Time) error
}

type idleTimeoutConnection struct {
	connection deadlineReadWriteCloser
	timeout    time.Duration
}

func (connection *idleTimeoutConnection) Read(destination []byte) (int, error) {
	if err := connection.connection.SetDeadline(time.Now().Add(connection.timeout)); err != nil {
		return 0, err
	}
	return connection.connection.Read(destination)
}

func (connection *idleTimeoutConnection) Write(payload []byte) (int, error) {
	if err := connection.connection.SetDeadline(time.Now().Add(connection.timeout)); err != nil {
		return 0, err
	}
	return connection.connection.Write(payload)
}

func (connection *idleTimeoutConnection) Close() error {
	return connection.connection.Close()
}

func (connection *idleTimeoutConnection) CloseWrite() error {
	return proxy.CloseWrite(connection.connection)
}
