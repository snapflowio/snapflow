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
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"sync"
	"sync/atomic"
	"time"

	yamux "github.com/libp2p/go-yamux/v5"
	"github.com/quic-go/quic-go"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/streamio"
)

const (
	http2DatagramStreamKind    = "datagrams"
	http2DatagramLengthBytes   = 2
	http2MaximumAcceptBacklog  = 4_096
	http2MaximumMessageBytes   = 64 << 10
	http2ServerIncomingStreams = 2
	http2LocalAddress          = http2Address("local")
	http2RemoteAddress         = http2Address("remote")
	http2AddressNetwork        = "http2"
)

type http2StreamHeader struct {
	Version int    `json:"version"`
	Kind    string `json:"kind"`
}

type http2Carrier struct {
	mux              *yamux.Session
	pipe             *meteredPipe
	sessionContext   context.Context
	cancel           context.CancelFunc
	client           bool
	maxDatagramBytes int
	datagramOnce     sync.Once
	datagram         Stream
	datagramErr      error
	datagramSend     sync.Mutex
	closeOnce        sync.Once
	closeErr         error
	tls              tls.ConnectionState
}

type meteredPipe struct {
	io.ReadWriteCloser
	bytesRead    atomic.Uint64
	bytesWritten atomic.Uint64
}

type multiplexedPipe struct {
	*meteredPipe
}

type http2Address string

func (address http2Address) Network() string { return http2AddressNetwork }

func (address http2Address) String() string { return string(address) }

func (pipe *multiplexedPipe) LocalAddr() net.Addr { return http2LocalAddress }

func (pipe *multiplexedPipe) RemoteAddr() net.Addr { return http2RemoteAddress }

func (pipe *multiplexedPipe) SetDeadline(time.Time) error { return nil }

func (pipe *multiplexedPipe) SetReadDeadline(time.Time) error { return nil }

func (pipe *multiplexedPipe) SetWriteDeadline(time.Time) error { return nil }

func (pipe *meteredPipe) Read(payload []byte) (int, error) {
	read, err := pipe.ReadWriteCloser.Read(payload)
	pipe.bytesRead.Add(uint64(read))
	return read, err
}

func (pipe *meteredPipe) Write(payload []byte) (int, error) {
	written, err := pipe.ReadWriteCloser.Write(payload)
	pipe.bytesWritten.Add(uint64(written))
	return written, err
}

func newHTTP2Carrier(
	parent context.Context,
	pipe io.ReadWriteCloser,
	client bool,
	config Config,
	tlsState tls.ConnectionState,
) (*http2Carrier, error) {
	if pipe == nil {
		return nil, errors.New("HTTP/2 tunnel pipe is required")
	}
	metered := &meteredPipe{ReadWriteCloser: pipe}
	multiplexed := &multiplexedPipe{meteredPipe: metered}
	yamuxConfig := newYamuxConfig(client, config)
	var (
		session *yamux.Session
		err     error
	)
	if client {
		session, err = yamux.Client(multiplexed, yamuxConfig, nil)
	} else {
		session, err = yamux.Server(multiplexed, yamuxConfig, nil)
	}
	if err != nil {
		return nil, errors.Join(err, pipe.Close())
	}
	ctx, cancel := context.WithCancel(parent)
	result := &http2Carrier{
		mux: session, pipe: metered, sessionContext: ctx, cancel: cancel,
		client: client, maxDatagramBytes: config.MaxDatagramBytes, tls: tlsState,
	}
	go func() {
		select {
		case <-ctx.Done():
		case <-session.CloseChan():
			cancel()
		}
	}()
	return result, nil
}

func newYamuxConfig(client bool, config Config) *yamux.Config {
	yamuxConfig := yamux.DefaultConfig()
	yamuxConfig.AcceptBacklog = int(min(config.MaxIncomingStreams, http2MaximumAcceptBacklog))
	yamuxConfig.EnableKeepAlive = true
	yamuxConfig.KeepAliveInterval = config.KeepAlivePeriod
	yamuxConfig.MeasureRTTInterval = config.KeepAlivePeriod
	yamuxConfig.ConnectionWriteTimeout = config.OpenStreamTimeout
	yamuxConfig.LogOutput = io.Discard
	yamuxConfig.InitialStreamWindowSize = uint32(min(config.InitialStreamReceiveWindow, uint64(math.MaxUint32)))
	yamuxConfig.MaxStreamWindowSize = uint32(min(config.MaxStreamReceiveWindow, uint64(math.MaxUint32)))
	yamuxConfig.MaxMessageSize = http2MaximumMessageBytes
	yamuxConfig.MaxIncomingStreams = http2ServerIncomingStreams
	if client {
		yamuxConfig.MaxIncomingStreams = uint32(min(config.MaxIncomingStreams, int64(math.MaxUint32)))
	}
	return yamuxConfig
}

