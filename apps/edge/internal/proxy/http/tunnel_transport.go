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
	"net"
	"net/http"
	"net/netip"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/traffic"
	"github.com/snapflowio/edge/internal/web"
	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	maximumUpstreamHeaderBytes = 64 << 10
	h2cReadIdleTimeout         = 30 * time.Second
	h2cPingTimeout             = 10 * time.Second
	singleAttempt              = 1
)

type tunnelTransport struct {
	route              routes.HTTP
	routes             []routes.HTTP
	requiredBackend    uuid.UUID
	hasRequiredBackend bool
	source             netip.AddrPort
	streams            backendStreams
	meter              proxy.Meter
	counter            *traffic.Counter
}

func (roundTripper *tunnelTransport) RoundTrip(
	request *http.Request,
) (*http.Response, error) {
	attempts := roundTripper.attempts(request)
	excluded := make(map[uuid.UUID]struct{}, attempts)
	candidate := request
	var resultErr error
	for attempt := range attempts {
		if attempt > 0 {
			retry, found, err := roundTripper.retryOnFreshBackend(request, excluded)
			if err != nil {
				return nil, errors.Join(resultErr, err)
			}
			if !found {
				break
			}
			candidate = retry
		}
		response, err := roundTripper.roundTripOnce(candidate)
		if err == nil {
			return response, nil
		}
		excluded[roundTripper.route.BackendID] = struct{}{}
		resultErr = errors.Join(resultErr, err)
	}
	return nil, resultErr
}

func (roundTripper *tunnelTransport) attempts(request *http.Request) int {
	if roundTripper.route.Policy.Streaming ||
		web.IsWebSocketUpgrade(request) ||
		!retryableRequest(request) {
		return singleAttempt
	}
	return roundTripper.route.Policy.Retries + singleAttempt
}

func (roundTripper *tunnelTransport) retryOnFreshBackend(
	request *http.Request,
	excluded map[uuid.UUID]struct{},
) (*http.Request, bool, error) {
	next, found := selectHTTPBackend(
		roundTripper.routes,
		roundTripper.requiredBackend,
		roundTripper.hasRequiredBackend,
		excluded,
		roundTripper.streams,
	)
	if !found {
		return nil, false, nil
	}
	roundTripper.route = next
	roundTripper.counter.Close()
	roundTripper.counter = roundTripper.meter.OpenCounter(next.BackendID)
	retry := request.Clone(request.Context())
	if request.Body != nil && request.GetBody != nil {
		body, err := request.GetBody()
		if err != nil {
			return nil, false, err
		}
		retry.Body = body
	}
	return retry, true, nil
}

func (roundTripper *tunnelTransport) SelectedRoute() routes.HTTP {
	return roundTripper.route
}

func (roundTripper *tunnelTransport) servedCounter() *traffic.Counter {
	return roundTripper.counter
}

func (roundTripper *tunnelTransport) finish() {
	roundTripper.counter.AddConnection()
	roundTripper.counter.Close()
}

func (roundTripper *tunnelTransport) meteredRequest(request *http.Request) *http.Request {
	if request.Body == nil || request.Body == http.NoBody {
		return request
	}
	metered := *request
	metered.Body = &countingReadCloser{ReadCloser: request.Body, counter: roundTripper.counter}
	return &metered
}

func (roundTripper *tunnelTransport) roundTripOnce(
	request *http.Request,
) (*http.Response, error) {
	request = withInformationalHeaderFilter(roundTripper.meteredRequest(request))
	if roundTripper.route.Policy.UpstreamProtocol == routes.HTTPUpstreamH2C {
		return roundTripper.roundTripH2C(request)
	}
	return (&http.Transport{
		DialContext:            roundTripper.dial,
		DisableKeepAlives:      true,
		MaxResponseHeaderBytes: maximumUpstreamHeaderBytes,
		ResponseHeaderTimeout:  roundTripper.route.Policy.ReadTimeout,
	}).RoundTrip(request)
}

func (roundTripper *tunnelTransport) roundTripH2C(
	request *http.Request,
) (*http.Response, error) {
	var protocols http.Protocols
	protocols.SetUnencryptedHTTP2(true)
	upstream := &http.Transport{
		Protocols: &protocols,
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			connection, err := roundTripper.dial(ctx, network, address)
			if err != nil {
				return nil, fmt.Errorf("dial cleartext HTTP/2 upstream %s: %w", address, err)
			}
			return connection, nil
		},
		MaxResponseHeaderBytes: maximumUpstreamHeaderBytes,
		HTTP2: &http.HTTP2Config{
			SendPingTimeout:  h2cReadIdleTimeout,
			PingTimeout:      h2cPingTimeout,
			WriteByteTimeout: roundTripper.route.Policy.SendTimeout,
		},
	}
	response, err := roundTripWithHeaderTimeout(
		upstream,
		request,
		roundTripper.route.Policy.ReadTimeout,
	)
	if err != nil {
		upstream.CloseIdleConnections()
		return nil, err
	}
	if response.Body == nil {
		upstream.CloseIdleConnections()
		return response, nil
	}
	response.Body = &callbackOnCloseBody{
		ReadCloser: response.Body,
		callback:   upstream.CloseIdleConnections,
	}
	return response, nil
}

func (roundTripper *tunnelTransport) dial(
	ctx context.Context,
	network string,
	address string,
) (net.Conn, error) {
	if network == "" || address == "" {
		return nil, errors.New("HTTP transport supplied an empty network target")
	}
	stream, err := roundTripper.streams.OpenStream(
		ctx,
		roundTripper.route.Base,
		protocol.ProtocolHTTP,
		roundTripper.source,
	)
	if err != nil {
		return nil, err
	}
	connection := &tunnelStreamConnection{Stream: stream}
	if roundTripper.route.Policy.SendTimeout > 0 {
		return &writeTimeoutConnection{
			Conn:    connection,
			timeout: roundTripper.route.Policy.SendTimeout,
		}, nil
	}
	return connection, nil
}

func retryableRequest(request *http.Request) bool {
	if request == nil ||
		(request.Body != nil && request.GetBody == nil) {
		return false
	}
	switch request.Method {
	case http.MethodGet,
		http.MethodHead,
		http.MethodOptions,
		http.MethodTrace,
		http.MethodPut,
		http.MethodDelete:
		return true
	default:
		return false
	}
}
