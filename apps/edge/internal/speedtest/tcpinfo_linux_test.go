// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package speedtest

import (
	"crypto/tls"
	"errors"
	"io"
	"net"
	"testing"
)

const (
	loopbackNetwork  = "tcp"
	loopbackAddress  = "127.0.0.1:0"
	loopbackPayload  = 1 << 20
	noRTTSampleValue = ^uint32(0)
)

type wrappingConnection struct {
	net.Conn
}

func (connection wrappingConnection) NetConn() net.Conn {
	return connection.Conn
}

func loopbackPair(t *testing.T) (server, client net.Conn) {
	t.Helper()
	var listenConfig net.ListenConfig
	listener, err := listenConfig.Listen(t.Context(), loopbackNetwork, loopbackAddress)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
			t.Error(err)
		}
	})
	var dialer net.Dialer
	client, err = dialer.DialContext(t.Context(), loopbackNetwork, listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	server, err = listener.Accept()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := errors.Join(client.Close(), server.Close()); err != nil {
			t.Error(err)
		}
	})
	return server, client
}

func TestConnectionStatsReadTheKernelTCPInfoThroughWrappers(t *testing.T) {
	server, client := loopbackPair(t)
	written := make(chan error, 1)
	go func() {
		_, err := server.Write(make([]byte, loopbackPayload))
		written <- err
	}()
	if _, err := io.ReadFull(client, make([]byte, loopbackPayload)); err != nil {
		t.Fatal(err)
	}
	if err := <-written; err != nil {
		t.Fatal(err)
	}
	wrapped := tls.Server(wrappingConnection{Conn: server}, &tls.Config{})
	stats, err := connectionStats(ConnContext(t.Context(), wrapped))
	if err != nil {
		t.Fatal(err)
	}
	if stats.sentSegments == 0 || stats.smoothedRTTMicros == 0 || stats.minRTTMicros == 0 || stats.minRTTMicros == noRTTSampleValue {
		t.Fatalf("stats = %+v", stats)
	}
}

func TestConnectionStatsNeedTheClientConnection(t *testing.T) {
	if _, err := connectionStats(t.Context()); !errors.Is(err, errNoConnection) {
		t.Fatalf("error = %v, want %v", err, errNoConnection)
	}
	local, remote := net.Pipe()
	t.Cleanup(func() {
		if err := errors.Join(local.Close(), remote.Close()); err != nil {
			t.Error(err)
		}
	})
	if _, err := connectionStats(ConnContext(t.Context(), local)); err == nil {
		t.Fatal("a socketless connection produced TCP stats")
	}
}
