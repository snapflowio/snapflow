// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/snapflowio/edge/internal/proxy"
)

const (
	tcpNetwork            = "tcp"
	httpReadHeaderTimeout = 30 * time.Second
	httpShutdownTimeout   = 10 * time.Second
	httpIdleTimeout       = 120 * time.Second
	httpMaxHeaderBytes    = 64 << 10
	http2Protocol         = "h2"
	http1Protocol         = "http/1.1"
	listenerCount         = 2
)

func (frontend *Frontend) Run(ctx context.Context) error {
	var listenConfig net.ListenConfig
	httpListener, err := listenConfig.Listen(ctx, tcpNetwork, frontend.config.HTTPAddress)
	if err != nil {
		return fmt.Errorf("listen for edge HTTP ingress: %w", err)
	}
	httpsListener, err := listenConfig.Listen(ctx, tcpNetwork, frontend.config.HTTPSAddress)
	if err != nil {
		return errors.Join(
			fmt.Errorf("listen for edge HTTPS ingress: %w", err),
			httpListener.Close(),
		)
	}
	return frontend.serve(ctx, httpListener, httpsListener)
}

func (frontend *Frontend) serve(
	ctx context.Context,
	httpListener net.Listener,
	httpsListener net.Listener,
) error {
	httpsAddress, valid := proxy.SourceAddress(httpsListener.Addr())
	if !valid {
		return errors.Join(
			fmt.Errorf("edge HTTPS listener address %s has no port", httpsListener.Addr()),
			httpListener.Close(),
			httpsListener.Close(),
		)
	}
	frontend.httpsPort = httpsAddress.Port()
	secured := frontend.tls.Clone()
	secured.MinVersion = tls.VersionTLS12
	secured.NextProtos = []string{http2Protocol, http1Protocol}
	httpListener = newAdmissionListener(httpListener, frontend.admission)
	httpsListener = tls.NewListener(newAdmissionListener(httpsListener, frontend.admission), secured)

	handler := http.HandlerFunc(frontend.serveHTTP)
	httpService := newIngressService(ctx, handler, nil, frontend.connContext)
	httpsService := newIngressService(ctx, handler, secured, frontend.connContext)
	serveErrors := make(chan error, listenerCount)
	go func() { serveErrors <- httpService.Serve(httpListener) }()
	go func() { serveErrors <- httpsService.Serve(httpsListener) }()
	frontend.logger.Info(
		"edge HTTP ingress started",
		"http_address", httpListener.Addr(),
		"https_address", httpsListener.Addr(),
	)

	var serveErr error
	received := 0
	select {
	case <-ctx.Done():
	case serveErr = <-serveErrors:
		received = 1
	}
	shutdownContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), httpShutdownTimeout)
	defer cancel()
	shutdownErr := errors.Join(
		httpService.Shutdown(shutdownContext),
		httpsService.Shutdown(shutdownContext),
	)
	for ; received < listenerCount; received++ {
		if err := <-serveErrors; !errors.Is(err, http.ErrServerClosed) {
			serveErr = errors.Join(serveErr, err)
		}
	}
	if ctx.Err() != nil && (serveErr == nil || errors.Is(serveErr, http.ErrServerClosed)) {
		return shutdownErr
	}
	return errors.Join(serveErr, shutdownErr)
}

func newIngressService(
	ctx context.Context,
	handler http.Handler,
	tlsConfig *tls.Config,
	connContext ConnContext,
) *http.Server {
	return &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: httpReadHeaderTimeout,
		IdleTimeout:       httpIdleTimeout,
		MaxHeaderBytes:    httpMaxHeaderBytes,
		BaseContext: func(net.Listener) context.Context {
			return ctx
		},
		ConnContext: connContext,
		TLSConfig:   tlsConfig,
	}
}
