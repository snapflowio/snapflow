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
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/netip"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	yamux "github.com/libp2p/go-yamux/v5"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/streamio"
)

const (
	benchmarkPayloadBytes    = 64 * 1024
	benchmarkShutdownTimeout = 5 * time.Second
)

type benchmarkSessionPair struct {
	edge       *Session
	machine    *Session
	control    Stream
	binding    protocol.Binding
	cancel     context.CancelFunc
	echoErrors chan error
	echoDone   chan struct{}
}

func BenchmarkTransportConcurrentStreams(b *testing.B) {
	for _, mode := range []DialMode{DialModeQUICOnly, DialModeHTTP2Only} {
		for _, clients := range []int{1, 100, 500, 1_000} {
			b.Run(fmt.Sprintf("%s/%d-clients", mode, clients), func(b *testing.B) {
				benchmarkConcurrentStreams(b, mode, clients)
			})
		}
	}
}

func BenchmarkTransportPersistentStreams(b *testing.B) {
	for _, mode := range []DialMode{DialModeQUICOnly, DialModeHTTP2Only} {
		for _, clients := range []int{1, 100, 500, 1_000} {
			b.Run(fmt.Sprintf("%s/%d-clients", mode, clients), func(b *testing.B) {
				benchmarkPersistentStreams(b, mode, clients)
			})
		}
	}
}

func BenchmarkTransportDatagramRoundTrip(b *testing.B) {
	for _, mode := range []DialMode{DialModeQUICOnly, DialModeHTTP2Only} {
		b.Run(string(mode), func(b *testing.B) {
			pair := openBenchmarkSessionPair(b, mode)
			backendID := uuid.New()
			payload := bytes.Repeat([]byte{0x5a}, 1_024)
			echoResult := make(chan error, 1)
			go func() {
				for {
					datagram, err := pair.machine.ReceiveUDP(context.Background())
					if err != nil {
						echoResult <- err
						return
					}
					if err := pair.machine.SendUDP(
						protocol.DatagramToEdge,
						datagram.BackendID,
						datagram.AssignmentGeneration,
						datagram.FlowID,
						datagram.Payload,
					); err != nil {
						echoResult <- err
						return
					}
				}
			}()
			b.ReportAllocs()
			b.SetBytes(int64(len(payload) * 2))
			b.ResetTimer()
			for iteration := 0; iteration < b.N; iteration++ {
				if err := pair.edge.SendUDP(
					protocol.DatagramToMachine,
					backendID,
					1,
					uint64(iteration)+1,
					payload,
				); err != nil {
					b.Fatalf("send datagram: %v", err)
				}
				response, err := pair.edge.ReceiveUDP(context.Background())
				if err != nil {
					b.Fatalf("receive datagram: %v", err)
				}
				if response.FlowID != uint64(iteration)+1 ||
					!bytes.Equal(response.Payload, payload) {
					b.Fatal("datagram response did not match request")
				}
			}
			b.StopTimer()
			select {
			case err := <-echoResult:
				if err != nil && !isExpectedBenchmarkClose(err) {
					b.Fatalf("datagram echo: %v", err)
				}
			default:
			}
		})
	}
}

