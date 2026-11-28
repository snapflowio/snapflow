// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package sockets

import (
	"context"
	"errors"
	"fmt"
	"net"
	"runtime"
	"syscall"

	"golang.org/x/sys/unix"
)

const (
	minimumWorkerSockets = 1
	maximumWorkerSockets = 4
)

func WorkerCount() int {
	return min(max(runtime.GOMAXPROCS(0), minimumWorkerSockets), maximumWorkerSockets)
}

func Listen(
	ctx context.Context,
	address string,
	reusePort bool,
) (*net.UDPConn, error) {
	config := net.ListenConfig{}
	if reusePort {
		config.Control = func(
			network string,
			listenAddress string,
			raw syscall.RawConn,
		) error {
			var socketErr error
			controlErr := raw.Control(func(descriptor uintptr) {
				socketErr = unix.SetsockoptInt(
					int(descriptor),
					unix.SOL_SOCKET,
					unix.SO_REUSEPORT,
					1,
				)
			})
			if controlErr != nil {
				return fmt.Errorf("access UDP socket for SO_REUSEPORT: %w", controlErr)
			}
			if socketErr != nil {
				return fmt.Errorf("set SO_REUSEPORT: %w", socketErr)
			}
			return nil
		}
	}
	packetConnection, err := config.ListenPacket(ctx, "udp", address)
	if err != nil {
		return nil, err
	}
	socket, valid := packetConnection.(*net.UDPConn)
	if !valid {
		closeErr := packetConnection.Close()
		return nil, errors.Join(
			errors.New("machine UDP listener did not return a UDP socket"),
			closeErr,
		)
	}
	return socket, nil
}
