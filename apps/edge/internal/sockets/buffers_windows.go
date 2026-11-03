// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build windows

package sockets

import (
	"fmt"
	"net"

	"golang.org/x/sys/windows"
)

func readBufferSizes(socket *net.UDPConn) (BufferSizes, error) {
	rawConnection, err := socket.SyscallConn()
	if err != nil {
		return BufferSizes{}, fmt.Errorf("access UDP socket: %w", err)
	}
	var sizes BufferSizes
	var socketErr error
	if err := rawConnection.Control(func(descriptor uintptr) {
		sizes.Read, socketErr = windows.GetsockoptInt(
			windows.Handle(descriptor),
			windows.SOL_SOCKET,
			windows.SO_RCVBUF,
		)
		if socketErr != nil {
			return
		}
		sizes.Write, socketErr = windows.GetsockoptInt(
			windows.Handle(descriptor),
			windows.SOL_SOCKET,
			windows.SO_SNDBUF,
		)
	}); err != nil {
		return BufferSizes{}, fmt.Errorf("inspect UDP socket buffers: %w", err)
	}
	if socketErr != nil {
		return BufferSizes{}, fmt.Errorf(
			"inspect UDP socket buffers: %w",
			socketErr,
		)
	}
	return sizes, nil
}