func BenchmarkTransportSessionEstablishment(b *testing.B) {
	for _, mode := range []DialMode{DialModeQUICOnly, DialModeHTTP2Only} {
		b.Run(string(mode), func(b *testing.B) {
			serverTLS, clientTLS := testTLSConfigs(b)
			edgeID := uuid.NewString()
			b.ReportAllocs()
			b.ResetTimer()
			for range b.N {
				listener, err := Listen(
					b.Context(),
					"127.0.0.1:0",
					serverTLS,
					DefaultServerConfig(),
				)
				if err != nil {
					b.Fatalf("listen: %v", err)
				}
				ctx, cancel := context.WithTimeout(
					context.Background(),
					benchmarkShutdownTimeout,
				)
				accepted := make(chan *Session, 1)
				acceptErrors := make(chan error, 1)
				go func() {
					session, acceptErr := listener.Accept(ctx)
					if acceptErr != nil {
						acceptErrors <- acceptErr
						return
					}
					accepted <- session
				}()

				clientConfig := DefaultClientConfig()
				clientConfig.DialMode = mode
				machine, err := Dial(
					ctx,
					listener.Addr().String(),
					clientTLS,
					clientConfig,
				)
				if err != nil {
					cancel()
					closeErr := listener.Close()
					b.Fatalf(
						"dial %s: %v",
						mode,
						errors.Join(err, closeErr),
					)
				}
				var edge *Session
				select {
				case edge = <-accepted:
				case err := <-acceptErrors:
					b.Fatalf("accept %s: %v", mode, err)
				case <-ctx.Done():
					b.Fatalf("accept %s: %v", mode, ctx.Err())
				}
				serverHandshake := make(chan error, 1)
				go func() {
					_, _, handshakeErr := edge.ServerHandshake(
						ctx,
						func(
							hello protocol.ClientHello,
						) (protocol.ServerHello, error) {
							return protocol.ServerHello{
								Version: protocol.Version,
								EdgeID:  edgeID,
							}, hello.Validate()
						},
					)
					serverHandshake <- handshakeErr
				}()
				control, _, err := machine.ClientHandshake(
					ctx,
					protocol.ClientHello{
						Version:                  protocol.Version,
						MachineID:                uuid.New(),
						SessionID:                uuid.New(),
						MachineSessionGeneration: 1,
						Binding:                  testBinding(),
					},
				)
				if err != nil {
					b.Fatalf("client handshake %s: %v", mode, err)
				}
				if err := <-serverHandshake; err != nil {
					b.Fatalf("server handshake %s: %v", mode, err)
				}
				closeErr := errors.Join(
					control.Close(),
					edge.Close(0, "establishment benchmark complete"),
					machine.Close(0, "establishment benchmark complete"),
					listener.Close(),
				)
				cancel()
				if closeErr != nil && !isExpectedBenchmarkClose(closeErr) {
					b.Fatalf("close %s session: %v", mode, closeErr)
				}
			}
		})
	}
}

func benchmarkConcurrentStreams(
	b *testing.B,
	mode DialMode,
	clients int,
) {
	pair := openBenchmarkSessionPair(b, mode)
	payload := bytes.Repeat([]byte{0xa5}, benchmarkPayloadBytes)
	var next atomic.Uint64
	start := make(chan struct{})
	errorsFound := make(chan error, clients)
	var workers sync.WaitGroup
	workers.Add(clients)
	for range clients {
		go func() {
			defer workers.Done()
			<-start
			for {
				iteration := int(next.Add(1))
				if iteration > b.N {
					return
				}
				stream, err := pair.edge.OpenStream(
					context.Background(),
					protocol.StreamOpen{
						Version:      protocol.Version,
						Binding:      pair.binding,
						BackendID:    uuid.New(),
						ConnectionID: uuid.New(),
						Protocol:     protocol.ProtocolTCP,
						Source:       netip.MustParseAddrPort("192.0.2.1:50"),
					},
				)
				if err != nil {
					errorsFound <- fmt.Errorf("open stream: %w", err)
					return
				}
				writeResult := make(chan error, 1)
				go func() {
					writeErr := streamio.WriteAll(stream, payload)
					if writeErr == nil && mode == DialModeQUICOnly {
						writeErr = stream.Close()
					}
					writeResult <- writeErr
				}()
				response := make([]byte, len(payload))
				if _, err := io.ReadFull(stream, response); err != nil {
					closeErr := stream.Close()
					errorsFound <- errors.Join(err, closeErr)
					return
				}
				if err := <-writeResult; err != nil {
					closeErr := stream.Close()
					errorsFound <- errors.Join(err, closeErr)
					return
				}
				if !bytes.Equal(response, payload) {
					closeErr := stream.Close()
					errorsFound <- errors.Join(
						errors.New("stream response did not match request"),
						closeErr,
					)
					return
				}
				if err := stream.Close(); err != nil &&
					mode != DialModeQUICOnly {
					errorsFound <- err
					return
				}
			}
		}()
	}
	b.ReportAllocs()
	b.SetBytes(benchmarkPayloadBytes * 2)
	b.ResetTimer()
	close(start)
	workers.Wait()
	b.StopTimer()
	close(errorsFound)
	for err := range errorsFound {
		if err != nil {
			b.Fatal(err)
		}
	}
}

