// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
)

const (
	edgeHealthPath     = "/.well-known/snapflow-edge/health"
	speedtestPath      = "/_snapflow/speedtest"
	pathSeparator      = "/"
	windowsPathSegment = "\\"
	currentDirectory   = "."
	parentDirectory    = ".."
)

type routeSelection struct {
	matches            []routes.HTTP
	route              routes.HTTP
	requiredBackend    uuid.UUID
	hasRequiredBackend bool
}

func (frontend *Frontend) serveHTTP(writer http.ResponseWriter, request *http.Request) {
	if !routes.IsValidHostname(request.Host) || !isSafeIncomingPath(request.URL.Path) {
		http.Error(writer, "invalid request target", http.StatusBadRequest)
		return
	}
	if isSpeedtest(request) {
		frontend.speedtest.ServeHTTP(writer, request)
		return
	}
	if isEdgeHealthCheck(request) {
		frontend.serveEdgeHealth(writer)
		return
	}
	snapshot := frontend.routes.Load()
	selection, found := frontend.selectRoute(writer, request, snapshot)
	if !found {
		return
	}
	metadata, proceed := frontend.applyRequestPolicy(writer, request, snapshot, selection.route)
	if !proceed {
		return
	}
	permit, result := frontend.admission.AdmitHTTP(
		metadata.source.Addr(),
		admit.RouteScope(selection.route.Base),
		selection.route.Policy.Streaming || web.IsWebSocketUpgrade(request),
	)
	if result != admit.ResultAllowed {
		writeAdmissionError(writer, result)
		return
	}
	defer permit.Release()
	authorized, release, allowed := frontend.authorize(writer, request, selection.route)
	if !allowed {
		return
	}
	defer release()
	if frontend.handleBrowserWarning(writer, authorized, selection.route) {
		return
	}
	frontend.proxy(writer, authorized, selection, metadata)
}

func isEdgeHealthCheck(request *http.Request) bool {
	return request.URL.Path == edgeHealthPath &&
		(request.Method == http.MethodGet || request.Method == http.MethodHead)
}

func (frontend *Frontend) serveEdgeHealth(writer http.ResponseWriter) {
	writer.Header().Set(web.CacheControl, web.NoStore)
	if frontend.admission.IsDraining() {
		writeEdgeError(writer, edgeErrorDraining)
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}

func (frontend *Frontend) selectRoute(
	writer http.ResponseWriter,
	request *http.Request,
	snapshot *routes.Snapshot,
) (routeSelection, bool) {
	matches := snapshot.HTTPRoutes(request.Host, request.URL.Path, time.Now())
	if len(matches) == 0 {
		writeEdgeError(writer, edgeErrorRouteNotFound)
		return routeSelection{}, false
	}
	requiredBackend, hasRequiredBackend := access.RequiredBackend(request, matches)
	if hasRequiredBackend && !containsHTTPBackend(matches, requiredBackend) {
		writeEdgeError(writer, edgeErrorProtectedAccessRequired)
		return routeSelection{}, false
	}
	route, found := selectHTTPBackend(matches, requiredBackend, hasRequiredBackend, nil, frontend.streams)
	if !found {
		frontend.failures.noReadyBackend.Add(1)
		if matches[0].Policy.Visibility == routes.HTTPVisibilityProtected {
			frontend.writeProtectedRetryPage(writer)
		} else {
			writeEdgeError(writer, edgeErrorNoReadyBackend)
		}
		return routeSelection{}, false
	}
	return routeSelection{
		matches:            matches,
		route:              route,
		requiredBackend:    requiredBackend,
		hasRequiredBackend: hasRequiredBackend,
	}, true
}

func (frontend *Frontend) applyRequestPolicy(
	writer http.ResponseWriter,
	request *http.Request,
	snapshot *routes.Snapshot,
	route routes.HTTP,
) (requestMetadata, bool) {
	metadata, err := resolveRequestMetadata(request, snapshot)
	if err != nil {
		http.Error(writer, "invalid request metadata", http.StatusBadRequest)
		return requestMetadata{}, false
	}
	request.Header.Set(requestIDHeader, normalizedRequestID(request.Header.Get(requestIDHeader)))
	if route.Policy.RequireTrustedProxy && !metadata.isAuthenticatedOrigin() {
		http.Error(writer, "trusted origin required", http.StatusForbidden)
		return requestMetadata{}, false
	}
	if route.Policy.ForceHTTPS && metadata.scheme != web.SchemeHTTPS {
		http.Redirect(writer, request, httpsRedirectURL(request, frontend.httpsPort), http.StatusPermanentRedirect)
		return requestMetadata{}, false
	}
	if web.HandleCORSPreflight(writer, request, route.Policy) {
		return requestMetadata{}, false
	}
	return metadata, true
}

func (frontend *Frontend) authorize(
	writer http.ResponseWriter,
	request *http.Request,
	route routes.HTTP,
) (*http.Request, func(), bool) {
	decision := frontend.access.Authorize(writer, request, route)
	if decision.Responded {
		return nil, nil, false
	}
	if !decision.Authorized {
		frontend.logger.Debug(
			"protected access denied",
			"reason", decision.DenialReason,
			"backend_id", route.BackendID,
		)
		denyProtectedAccess(writer, request, route.Policy)
		return nil, nil, false
	}
	if decision.SessionID == uuid.Nil {
		return request, func() {}, true
	}
	ctx, cancel := context.WithCancel(request.Context())
	requestID, allowed := frontend.access.Sessions().Begin(decision.SessionID, decision.AbsoluteExpiresAt, cancel)
	if !allowed {
		cancel()
		access.ExpireCookie(writer, route.BackendID)
		denyProtectedAccess(writer, request, route.Policy)
		return nil, nil, false
	}
	return request.WithContext(ctx), func() {
		frontend.access.Sessions().End(decision.SessionID, requestID)
		cancel()
	}, true
}

func denyProtectedAccess(writer http.ResponseWriter, request *http.Request, policy routes.HTTPPolicy) {
	web.ApplyCORSHeaders(writer.Header(), request, policy)
	writeEdgeError(writer, edgeErrorProtectedAccessRequired)
}

func isSafeIncomingPath(value string) bool {
	if !strings.HasPrefix(value, pathSeparator) || strings.Contains(value, windowsPathSegment) {
		return false
	}
	for segment := range strings.SplitSeq(value, pathSeparator) {
		if segment == currentDirectory || segment == parentDirectory {
			return false
		}
	}
	return true
}

func isSpeedtest(request *http.Request) bool {
	return strings.HasPrefix(request.URL.Path, speedtestPath+pathSeparator)
}
