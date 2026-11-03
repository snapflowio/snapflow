// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

func roundTripWithHeaderTimeout(
	transport http.RoundTripper,
	request *http.Request,
	timeout time.Duration,
) (*http.Response, error) {
	if timeout <= 0 {
		return transport.RoundTrip(request)
	}
	ctx, cancel := context.WithCancel(request.Context())
	timerDone := make(chan struct{})
	timer := time.AfterFunc(timeout, func() {
		cancel()
		close(timerDone)
	})
	response, err := transport.RoundTrip(request.WithContext(ctx))
	if !timer.Stop() {
		<-timerDone
		if response != nil && response.Body != nil {
			if closeErr := response.Body.Close(); closeErr != nil {
				return nil, errors.Join(
					fmt.Errorf("close timed-out upstream response: %w", closeErr),
					fmt.Errorf(
						"upstream response header timeout after %s: %w",
						timeout,
						context.DeadlineExceeded,
					),
				)
			}
		}
		return nil, fmt.Errorf(
			"upstream response header timeout after %s: %w",
			timeout,
			context.DeadlineExceeded,
		)
	}
	if err != nil {
		cancel()
		return nil, err
	}
	if response.Body == nil {
		cancel()
	} else {
		response.Body = &cancelOnCloseBody{
			ReadCloser: response.Body,
			cancel:     cancel,
		}
	}
	return response, nil
}

type cancelOnCloseBody struct {
	io.ReadCloser
	cancel context.CancelFunc
	once   sync.Once
}

func (body *cancelOnCloseBody) Close() error {
	err := body.ReadCloser.Close()
	body.once.Do(body.cancel)
	return err
}

type callbackOnCloseBody struct {
	io.ReadCloser
	callback func()
	once     sync.Once
}

func (body *callbackOnCloseBody) Close() error {
	err := body.ReadCloser.Close()
	body.once.Do(body.callback)
	return err
}