func benchmarkPersistentStreams(
	b *testing.B,
	mode DialMode,
	clients int,
) {
	pair := openBenchmarkSessionPairWithEchoLimit(b, mode, -1)
	payload := bytes.Repeat([]byte{0xa5}, benchmarkPayloadBytes)
	var next atomic.Uint64
	start := make(chan struct{})
	errorsFound := make(chan error, clients)
	var ready sync.WaitGroup
	var workers sync.WaitGroup
	ready.Add(clients)
	workers.Add(clients)
	for range clients {
		go func() {
			defer workers.Done()
			stream, err := pair.edge.OpenStream(
				context.Background(),
				protocol.StreamOpen{
					Version:      protocol.Version,
					Binding:      pair.binding,
					BackendID:    uuid.New(),
					ConnectionID: uuid.New(),
					Protocol:     protocol.ProtocolTCP,
					Source:       netip.MustParseAddrPort("192.0.2.1:50"),
				},
			)
			ready.Done()
			if err != nil {
				errorsFound <- fmt.Errorf("open persistent stream: %w", err)
				return
			}
			defer func() {
				if closeErr := stream.Close(); closeErr != nil &&
					mode != DialModeQUICOnly {
					errorsFound <- closeErr
				}
			}()
			<-start
			response := make([]byte, len(payload))
			for {
				iteration := int(next.Add(1))
				if iteration > b.N {
					return
				}
				writeResult := make(chan error, 1)
				go func() {
					writeResult <- streamio.WriteAll(stream, payload)
				}()
				if _, err := io.ReadFull(stream, response); err != nil {
					errorsFound <- fmt.Errorf("read persistent stream: %w", err)
					return
				}
				if err := <-writeResult; err != nil {
					errorsFound <- fmt.Errorf("write persistent stream: %w", err)
					return
				}
				if !bytes.Equal(response, payload) {
					errorsFound <- errors.New(
						"persistent stream response did not match request",
					)
					return
				}
			}
		}()
	}
	ready.Wait()
	b.ReportAllocs()
	b.SetBytes(benchmarkPayloadBytes * 2)
	b.ResetTimer()
	close(start)
	workers.Wait()
	b.StopTimer()
	close(errorsFound)
	for err := range errorsFound {
		if err != nil {
			b.Fatal(err)
		}
	}
}

func openBenchmarkSessionPair(
	b *testing.B,
	mode DialMode,
) *benchmarkSessionPair {
	return openBenchmarkSessionPairWithEchoLimit(
		b,
		mode,
		benchmarkPayloadBytes,
	)
}

