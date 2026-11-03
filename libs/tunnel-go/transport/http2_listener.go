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

package transport

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"sync"
)

const (
	http2ALPN                     = "h2"
	http2ConnectPath              = "/.well-known/snapflow-tunnel/connect"
	http2ContentType              = "application/octet-stream"
	http2PendingSessions          = 128
	http2MaximumConcurrentStreams = 4_096
	http2TCPNetwork               = "tcp"
	http2ProtocolMajor            = 2
	httpsScheme                   = "https://"
	contentTypeHeader             = "Content-Type"
)

type http2Listener struct {
	listener net.Listener
	server   *http.Server
	sessions chan *http2Carrier
	errs     chan error
	once     sync.Once
	closeErr error
}

type clientPipe struct {
	reader    io.ReadCloser
	writer    *io.PipeWriter
	transport *http.Transport
	cancel    context.CancelFunc
	once      sync.Once
	closeErr  error
}

func (pipe *clientPipe) Read(payload []byte) (int, error) {
	return pipe.reader.Read(payload)
}

func (pipe *clientPipe) Write(payload []byte) (int, error) {
	return pipe.writer.Write(payload)
}

func (pipe *clientPipe) Close() error {
	pipe.once.Do(func() {
		pipe.closeErr = errors.Join(pipe.writer.Close(), pipe.reader.Close())
		pipe.cancel()
		pipe.transport.CloseIdleConnections()
	})
	return pipe.closeErr
}

type serverPipe struct {
	reader io.ReadCloser
	writer http.ResponseWriter
	flush  http.Flusher
	mu     sync.Mutex
	once   sync.Once
	closed bool
	err    error
}

func (pipe *serverPipe) Read(payload []byte) (int, error) {
	return pipe.reader.Read(payload)
}

func (pipe *serverPipe) Write(payload []byte) (int, error) {
	pipe.mu.Lock()
	defer pipe.mu.Unlock()
	if pipe.closed {
		return 0, net.ErrClosed
	}
	written, err := pipe.writer.Write(payload)
	if err == nil {
		pipe.flush.Flush()
	}
	return written, err
}

func (pipe *serverPipe) Close() error {
	pipe.once.Do(func() {
		pipe.mu.Lock()
		pipe.closed = true
		pipe.err = pipe.reader.Close()
		pipe.mu.Unlock()
	})
	return pipe.err
}

func dialHTTP2(
	ctx context.Context,
	address string,
	tlsConfig *tls.Config,
	config Config,
) (*http2Carrier, error) {
	secured := tlsConfig.Clone()
	secured.NextProtos = []string{http2ALPN}
	httpTransport := &http.Transport{TLSClientConfig: secured, Protocols: http2Only()}
	sessionContext, cancelSession := context.WithCancel(context.WithoutCancel(ctx))
	dialContext, cancelDial := context.WithTimeout(ctx, config.HandshakeTimeout)
	defer cancelDial()
	stopDialBound := context.AfterFunc(dialContext, cancelSession)
	reader, writer := io.Pipe()
	request, err := http.NewRequestWithContext(
		sessionContext,
		http.MethodPost,
		httpsScheme+address+http2ConnectPath,
		reader,
	)
	if err != nil {
		cancelSession()
		return nil, errors.Join(err, reader.Close(), writer.Close())
	}
	request.Host = secured.ServerName
	request.Header.Set(contentTypeHeader, http2ContentType)
	response, err := httpTransport.RoundTrip(request)
	dialBounded := stopDialBound()
	if err != nil {
		cancelSession()
		return nil, errors.Join(err, reader.Close(), writer.Close())
	}
	if !dialBounded || response.StatusCode != http.StatusOK || response.TLS == nil {
		cancelSession()
		return nil, errors.Join(
			http2DialError(dialContext, response),
			response.Body.Close(),
			writer.Close(),
		)
	}
	pipe := &clientPipe{
		reader: response.Body, writer: writer, transport: httpTransport, cancel: cancelSession,
	}
	return newHTTP2Carrier(sessionContext, pipe, true, config, *response.TLS)
}

// http2Only is the protocol set for both tunnel ends: HTTP/2 over TLS and
// nothing else, so a peer that does not negotiate h2 is refused.
func http2Only() *http.Protocols {
	var protocols http.Protocols
	protocols.SetHTTP2(true)
	return &protocols
}

func http2DialError(dialContext context.Context, response *http.Response) error {
	if err := dialContext.Err(); err != nil {
		return fmt.Errorf("HTTP/2 tunnel dial: %w", err)
	}
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP/2 tunnel returned status %d", response.StatusCode)
	}
	return errors.New("HTTP/2 tunnel has no TLS state")
}

