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
	"fmt"
	"io"
	"net"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const (
	handshakeTimeout        = 5 * time.Second
	maximumPort             = 65535
	handshakeResponseFields = 2
)

var (
	ErrHandshakeClosed  = errors.New("vsock proxy closed before completing the handshake")
	ErrHandshakeTimeout = errors.New("vsock proxy did not complete the handshake before its deadline")
)

func DialContext(ctx context.Context, socketPath string, port int) (net.Conn, error) {
	if strings.TrimSpace(socketPath) == "" {
		return nil, fmt.Errorf("vsock proxy path is required")
	}
	if port < 1 || port > maximumPort {
		return nil, fmt.Errorf("invalid vsock port %d", port)
	}
	conn, err := (&net.Dialer{}).DialContext(ctx, "unix", socketPath)
	if err != nil {
		return nil, fmt.Errorf("dial vsock proxy %s: %w", socketPath, err)
	}
	reader, err := handshake(ctx, conn, port)
	if err != nil {
		if closeErr := conn.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("close failed vsock handshake: %w", closeErr))
		}
		return nil, err
	}
	return &bufferedConn{Conn: conn, reader: reader}, nil
}

func handshake(ctx context.Context, conn net.Conn, port int) (*bufio.Reader, error) {
	deadline := time.Now().Add(handshakeTimeout)
	if contextDeadline, ok := ctx.Deadline(); ok && contextDeadline.Before(deadline) {
		deadline = contextDeadline
	}
	if err := conn.SetDeadline(deadline); err != nil {
		return nil, fmt.Errorf("set vsock handshake deadline: %w", err)
	}
	if _, err := fmt.Fprintf(conn, "CONNECT %d\n", port); err != nil {
		return nil, handshakeError("send vsock handshake", err)
	}
	reader := bufio.NewReader(conn)
	response, err := reader.ReadString('\n')
	if err != nil {
		return nil, handshakeError("read vsock handshake", err)
	}
	if err := conn.SetDeadline(time.Time{}); err != nil {
		return nil, fmt.Errorf("clear vsock handshake deadline: %w", err)
	}
	if err := validateHandshakeResponse(response); err != nil {
		return nil, err
	}
	return reader, nil
}

func validateHandshakeResponse(response string) error {
	fields := strings.Fields(response)
	if len(fields) != handshakeResponseFields || fields[0] != "OK" {
		return fmt.Errorf("vsock handshake rejected: %s", strings.TrimSpace(response))
	}
	allocatedPort, err := strconv.ParseUint(fields[1], 10, 32)
	if err != nil || allocatedPort == 0 {
		return fmt.Errorf("vsock handshake returned invalid allocated port: %s", strings.TrimSpace(response))
	}
	return nil
}

func handshakeError(operation string, err error) error {
	if handshakeTimedOut(err) {
		return fmt.Errorf("%w: %w", ErrHandshakeTimeout, err)
	}
	if handshakeClosed(err) {
		return fmt.Errorf("%w: %w", ErrHandshakeClosed, err)
	}
	return fmt.Errorf("%s: %w", operation, err)
}

func handshakeTimedOut(err error) bool {
	return errors.Is(err, context.DeadlineExceeded) || errors.Is(err, os.ErrDeadlineExceeded)
}

func handshakeClosed(err error) bool {
	return errors.Is(err, io.EOF) ||
		errors.Is(err, net.ErrClosed) ||
		errors.Is(err, syscall.ECONNRESET) ||
		errors.Is(err, syscall.EPIPE)
}

type bufferedConn struct {
	net.Conn
	reader *bufio.Reader
}

func (c *bufferedConn) Read(data []byte) (int, error) { return c.reader.Read(data) }
