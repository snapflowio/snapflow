// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sockets

import (
	"fmt"
	"log/slog"
	"net"
)

const requestedSocketBufferBytes = 7_340_032

type BufferSizes struct {
	Read  int
	Write int
}

func ConfigureBuffers(socket *net.UDPConn) (BufferSizes, error) {
	if err := socket.SetReadBuffer(requestedSocketBufferBytes); err != nil {
		return BufferSizes{}, fmt.Errorf(
			"set receive buffer to %d bytes: %w",
			requestedSocketBufferBytes,
			err,
		)
	}
	if err := socket.SetWriteBuffer(requestedSocketBufferBytes); err != nil {
		return BufferSizes{}, fmt.Errorf(
			"set send buffer to %d bytes: %w",
			requestedSocketBufferBytes,
			err,
		)
	}
	return readBufferSizes(socket)
}

func LogBufferSizes(logger *slog.Logger, port uint16, worker int, sizes BufferSizes) {
	attributes := []any{
		"port", port,
		"worker", worker,
		"requested_bytes", requestedSocketBufferBytes,
		"read_bytes", sizes.Read,
		"write_bytes", sizes.Write,
	}
	if sizes.Read < requestedSocketBufferBytes ||
		sizes.Write < requestedSocketBufferBytes {
		logger.Warn(
			"UDP socket buffers are below the requested size; raise host socket buffer limits",
			attributes...,
		)
		return
	}
	logger.Info("UDP socket buffers configured", attributes...)
}
