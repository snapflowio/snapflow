// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"io"
	"net/http"
	"strconv"

	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/web"
)

const (
	edgeErrorHeader    = "X-Snapflow-Edge-Error"
	retryAfterHeader   = "Retry-After"
	refreshHeader      = "Refresh"
	htmlContentType    = "text/html; charset=utf-8"
	protectedRetryPage = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta http-equiv=\"refresh\" content=\"1\"><title>Connecting to sandbox</title></head><body><main><h1>Connecting to sandbox</h1><p>Secure access is not ready yet. This page will retry automatically.</p></main></body></html>"
	shortRetryAfter    = 1
	drainingRetryAfter = 5
)

type edgeError uint8

const (
	edgeErrorRouteNotFound edgeError = iota
	edgeErrorNoReadyBackend
	edgeErrorDraining
	edgeErrorRateLimited
	edgeErrorCapacityLimited
	edgeErrorProtectedAccessRequired
	edgeErrorUpstreamUnavailable
	edgeErrorTargetUnavailable
	edgeErrorTargetCapacity
)

type edgeErrorDescriptor struct {
	code       string
	message    string
	statusCode int
	retryAfter int
}

func (failure edgeError) descriptor() edgeErrorDescriptor {
	switch failure {
	case edgeErrorRouteNotFound:
		return edgeErrorDescriptor{code: "route_not_found", message: "route not found", statusCode: http.StatusNotFound}
	case edgeErrorNoReadyBackend:
		return edgeErrorDescriptor{code: "no_ready_backend", message: "no backend is ready", statusCode: http.StatusServiceUnavailable, retryAfter: shortRetryAfter}
	case edgeErrorDraining:
		return edgeErrorDescriptor{code: "edge_draining", message: "edge is draining", statusCode: http.StatusServiceUnavailable, retryAfter: drainingRetryAfter}
	case edgeErrorRateLimited:
		return edgeErrorDescriptor{code: "rate_limited", message: "rate limit exceeded", statusCode: http.StatusTooManyRequests, retryAfter: shortRetryAfter}
	case edgeErrorCapacityLimited:
		return edgeErrorDescriptor{code: "capacity_limited", message: "edge capacity reached", statusCode: http.StatusServiceUnavailable, retryAfter: shortRetryAfter}
	case edgeErrorProtectedAccessRequired:
		return edgeErrorDescriptor{code: "protected_access_required", message: "protected access is required", statusCode: http.StatusUnauthorized}
	case edgeErrorTargetUnavailable:
		return edgeErrorDescriptor{code: "target_unavailable", message: "sandbox target is temporarily unavailable", statusCode: http.StatusServiceUnavailable, retryAfter: shortRetryAfter}
	case edgeErrorTargetCapacity:
		return edgeErrorDescriptor{code: "target_capacity", message: "sandbox target reached capacity", statusCode: http.StatusServiceUnavailable, retryAfter: shortRetryAfter}
	default:
		return edgeErrorDescriptor{code: "upstream_unavailable", message: "upstream unavailable", statusCode: http.StatusBadGateway, retryAfter: shortRetryAfter}
	}
}

func writeEdgeError(writer http.ResponseWriter, failure edgeError) {
	descriptor := failure.descriptor()
	writer.Header().Set(edgeErrorHeader, descriptor.code)
	if descriptor.retryAfter > 0 {
		writer.Header().Set(retryAfterHeader, strconv.Itoa(descriptor.retryAfter))
	}
	http.Error(writer, descriptor.message, descriptor.statusCode)
}

func (frontend *Frontend) writeProtectedRetryPage(writer http.ResponseWriter) {
	descriptor := edgeErrorNoReadyBackend.descriptor()
	writer.Header().Set(edgeErrorHeader, descriptor.code)
	writer.Header().Set(retryAfterHeader, strconv.Itoa(descriptor.retryAfter))
	writer.Header().Set(refreshHeader, strconv.Itoa(descriptor.retryAfter))
	writer.Header().Set(web.ContentType, htmlContentType)
	writer.Header().Set(web.CacheControl, web.NoStore)
	writer.WriteHeader(descriptor.statusCode)
	if _, err := io.WriteString(writer, protectedRetryPage); err != nil {
		frontend.logger.Debug("could not write protected access retry page", "error", err)
	}
}

func writeAdmissionError(writer http.ResponseWriter, result admit.Result) {
	switch result {
	case admit.ResultRateLimited:
		writeEdgeError(writer, edgeErrorRateLimited)
	case admit.ResultDraining:
		writeEdgeError(writer, edgeErrorDraining)
	default:
		writeEdgeError(writer, edgeErrorCapacityLimited)
	}
}
