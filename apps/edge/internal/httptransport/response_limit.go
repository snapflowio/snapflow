// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package httptransport

import (
	"errors"
	"fmt"
	"io"
	"net/http"
)

var ErrResponseBodyTooLarge = errors.New("HTTP response body exceeds its limit")

type BoundedResponseTransport struct {
	base         http.RoundTripper
	maximumBytes int64
}

func NewBoundedResponseTransport(
	base http.RoundTripper,
	maximumBytes int64,
) (*BoundedResponseTransport, error) {
	if base == nil {
		base = http.DefaultTransport
	}
	if maximumBytes < 1 {
		return nil, errors.New("maximum HTTP response body size must be positive")
	}
	return &BoundedResponseTransport{
		base:         base,
		maximumBytes: maximumBytes,
	}, nil
}

func (transport *BoundedResponseTransport) RoundTrip(
	request *http.Request,
) (*http.Response, error) {
	response, err := transport.base.RoundTrip(request)
	if err != nil {
		return response, err
	}
	if response.Body != nil {
		response.Body = &boundedResponseBody{
			ReadCloser: response.Body,
			remaining:  transport.maximumBytes,
			maximum:    transport.maximumBytes,
		}
	}
	return response, nil
}

type boundedResponseBody struct {
	io.ReadCloser
	remaining int64
	maximum   int64
}

func (body *boundedResponseBody) Read(destination []byte) (int, error) {
	if len(destination) == 0 {
		return 0, nil
	}
	if body.remaining > 0 {
		if int64(len(destination)) > body.remaining {
			destination = destination[:body.remaining]
		}
		read, err := body.ReadCloser.Read(destination)
		body.remaining -= int64(read)
		return read, err
	}
	var probe [1]byte
	read, err := body.ReadCloser.Read(probe[:])
	if read > 0 {
		return 0, fmt.Errorf(
			"%w: maximum is %d bytes",
			ErrResponseBodyTooLarge,
			body.maximum,
		)
	}
	if err != nil {
		return 0, err
	}
	return 0, io.ErrNoProgress
}
