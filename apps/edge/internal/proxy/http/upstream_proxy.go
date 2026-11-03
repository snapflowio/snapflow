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
	"net/http"
	"net/http/httputil"
	"time"

	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/web"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	bufferedFlushInterval  = 100 * time.Millisecond
	immediateFlushInterval = -1
)

func (frontend *Frontend) proxy(
	writer http.ResponseWriter,
	request *http.Request,
	selection routeSelection,
	metadata requestMetadata,
) {
	route := selection.route
	tokenProtocol := access.TokenProtocol(request)
	access.StripCredentials(request)
	request.Body = http.MaxBytesReader(writer, request.Body, route.Policy.MaxBodyBytes)
	tunnelTransport := &tunnelTransport{
		route:              route,
		routes:             compatibleHTTPRoutes(selection.matches, route),
		requiredBackend:    selection.requiredBackend,
		hasRequiredBackend: selection.hasRequiredBackend,
		source:             metadata.source,
		streams:            frontend.streams,
		meter:              frontend.meter,
		counter:            frontend.meter.OpenCounter(route.BackendID),
	}
	defer tunnelTransport.finish()
	responseCounter := &countingResponseWriter{
		ResponseWriter: writer,
		counter:        tunnelTransport.servedCounter,
	}
	reverseProxy := &httputil.ReverseProxy{
		Rewrite: func(proxyRequest *httputil.ProxyRequest) {
			rewriteUpstreamRequest(proxyRequest.Out, proxyRequest.In, route, metadata)
		},
		Transport: tunnelTransport,
		ModifyResponse: func(response *http.Response) error {
			if err := web.ApplyCORSResponse(response, request, route.Policy); err != nil {
				return err
			}
			confineGuestCookies(response.Header)
			selectTokenProtocol(response, tokenProtocol)
			return nil
		},
		BufferPool:    frontend.buffers,
		FlushInterval: flushInterval(route.Policy.Streaming),
		ErrorHandler: func(
			meteredWriter http.ResponseWriter,
			failedRequest *http.Request,
			proxyErr error,
		) {
			if errors.Is(proxyErr, context.Canceled) || responseCounter.committed {
				return
			}
			frontend.logger.Debug(
				"edge HTTP upstream unavailable",
				"backend_id", tunnelTransport.SelectedRoute().BackendID,
				"path", failedRequest.URL.Path,
				"error", proxyErr,
			)
			writeTunnelOpenError(writer, proxyErr)
		},
	}
	reverseProxy.ServeHTTP(responseCounter, request)
}

func flushInterval(streaming bool) time.Duration {
	if streaming {
		return immediateFlushInterval
	}
	return bufferedFlushInterval
}

func writeTunnelOpenError(writer http.ResponseWriter, err error) {
	var rejected *transport.StreamOpenRejectedError
	if !errors.As(err, &rejected) {
		writeEdgeError(writer, edgeErrorUpstreamUnavailable)
		return
	}
	switch rejected.Status {
	case protocol.StreamOpenStatusTargetCapacity:
		writeEdgeError(writer, edgeErrorTargetCapacity)
	case protocol.StreamOpenStatusTargetUnavailable,
		protocol.StreamOpenStatusMachineDraining:
		writeEdgeError(writer, edgeErrorTargetUnavailable)
	case protocol.StreamOpenStatusBindingMismatch,
		protocol.StreamOpenStatusBackendNotFound:
		writeEdgeError(writer, edgeErrorNoReadyBackend)
	default:
		writeEdgeError(writer, edgeErrorUpstreamUnavailable)
	}
}
