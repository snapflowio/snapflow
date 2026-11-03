// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/tunnel/plan"
)

const guestServiceReadHeaderTimeout = 10 * time.Second

func (manager *Manager) dialGuestService(
	ctx context.Context,
	target plan.Target,
) (net.Conn, error) {
	upstream, err := manager.runtime.GuestServiceTarget(
		ctx,
		target.SandboxID,
		target.GuestService,
	)
	if err != nil {
		return nil, fmt.Errorf("resolve guest service target: %w", err)
	}
	return newGuestServiceConnection(upstream) //nolint:contextcheck // the proxied connection serves requests under their own request contexts
}

func newGuestServiceConnection(target *microvmtypes.ProxyTarget) (net.Conn, error) {
	if target == nil || target.URL == nil || target.Transport == nil {
		return nil, errors.New("guest service target is incomplete")
	}
	client, server := net.Pipe()
	proxy := &httputil.ReverseProxy{
		Rewrite: func(request *httputil.ProxyRequest) {
			request.SetURL(target.URL)
			request.Out.Host = target.URL.Host
			target.ApplyHeaders(request.Out.Header)
		},
		Transport:     target.Transport,
		FlushInterval: -1,
	}
	if target.ObserveResponse != nil {
		proxy.ModifyResponse = func(response *http.Response) error {
			return target.ObserveResponse(response.Request.Context(), response.StatusCode)
		}
	}
	listener := &singleConnectionListener{connection: server}
	go func() {
		server := &http.Server{
			Handler:           proxy,
			ReadHeaderTimeout: guestServiceReadHeaderTimeout,
		}
		serveErr := server.Serve(listener)
		if serveErr != nil && !errors.Is(serveErr, net.ErrClosed) &&
			!errors.Is(serveErr, http.ErrServerClosed) {
			client.Close()
		}
	}()
	return client, nil
}

type singleConnectionListener struct {
	connection net.Conn
	accepted   bool
}

func (listener *singleConnectionListener) Accept() (net.Conn, error) {
	if listener.accepted {
		return nil, net.ErrClosed
	}
	listener.accepted = true
	return listener.connection, nil
}

func (*singleConnectionListener) Close() error {
	return nil
}

func (listener *singleConnectionListener) Addr() net.Addr {
	return listener.connection.LocalAddr()
}
