// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build !linux

package sockets

import (
	"context"
	"errors"
	"net"
)

func WorkerCount() int {
	return 1
}

func Listen(
	ctx context.Context,
	address string,
	reusePort bool,
) (*net.UDPConn, error) {
	if reusePort {
		return nil, errors.New("socket option SO_REUSEPORT is unavailable on this platform")
	}
	packetConnection, err := (&net.ListenConfig{}).ListenPacket(
		ctx,
		"udp",
		address,
	)
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
