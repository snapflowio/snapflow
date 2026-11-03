// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
)

const (
	requestIDHeader         = "X-Request-ID"
	platformRequestIDHeader = "X-Snapflow-Request-ID"
	platformHeaderPrefix    = "X-Snapflow-"
)

func untrustedForwardingHeaders() []string {
	return []string{
		web.Forwarded,
		web.ForwardedFor,
		web.ForwardedHost,
		web.ForwardedProto,
		web.RealIP,
		web.CloudflareClientIP,
		web.CloudflareClientIPv6,
		web.TrueClientIP,
	}
}

func rewriteUpstreamRequest(
	out *http.Request,
	in *http.Request,
	route routes.HTTP,
	metadata requestMetadata,
) {
	originalHost := in.Host
	out.URL.Scheme = web.SchemeHTTP
	out.URL.Host = route.PublicHost
	// ReverseProxy re-encodes queries that contain semicolons before Rewrite,
	// which sorts keys and drops pairs. The edge makes no decision from the
	// query (the gate already removed its grant parameters), so the guest gets
	// the query exactly as the client sent it.
	out.URL.RawQuery = in.URL.RawQuery
	out.Host = originalHost
	for header := range out.Header {
		if strings.HasPrefix(http.CanonicalHeaderKey(header), platformHeaderPrefix) {
			out.Header.Del(header)
		}
	}
	for _, header := range untrustedForwardingHeaders() {
		out.Header.Del(header)
	}
	requestID := normalizedRequestID(in.Header.Get(requestIDHeader))
	out.Header.Set(requestIDHeader, requestID)
	out.Header.Set(platformRequestIDHeader, requestID)
	clientIP := metadata.source.Addr().String()
	if metadata.source.Addr().IsValid() {
		out.Header.Set(
			web.Forwarded,
			fmt.Sprintf(
				"for=%s;proto=%s;host=%q",
				forwardedFor(clientIP),
				metadata.scheme,
				originalHost,
			),
		)
		out.Header.Set(web.ForwardedFor, clientIP)
		out.Header.Set(web.RealIP, clientIP)
	}
	out.Header.Set(web.ForwardedHost, originalHost)
	out.Header.Set(web.ForwardedProto, metadata.scheme)
	if route.Policy.StripPath {
		out.URL.Path = stripPath(route.Policy.Path, out.URL.Path)
		out.URL.RawPath = ""
	}
}

func normalizedRequestID(value string) string {
	parsed, err := uuid.Parse(strings.TrimSpace(value))
	if err == nil {
		return parsed.String()
	}
	return uuid.NewString()
}

func forwardedFor(value string) string {
	if strings.Contains(value, ":") {
		return "[" + value + "]"
	}
	return value
}

func stripPath(prefix, path string) string {
	result := strings.TrimPrefix(path, prefix)
	if result == "" {
		return "/"
	}
	if !strings.HasPrefix(result, "/") {
		return "/" + result
	}
	return result
}