func openBenchmarkSessionPairWithEchoLimit(
	b *testing.B,
	mode DialMode,
	echoLimit int64,
) *benchmarkSessionPair {
	b.Helper()
	serverTLS, clientTLS := testTLSConfigs(b)
	listener, err := Listen(
		b.Context(),
		"127.0.0.1:0",
		serverTLS,
		DefaultServerConfig(),
	)
	if err != nil {
		b.Fatalf("listen: %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	edgeID := uuid.New()
	accepted := make(chan *Session, 1)
	acceptErrors := make(chan error, 1)
	go func() {
		session, err := listener.Accept(ctx)
		if err != nil {
			acceptErrors <- err
			return
		}
		accepted <- session
	}()
	clientConfig := DefaultClientConfig()
	clientConfig.DialMode = mode
	machine, err := Dial(
		ctx,
		listener.Addr().String(),
		clientTLS,
		clientConfig,
	)
	if err != nil {
		cancel()
		closeErr := listener.Close()
		b.Fatalf("dial %s: %v", mode, errors.Join(err, closeErr))
	}
	var edge *Session
	select {
	case edge = <-accepted:
	case err := <-acceptErrors:
		b.Fatalf("accept %s: %v", mode, err)
	case <-time.After(5 * time.Second):
		b.Fatalf("accept %s timed out", mode)
	}
	serverHandshake := make(chan error, 1)
	go func() {
		_, _, err := edge.ServerHandshake(
			ctx,
			func(hello protocol.ClientHello) (protocol.ServerHello, error) {
				return protocol.ServerHello{
					Version: protocol.Version,
					EdgeID:  edgeID.String(),
				}, hello.Validate()
			},
		)
		serverHandshake <- err
	}()
	binding := testBinding()
	control, _, err := machine.ClientHandshake(ctx, protocol.ClientHello{
		Version:                  protocol.Version,
		MachineID:                uuid.New(),
		SessionID:                uuid.New(),
		MachineSessionGeneration: 1,
		Binding:                  binding,
	})
	if err != nil {
		b.Fatalf("client handshake: %v", err)
	}
	if err := <-serverHandshake; err != nil {
		b.Fatalf("server handshake: %v", err)
	}
	pair := &benchmarkSessionPair{
		edge: edge, machine: machine, control: control, binding: binding,
		cancel:     cancel,
		echoErrors: make(chan error, 1_024),
		echoDone:   make(chan struct{}),
	}
	go pair.echoStreams(ctx, echoLimit)
	b.Cleanup(func() { pair.shutdown(b, listener) })
	return pair
}

func (pair *benchmarkSessionPair) shutdown(b *testing.B, listener *Listener) {
	pair.cancel()
	echoStopped := false
	select {
	case <-pair.echoDone:
		echoStopped = true
	case <-time.After(benchmarkShutdownTimeout):
	}
	closeErr := errors.Join(
		pair.control.Close(),
		pair.edge.Close(0, "benchmark complete"),
		pair.machine.Close(0, "benchmark complete"),
		listener.Close(),
	)
	if !echoStopped {
		select {
		case <-pair.echoDone:
		case <-time.After(benchmarkShutdownTimeout):
			b.Error("stream echo workers did not stop")
		}
	}
	if closeErr != nil && !isExpectedBenchmarkClose(closeErr) {
		b.Errorf("close benchmark session: %v", closeErr)
	}
	for {
		select {
		case echoErr := <-pair.echoErrors:
			if echoErr != nil && !isExpectedBenchmarkClose(echoErr) {
				b.Errorf("stream echo: %v", echoErr)
			}
		default:
			return
		}
	}
}

func (pair *benchmarkSessionPair) echoStreams(ctx context.Context, limit int64) {
	var streams sync.WaitGroup
	defer func() {
		streams.Wait()
		close(pair.echoDone)
	}()
	for {
		stream, _, err := pair.machine.AcceptStream(ctx)
		if err != nil {
			pair.echoErrors <- err
			return
		}
		if err := protocol.WriteFrame(stream, protocol.StreamOpenResult{
			Version: protocol.Version,
			Status:  protocol.StreamOpenStatusAccepted,
		}); err != nil {
			pair.echoErrors <- errors.Join(err, stream.Close())
			continue
		}
		streams.Add(1)
		go func() {
			defer streams.Done()
			var copyErr error
			if limit < 0 {
				for {
					if _, copyErr = io.CopyN(
						stream,
						stream,
						benchmarkPayloadBytes,
					); copyErr != nil {
						break
					}
				}
			} else {
				_, copyErr = io.CopyN(stream, stream, limit)
			}
			closeErr := stream.Close()
			if joined := errors.Join(copyErr, closeErr); joined != nil {
				pair.echoErrors <- joined
			}
		}()
	}
}

func isExpectedBenchmarkClose(err error) bool {
	return errors.Is(err, context.Canceled) ||
		errors.Is(err, net.ErrClosed) ||
		errors.Is(err, io.EOF) ||
		errors.Is(err, io.ErrClosedPipe) ||
		errors.Is(err, yamux.ErrSessionShutdown) ||
		errors.Is(err, yamux.ErrRemoteGoAway)
}
