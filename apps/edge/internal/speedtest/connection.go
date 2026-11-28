// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package speedtest

import (
	"context"
	"errors"
	"fmt"
	"net"
	"syscall"
)

var errNoConnection = errors.New("the speedtest request carries no client connection")

type connectionKey struct{}

type tcpStats struct {
	minRTTMicros          uint32
	smoothedRTTMicros     uint32
	rttVarianceMicros     uint32
	retransmittedSegments uint64
	sentSegments          uint64
}

type wrappedConnection interface {
	NetConn() net.Conn
}

func ConnContext(ctx context.Context, connection net.Conn) context.Context {
	return context.WithValue(ctx, connectionKey{}, connection)
}

func connectionStats(ctx context.Context) (tcpStats, error) {
	connection, found := ctx.Value(connectionKey{}).(net.Conn)
	if !found {
		return tcpStats{}, errNoConnection
	}
	for {
		switch typed := connection.(type) {
		case syscall.Conn:
			return readTCPStats(typed)
		case wrappedConnection:
			connection = typed.NetConn()
		default:
			return tcpStats{}, fmt.Errorf("the speedtest connection %T exposes no socket", connection)
		}
	}
}