func serveHTTP2(
	tcpListener net.Listener,
	tlsConfig *tls.Config,
	config Config,
) (*http2Listener, error) {
	if tcpListener == nil {
		return nil, errors.New("HTTP/2 tunnel TCP listener is required")
	}
	secured := tlsConfig.Clone()
	secured.NextProtos = []string{http2ALPN}
	admittedTLS, err := newTLSAdmissionListener(
		tcpListener,
		secured,
		config.MaxHTTP2TLSHandshakes,
		config.MaxHTTP2TLSHandshakesPerIP,
	)
	if err != nil {
		return nil, errors.Join(err, tcpListener.Close())
	}
	result := &http2Listener{
		listener: admittedTLS,
		sessions: make(chan *http2Carrier, http2PendingSessions),
		errs:     make(chan error, 1),
	}
	mux := http.NewServeMux()
	mux.HandleFunc(http2ConnectPath, func(writer http.ResponseWriter, request *http.Request) {
		result.handle(writer, request, config)
	})
	result.server = &http.Server{
		Handler:           mux,
		TLSConfig:         secured,
		Protocols:         http2Only(),
		HTTP2:             &http.HTTP2Config{MaxConcurrentStreams: int(min(config.MaxIncomingStreams, http2MaximumConcurrentStreams))},
		ReadHeaderTimeout: config.HandshakeTimeout,
		ConnState: func(connection net.Conn, state http.ConnState) {
			if state == http.StateActive ||
				state == http.StateHijacked ||
				state == http.StateClosed {
				admittedTLS.release(connection)
			}
		},
	}
	go func() {
		err := result.server.Serve(admittedTLS)
		if errors.Is(err, http.ErrServerClosed) {
			err = nil
		}
		result.errs <- err
	}()
	return result, nil
}

func (listener *http2Listener) handle(
	writer http.ResponseWriter,
	request *http.Request,
	config Config,
) {
	flusher, streaming := duplexStream(writer, request)
	if !streaming {
		return
	}
	sessionContext, admitted := admitHTTP2(writer, request, config)
	if !admitted {
		return
	}
	writer.Header().Set(contentTypeHeader, http2ContentType)
	writer.WriteHeader(http.StatusOK)
	flusher.Flush()
	if request.TLS == nil {
		return
	}
	pipe := &serverPipe{reader: request.Body, writer: writer, flush: flusher}
	carrier, err := newHTTP2Carrier(sessionContext, pipe, false, config, *request.TLS) //nolint:contextcheck // ServerAdmission derives the session context from request.Context()
	if err != nil {
		return
	}
	select {
	case listener.sessions <- carrier:
	case <-request.Context().Done():
	}
	select {
	case <-carrier.sessionContext.Done():
	case <-request.Context().Done():
	}
	if closeErr := carrier.shutdown(); closeErr != nil {
		slog.Debug("close HTTP/2 tunnel session", "error", closeErr)
	}
}

func duplexStream(writer http.ResponseWriter, request *http.Request) (http.Flusher, bool) {
	if request.Method != http.MethodPost || request.ProtoMajor != http2ProtocolMajor || request.Body == nil {
		http.Error(writer, "HTTP/2 tunnel stream required", http.StatusBadRequest)
		return nil, false
	}
	flusher, supportsFlush := writer.(http.Flusher)
	if !supportsFlush {
		http.Error(writer, "streaming response unsupported", http.StatusInternalServerError)
		return nil, false
	}
	if err := http.NewResponseController(writer).EnableFullDuplex(); err != nil {
		http.Error(writer, "full-duplex response unsupported", http.StatusInternalServerError)
		return nil, false
	}
	return flusher, true
}

func admitHTTP2(
	writer http.ResponseWriter,
	request *http.Request,
	config Config,
) (context.Context, bool) {
	if config.ServerAdmission == nil {
		return request.Context(), true
	}
	remoteAddress, err := net.ResolveTCPAddr(http2TCPNetwork, request.RemoteAddr)
	if err != nil {
		http.Error(writer, "invalid remote address", http.StatusBadRequest)
		return nil, false
	}
	sessionContext, err := config.ServerAdmission(
		request.Context(),
		ClientInfo{RemoteAddr: remoteAddress, AddressVerified: true},
	)
	if err != nil {
		http.Error(writer, "session admission rejected", http.StatusTooManyRequests)
		return nil, false
	}
	return sessionContext, true
}

func (listener *http2Listener) close() error {
	listener.once.Do(func() {
		listener.closeErr = listener.server.Close()
	})
	return listener.closeErr
}
