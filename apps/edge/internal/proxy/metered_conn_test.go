// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package proxy

import (
	"io"
	"net"
	"testing"

	"github.com/snapflowio/edge/internal/traffic"
)

const (
	clientMessage  = "client sent this"
	backendMessage = "backend answered with this"
)

func TestNewConnectionRequiresAConnectionAndACounter(t *testing.T) {
	t.Parallel()
	client, server := net.Pipe()
	defer client.Close()
	defer server.Close()
	if connection, err := NewMeteredConn(server, nil); err == nil || connection != nil {
		t.Fatal("a metered connection without a counter was created")
	}
	if connection, err := NewMeteredConn(nil, new(traffic.Counter)); err == nil || connection != nil {
		t.Fatal("a metered connection without a connection was created")
	}
}

func TestConnectionMetersBothDirectionsAsBytesCross(t *testing.T) {
	t.Parallel()
	client, server := net.Pipe()
	defer client.Close()
	counter := new(traffic.Counter)
	metered, err := NewMeteredConn(server, counter)
	if err != nil {
		t.Fatalf("create metered connection: %v", err)
	}
	defer metered.Close()
	sent := make(chan error, 1)
	go func() {
		_, writeErr := io.WriteString(client, clientMessage)
		sent <- writeErr
	}()
	received := make([]byte, len(clientMessage))
	if _, err := io.ReadFull(metered, received); err != nil {
		t.Fatalf("read client bytes: %v", err)
	}
	if err := <-sent; err != nil {
		t.Fatalf("write client bytes: %v", err)
	}
	if totals := counter.Harvest(); totals.BytesIn != uint64(len(clientMessage)) || totals.BytesOut != 0 {
		t.Fatalf("totals after the client wrote = %+v, want only its bytes as ingress", totals)
	}
	answered := make(chan error, 1)
	go func() {
		_, readErr := io.ReadFull(client, make([]byte, len(backendMessage)))
		answered <- readErr
	}()
	if _, err := io.WriteString(metered, backendMessage); err != nil {
		t.Fatalf("write backend bytes: %v", err)
	}
	if err := <-answered; err != nil {
		t.Fatalf("read backend bytes: %v", err)
	}
	if totals := counter.Harvest(); totals.BytesOut != uint64(len(backendMessage)) || totals.BytesIn != 0 {
		t.Fatalf("totals after the backend answered = %+v, want only its bytes as egress", totals)
	}
}

func TestConnectionCloseWriteClosesWithoutHalfCloseSupport(t *testing.T) {
	t.Parallel()
	client, server := net.Pipe()
	defer client.Close()
	metered, err := NewMeteredConn(server, new(traffic.Counter))
	if err != nil {
		t.Fatalf("create metered connection: %v", err)
	}
	if err := metered.CloseWrite(); err != nil {
		t.Fatalf("close write: %v", err)
	}
	if _, err := client.Read(make([]byte, 1)); err == nil {
		t.Fatal("the peer did not see end-of-stream after CloseWrite")
	}
}
