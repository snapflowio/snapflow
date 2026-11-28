// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package proxy

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"syscall"
	"time"
)

const (
	maximumReplayBody   = 256 << 10
	maximumIdleConns    = 100
	tlsHandshakeTimeout = 10 * time.Second
	idleConnTimeout     = 30 * time.Second
	dialTimeout         = 30 * time.Second
	dialKeepAlive       = 30 * time.Second
)

type retryTransport struct {
	base http.RoundTripper
}

func newTransport() *retryTransport {
	return &retryTransport{base: &http.Transport{
		MaxIdleConns:        maximumIdleConns,
		MaxIdleConnsPerHost: maximumIdleConns,
		TLSHandshakeTimeout: tlsHandshakeTimeout,
		IdleConnTimeout:     idleConnTimeout,
		DialContext:         (&net.Dialer{Timeout: dialTimeout, KeepAlive: dialKeepAlive}).DialContext,
	}}
}

func (t *retryTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	attempt, err := replayable(request)
	if err != nil {
		return nil, err
	}
	response, err := t.base.RoundTrip(attempt)
	if err == nil || attempt.GetBody == nil || !staleConnection(err) {
		return response, err
	}
	retry := attempt.Clone(attempt.Context())
	body, rewindErr := attempt.GetBody()
	if rewindErr != nil {
		return nil, errors.Join(err, fmt.Errorf("rewind proxied request body: %w", rewindErr))
	}
	retry.Body = body
	return t.base.RoundTrip(retry)
}

func replayable(request *http.Request) (*http.Request, error) {
	attempt := request.Clone(request.Context())
	if request.Body == nil || request.Body == http.NoBody {
		attempt.GetBody = func() (io.ReadCloser, error) { return http.NoBody, nil }
		return attempt, nil
	}
	if request.GetBody != nil || request.ContentLength < 0 || request.ContentLength > maximumReplayBody {
		return attempt, nil
	}
	data, readErr := io.ReadAll(request.Body)
	if err := errors.Join(readErr, request.Body.Close()); err != nil {
		return nil, fmt.Errorf("buffer proxied request body: %w", err)
	}
	attempt.ContentLength = int64(len(data))
	attempt.Body = io.NopCloser(bytes.NewReader(data))
	attempt.GetBody = func() (io.ReadCloser, error) { return io.NopCloser(bytes.NewReader(data)), nil }
	return attempt, nil
}

func staleConnection(err error) bool {
	return errors.Is(err, io.EOF) ||
		errors.Is(err, io.ErrUnexpectedEOF) ||
		errors.Is(err, syscall.ECONNRESET) ||
		errors.Is(err, syscall.EPIPE) ||
		errors.Is(err, net.ErrClosed)
}