func (carrier *http2Carrier) openStream(ctx context.Context) (Stream, error) {
	stream, err := carrier.mux.Open(ctx)
	if err != nil {
		return nil, fmt.Errorf("open HTTP/2 tunnel stream: %w", err)
	}
	return stream, nil
}

func (carrier *http2Carrier) acceptStream(ctx context.Context) (Stream, error) {
	type result struct {
		stream net.Conn
		err    error
	}
	results := make(chan result, 1)
	go func() {
		stream, err := carrier.mux.Accept()
		results <- result{stream: stream, err: err}
	}()
	select {
	case <-ctx.Done():
		return nil, errors.Join(ctx.Err(), carrier.shutdown())
	case accepted := <-results:
		if accepted.err != nil {
			return nil, fmt.Errorf("accept HTTP/2 tunnel stream: %w", accepted.err)
		}
		return accepted.stream, nil
	}
}

func (carrier *http2Carrier) sendDatagram(frame []byte) error {
	stream, err := carrier.datagramStream()
	if err != nil {
		return err
	}
	if len(frame) > math.MaxUint16 {
		return errors.New("HTTP/2 datagram frame is too large")
	}
	var size [http2DatagramLengthBytes]byte
	binary.BigEndian.PutUint16(size[:], uint16(len(frame)))
	carrier.datagramSend.Lock()
	defer carrier.datagramSend.Unlock()
	if err := streamio.WriteAll(stream, size[:]); err != nil {
		return err
	}
	return streamio.WriteAll(stream, frame)
}

func (carrier *http2Carrier) receiveDatagram(ctx context.Context) ([]byte, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	stream, err := carrier.datagramStream()
	if err != nil {
		return nil, err
	}
	var size [http2DatagramLengthBytes]byte
	if _, err := io.ReadFull(stream, size[:]); err != nil {
		return nil, fmt.Errorf("read HTTP/2 datagram size: %w", err)
	}
	frameSize := int(binary.BigEndian.Uint16(size[:]))
	if frameSize < 1 || frameSize > carrier.maxDatagramBytes {
		return nil, fmt.Errorf("HTTP/2 datagram frame has invalid size %d", frameSize)
	}
	frame := make([]byte, frameSize)
	if _, err := io.ReadFull(stream, frame); err != nil {
		return nil, fmt.Errorf("read HTTP/2 datagram: %w", err)
	}
	return frame, nil
}

func (carrier *http2Carrier) datagramStream() (Stream, error) {
	carrier.datagramOnce.Do(func() {
		stream, err := carrier.establishDatagramStream()
		if err != nil && stream != nil {
			err = errors.Join(err, stream.Close())
			stream = nil
		}
		carrier.datagram, carrier.datagramErr = stream, err
	})
	return carrier.datagram, carrier.datagramErr
}

func (carrier *http2Carrier) establishDatagramStream() (Stream, error) {
	header := http2StreamHeader{Version: protocol.Version, Kind: http2DatagramStreamKind}
	if carrier.client {
		stream, err := carrier.openStream(carrier.sessionContext)
		if err != nil {
			return nil, err
		}
		return stream, protocol.WriteFrame(stream, header)
	}
	stream, err := carrier.acceptStream(carrier.sessionContext)
	if err != nil {
		return nil, err
	}
	var received http2StreamHeader
	if err := protocol.ReadFrame(stream, &received); err != nil {
		return stream, err
	}
	if received != header {
		return stream, errors.New("unexpected HTTP/2 stream kind")
	}
	return stream, nil
}

func (carrier *http2Carrier) close(quic.ApplicationErrorCode, string) error {
	return carrier.shutdown()
}

func (carrier *http2Carrier) shutdown() error {
	carrier.closeOnce.Do(func() {
		carrier.cancel()
		carrier.closeErr = errors.Join(carrier.mux.Close(), carrier.pipe.Close())
	})
	return carrier.closeErr
}

func (carrier *http2Carrier) context() context.Context {
	return carrier.sessionContext
}

func (carrier *http2Carrier) metrics() Metrics {
	rtt := carrier.mux.RTT()
	return Metrics{
		MinimumRTT:    rtt,
		LatestRTT:     rtt,
		SmoothedRTT:   rtt,
		BytesSent:     carrier.pipe.bytesWritten.Load(),
		BytesReceived: carrier.pipe.bytesRead.Load(),
	}
}

func (carrier *http2Carrier) tlsState() tls.ConnectionState {
	return carrier.tls
}
