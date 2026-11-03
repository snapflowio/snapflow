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
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/netip"
	"sync/atomic"

	commonhttpproxy "github.com/snapflowio/common-go/pkg/httpproxy"
	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/edge/internal/routes"
)

type backendStreams interface {
	proxy.Streams
	BackendLoad(route routes.Base) (int64, bool)
}

type admitter interface {
	AdmitHTTP(source netip.Addr, scope admit.Scope, streaming bool) (*admit.Permit, admit.Result)
	AdmitHTTPConnection(source netip.Addr) (*admit.Permit, admit.Result)
	IsDraining() bool
}

type Config struct {
	HTTPAddress  string
	HTTPSAddress string
}

// ConnContext annotates the context of each accepted ingress connection.
type ConnContext func(ctx context.Context, connection net.Conn) context.Context

type Dependencies struct {
	TLS       *tls.Config
	Routes    proxy.Routes
	Streams   backendStreams
	Meter     proxy.Meter
	Access    *access.Gate
	Admission admitter
	Speedtest http.Handler
	// SpeedtestConnContext exposes each connection to the speedtest, which
	// reads TCP statistics from it.
	SpeedtestConnContext ConnContext
}

type Frontend struct {
	config      Config
	tls         *tls.Config
	logger      *slog.Logger
	routes      proxy.Routes
	streams     backendStreams
	meter       proxy.Meter
	access      *access.Gate
	admission   admitter
	speedtest   http.Handler
	connContext ConnContext
	failures    failureMetrics
	httpsPort   uint16
	buffers     httputil.BufferPool
}

type FailureCounters struct {
	NoReadyBackend uint64
}

type failureMetrics struct {
	noReadyBackend atomic.Uint64
}

func New(config Config, dependencies Dependencies, opts ...Option) (*Frontend, error) {
	if config.HTTPAddress == "" || config.HTTPSAddress == "" || dependencies.TLS == nil ||
		(len(dependencies.TLS.Certificates) == 0 && dependencies.TLS.GetCertificate == nil) {
		return nil, errors.New("HTTP ingress requires HTTP and HTTPS listeners and a TLS certificate")
	}
	if dependencies.Routes == nil || dependencies.Streams == nil || dependencies.Meter == nil ||
		dependencies.Access == nil || dependencies.Admission == nil || dependencies.Speedtest == nil ||
		dependencies.SpeedtestConnContext == nil {
		return nil, errors.New(
			"HTTP ingress requires routes, a tunnel, usage metering, protected access, admission, and the speedtest",
		)
	}
	return &Frontend{
		config:      config,
		tls:         dependencies.TLS,
		logger:      newOptions(opts).logger,
		routes:      dependencies.Routes,
		streams:     dependencies.Streams,
		meter:       dependencies.Meter,
		access:      dependencies.Access,
		admission:   dependencies.Admission,
		speedtest:   http.StripPrefix(speedtestPath, dependencies.Speedtest),
		connContext: dependencies.SpeedtestConnContext,
		buffers:     commonhttpproxy.NewResponseBufferPool(),
	}, nil
}

func (frontend *Frontend) FailureCounters() FailureCounters {
	return FailureCounters{
		NoReadyBackend: frontend.failures.noReadyBackend.Load(),
	}
}
