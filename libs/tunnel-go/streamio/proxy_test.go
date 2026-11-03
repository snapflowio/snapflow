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

package streamio

import (
	"bytes"
	"errors"
	"io"
	"sync"
	"testing"
	"time"
)

const proxyCompletionTimeout = time.Second

type chunkWriter struct {
	buffer bytes.Buffer
	chunk  int
}

func (writer *chunkWriter) Write(payload []byte) (int, error) {
	return writer.buffer.Write(payload[:min(len(payload), writer.chunk)])
}

type zeroWriter struct{}

func (zeroWriter) Write([]byte) (int, error) {
	return 0, nil
}

type gatedWriteStream struct {
	reader  *bytes.Reader
	started chan struct{}
	release chan struct{}
	once    sync.Once
}

func (stream *gatedWriteStream) Read(payload []byte) (int, error) {
	return stream.reader.Read(payload)
}

func (stream *gatedWriteStream) Write(payload []byte) (int, error) {
	stream.once.Do(func() { close(stream.started) })
	<-stream.release
	return len(payload), nil
}

func (*gatedWriteStream) CloseWrite() error { return nil }

func (*gatedWriteStream) Close() error { return nil }

type halfCloseBuffer struct {
	reader      *bytes.Reader
	written     bytes.Buffer
	writeClosed bool
	closed      bool
}

type blockingHalfCloseStream struct {
	readErr       error
	closeWriteErr error
	closed        chan struct{}
	closeOnce     sync.Once
}

func newBlockingHalfCloseStream(readErr error) *blockingHalfCloseStream {
	return &blockingHalfCloseStream{readErr: readErr, closed: make(chan struct{})}
}

func (stream *blockingHalfCloseStream) Read([]byte) (int, error) {
	if stream.readErr != nil {
		return 0, stream.readErr
	}
	<-stream.closed
	return 0, io.ErrClosedPipe
}

func (stream *blockingHalfCloseStream) Write(payload []byte) (int, error) {
	return len(payload), nil
}

func (stream *blockingHalfCloseStream) CloseWrite() error {
	return stream.closeWriteErr
}

func (stream *blockingHalfCloseStream) Close() error {
	stream.closeOnce.Do(func() { close(stream.closed) })
	return nil
}

func newHalfCloseBuffer(payload string) *halfCloseBuffer {
	return &halfCloseBuffer{reader: bytes.NewReader([]byte(payload))}
}

func (buffer *halfCloseBuffer) Read(destination []byte) (int, error) {
	return buffer.reader.Read(destination)
}

func (buffer *halfCloseBuffer) Write(payload []byte) (int, error) {
	return buffer.written.Write(payload)
}

func (buffer *halfCloseBuffer) CloseWrite() error {
	buffer.writeClosed = true
	return nil
}

func (buffer *halfCloseBuffer) Close() error {
	buffer.closed = true
	return nil
}

func TestWriteAllHandlesShortWrites(t *testing.T) {
	t.Parallel()
	writer := &chunkWriter{chunk: 2}
	if err := WriteAll(writer, []byte("abcdef")); err != nil {
		t.Fatalf("WriteAll: %v", err)
	}
	if writer.buffer.String() != "abcdef" {
		t.Fatalf("written payload = %q", writer.buffer.String())
	}
	if err := WriteAll(zeroWriter{}, []byte("payload")); !errors.Is(err, io.ErrShortWrite) {
		t.Fatalf("zero-byte write error = %v, want io.ErrShortWrite", err)
	}
}

func TestProxyBidirectionalCountedPreservesHalfClose(t *testing.T) {
	t.Parallel()
	left := newHalfCloseBuffer("from-left")
	right := newHalfCloseBuffer("from-right")
	stats, err := ProxyBidirectionalCounted(left, right)
	if err != nil {
		t.Fatalf("ProxyBidirectionalCounted: %v", err)
	}
	if right.written.String() != "from-left" ||
		left.written.String() != "from-right" {
		t.Fatalf(
			"proxied left=%q right=%q",
			left.written.String(),
			right.written.String(),
		)
	}
	if stats.LeftToRightBytes != uint64(len("from-left")) ||
		stats.RightToLeftBytes != uint64(len("from-right")) {
		t.Fatalf("proxy stats = %+v", stats)
	}
	if !left.writeClosed || !right.writeClosed {
		t.Fatal("proxy did not half-close both destinations")
	}
	if left.closed || right.closed {
		t.Fatal("proxy fully closed a half-close-capable destination")
	}
}

func TestProxyBidirectionalCountedClosesPeerAfterCopyFailure(t *testing.T) {
	t.Parallel()
	copyFailure := errors.New("client transport failed")
	left := newBlockingHalfCloseStream(copyFailure)
	right := newBlockingHalfCloseStream(nil)
	result := make(chan error, 1)
	go func() {
		_, err := ProxyBidirectionalCounted(left, right)
		result <- err
	}()

	select {
	case err := <-result:
		if !errors.Is(err, copyFailure) {
			t.Fatalf("ProxyBidirectionalCounted error = %v, want %v", err, copyFailure)
		}
	case <-time.After(proxyCompletionTimeout):
		t.Fatal("proxy did not close the peer after a copy failure")
	}
}

func TestProxyBidirectionalCountedClosesPeerAfterHalfCloseFailure(t *testing.T) {
	t.Parallel()
	halfCloseFailure := errors.New("half-close failed")
	left := newBlockingHalfCloseStream(io.EOF)
	right := newBlockingHalfCloseStream(nil)
	right.closeWriteErr = halfCloseFailure
	result := make(chan error, 1)
	go func() {
		_, err := ProxyBidirectionalCounted(left, right)
		result <- err
	}()

	select {
	case err := <-result:
		if !errors.Is(err, halfCloseFailure) {
			t.Fatalf("ProxyBidirectionalCounted error = %v, want %v", err, halfCloseFailure)
		}
	case <-time.After(proxyCompletionTimeout):
		t.Fatal("proxy did not close the peer after a half-close failure")
	}
}

func TestProxyBidirectionalCountedAppliesSlowReaderBackpressure(t *testing.T) {
	t.Parallel()
	const payloadBytes = 1 << 20
	left := &gatedWriteStream{
		reader:  bytes.NewReader(bytes.Repeat([]byte{0x41}, payloadBytes)),
		started: make(chan struct{}),
		release: make(chan struct{}),
	}
	right := &gatedWriteStream{
		reader:  bytes.NewReader(nil),
		started: make(chan struct{}),
		release: make(chan struct{}),
	}
	close(left.release)
	result := make(chan error, 1)
	go func() {
		_, err := ProxyBidirectionalCounted(left, right)
		result <- err
	}()
	<-right.started
	if left.reader.Len() == 0 {
		t.Fatal("proxy consumed the entire source while its destination was blocked")
	}
	select {
	case err := <-result:
		t.Fatalf("proxy completed before slow reader resumed: %v", err)
	default:
	}
	close(right.release)
	select {
	case err := <-result:
		if err != nil {
			t.Fatalf("proxy after slow reader recovery: %v", err)
		}
	case <-time.After(proxyCompletionTimeout):
		t.Fatal("proxy did not resume after the slow reader recovered")
	}
}
