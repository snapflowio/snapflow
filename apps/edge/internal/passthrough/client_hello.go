// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package passthrough

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
)

const maxClientHelloBytes = 64 << 10

var errClientHelloCaptured = errors.New("client hello captured")

type recordingConn struct {
	net.Conn
	reader io.Reader
}

func (connection recordingConn) Read(buffer []byte) (int, error) {
	return connection.reader.Read(buffer)
}

func (recordingConn) Write([]byte) (int, error) {
	return 0, io.ErrClosedPipe
}

func readServerName(ctx context.Context, connection net.Conn) (string, []byte, error) {
	var recorded bytes.Buffer
	reader := io.TeeReader(io.LimitReader(connection, maxClientHelloBytes), &recorded)
	var serverName string
	captured := false
	handshakeErr := tls.Server(recordingConn{Conn: connection, reader: reader}, &tls.Config{
		GetConfigForClient: func(hello *tls.ClientHelloInfo) (*tls.Config, error) {
			serverName, captured = hello.ServerName, true
			return nil, errClientHelloCaptured
		},
	}).HandshakeContext(ctx)
	if !captured {
		return "", recorded.Bytes(), fmt.Errorf("read TLS client hello: %w", handshakeErr)
	}
	return normalizeHost(serverName), recorded.Bytes(), nil
}

func normalizeHost(host string) string {
	return strings.TrimSuffix(strings.ToLower(strings.TrimSpace(host)), ".")
}
