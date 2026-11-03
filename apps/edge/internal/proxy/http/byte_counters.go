// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"

	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/edge/internal/traffic"
)

type countingReadCloser struct {
	io.ReadCloser
	counter *traffic.Counter
}

func (reader *countingReadCloser) Read(destination []byte) (int, error) {
	read, err := reader.ReadCloser.Read(destination)
	if read > 0 {
		reader.counter.AddIngress(uint64(read), 0)
	}
	return read, err
}

type countingResponseWriter struct {
	http.ResponseWriter
	counter   func() *traffic.Counter
	committed bool
}

func (writer *countingResponseWriter) Write(payload []byte) (int, error) {
	writer.committed = true
	written, err := writer.ResponseWriter.Write(payload)
	if written > 0 {
		writer.counter().AddEgress(uint64(written), 0)
	}
	return written, err
}

func (writer *countingResponseWriter) WriteHeader(statusCode int) {
	writer.committed = true
	writer.ResponseWriter.WriteHeader(statusCode)
}

func (writer *countingResponseWriter) Unwrap() http.ResponseWriter {
	return writer.ResponseWriter
}

func (writer *countingResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	connection, buffered, err := http.NewResponseController(writer.ResponseWriter).Hijack()
	if err != nil {
		return nil, nil, fmt.Errorf("hijack the client connection: %w", err)
	}
	counter := writer.counter()
	metered, err := proxy.NewMeteredConn(connection, counter)
	if err != nil {
		return nil, nil, errors.Join(err, connection.Close())
	}
	reader := bufio.NewReader(&countingReadCloser{ReadCloser: io.NopCloser(buffered.Reader), counter: counter})
	return metered, bufio.NewReadWriter(reader, bufio.NewWriter(metered)), nil
}
