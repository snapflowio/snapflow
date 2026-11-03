// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package vsock

import (
	"bufio"
	"context"
	"errors"
	"io"
	"net"
	"path/filepath"
	"testing"
	"time"
)

func TestDialContextAcceptsAllocatedHostPort(t *testing.T) {
	listener, err := new(net.ListenConfig).Listen(t.Context(), "unix", filepath.Join(t.TempDir(), "vsock.sock"))
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	serverErr := make(chan error, 1)
	go func() {
		connection, acceptErr := listener.Accept()
		if acceptErr != nil {
			serverErr <- acceptErr
			return
		}
		defer connection.Close()
		request, readErr := bufio.NewReader(connection).ReadString('\n')
		if readErr != nil {
			serverErr <- readErr
			return
		}
		if request != "CONNECT 8082\n" {
			serverErr <- &unexpectedHandshake{value: request}
			return
		}
		_, writeErr := io.WriteString(connection, "OK 1073741935\nhello")
		serverErr <- writeErr
	}()

	connection, err := DialContext(context.Background(), listener.Addr().String(), 8082)
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	payload := make([]byte, 5)
	if _, err := io.ReadFull(connection, payload); err != nil {
		t.Fatal(err)
	}
	if string(payload) != "hello" {
		t.Fatalf("payload = %q, want hello", payload)
	}
	if err := <-serverErr; err != nil {
		t.Fatal(err)
	}
}

func TestDialContextClassifiesClosedHandshake(t *testing.T) {
	listener, err := new(net.ListenConfig).Listen(t.Context(), "unix", filepath.Join(t.TempDir(), "vsock.sock"))
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	serverDone := make(chan error, 1)
	go func() {
		connection, acceptErr := listener.Accept()
		if acceptErr != nil {
			serverDone <- acceptErr
			return
		}
		serverDone <- connection.Close()
	}()

	connection, dialErr := DialContext(context.Background(), listener.Addr().String(), 8082)
	if connection != nil {
		if closeErr := connection.Close(); closeErr != nil {
			t.Fatal(closeErr)
		}
	}
	if !errors.Is(dialErr, ErrHandshakeClosed) {
		t.Fatalf("DialContext() error = %v, want classified closed handshake", dialErr)
	}
	if err := <-serverDone; err != nil {
		t.Fatal(err)
	}
}

func TestDialContextClassifiesHandshakeTimeout(t *testing.T) {
	listener, err := new(net.ListenConfig).Listen(t.Context(), "unix", filepath.Join(t.TempDir(), "vsock.sock"))
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	serverDone := make(chan error, 1)
	go func() {
		connection, acceptErr := listener.Accept()
		if acceptErr != nil {
			serverDone <- acceptErr
			return
		}
		defer connection.Close()
		_, readErr := bufio.NewReader(connection).ReadString('\n')
		if readErr != nil {
			serverDone <- readErr
			return
		}
		time.Sleep(100 * time.Millisecond)
		serverDone <- nil
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Millisecond)
	defer cancel()
	connection, dialErr := DialContext(ctx, listener.Addr().String(), 8082)
	if connection != nil {
		if closeErr := connection.Close(); closeErr != nil {
			t.Fatal(closeErr)
		}
	}
	if !errors.Is(dialErr, ErrHandshakeTimeout) {
		t.Fatalf("DialContext() error = %v, want classified handshake timeout", dialErr)
	}
	if err := <-serverDone; err != nil && !errors.Is(err, io.EOF) {
		t.Fatal(err)
	}
}

type unexpectedHandshake struct{ value string }

func (err *unexpectedHandshake) Error() string { return "unexpected handshake: " + err.value }
