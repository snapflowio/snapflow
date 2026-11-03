// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/access/accesstest"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
	"github.com/snapflowio/edge/internal/web/webtest"
)

const webSocketUpgrade = "websocket"

func redeemToken(t *testing.T, gate *access.Gate, route routes.HTTP) string {
	t.Helper()
	request := grantTestRequest(t, route, "")
	request.Header.Set(access.AccessModeHeader, access.AccessModeToken)
	recorder := httptest.NewRecorder()
	if decision := gate.Authorize(recorder, request, route); !decision.Responded {
		t.Fatalf("decision = %+v, want the token response", decision)
	}
	response := recorder.Result()
	if response.StatusCode != http.StatusOK ||
		response.Header.Get(web.ContentType) != web.JSONMediaType ||
		response.Header.Get(web.CacheControl) != web.NoStore {
		t.Fatalf("token response = %d %v", response.StatusCode, response.Header)
	}
	if cookies := response.Cookies(); len(cookies) != 0 {
		t.Fatalf("token mode set cookies %v", cookies)
	}
	var redemption access.TokenRedemption
	if err := json.NewDecoder(response.Body).Decode(&redemption); err != nil {
		t.Fatalf("decode token response: %v", err)
	}
	if redemption.Token == "" || redemption.ExpiresAt.IsZero() {
		t.Fatalf("token response = %+v, want a token and expiry", redemption)
	}
	return redemption.Token
}

func headerRequest(t *testing.T, token string) *http.Request {
	t.Helper()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "https://app.example.test/files", nil)
	request.Header.Set(access.AccessTokenHeader, token)
	return request
}

func TestTokenModeRedemptionAuthenticatesHeaderRequests(t *testing.T) {
	t.Parallel()
	route := accesstest.ProtectedRoute()
	sessionID := uuid.New()
	gate := accesstest.NewGate(t, route, sessionID, access.NewSessions())
	token := redeemToken(t, gate, route)
	decision := gate.Authorize(httptest.NewRecorder(), headerRequest(t, token), route)
	if !decision.Authorized || decision.SessionID != sessionID {
		t.Fatalf("decision = %+v, want the header token accepted", decision)
	}
}

func TestHeaderTokenWebSocketSkipsTheBrowserOriginRule(t *testing.T) {
	t.Parallel()
	route := accesstest.ProtectedRoute()
	gate := accesstest.NewGate(t, route, uuid.New(), access.NewSessions())
	request := headerRequest(t, redeemToken(t, gate, route))
	request.Header.Set(web.Connection, web.Upgrade)
	request.Header.Set(web.Upgrade, webSocketUpgrade)
	request.Header.Set(web.Origin, webtest.UntrustedOrigin)
	if decision := gate.Authorize(httptest.NewRecorder(), request, route); !decision.Authorized {
		t.Fatalf("decision = %+v, want a header-authenticated WebSocket accepted", decision)
	}
}

func TestCookieWebSocketStillRequiresSameOrigin(t *testing.T) {
	t.Parallel()
	route := accesstest.ProtectedRoute()
	gate := accesstest.NewGate(t, route, uuid.New(), access.NewSessions())
	recorder := httptest.NewRecorder()
	gate.Authorize(recorder, grantTestRequest(t, route, ""), route)
	cookie := requirePartitionedSessionCookie(t, recorder.Result())
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "https://app.example.test/ws", nil)
	request.AddCookie(cookie)
	request.Header.Set(web.Connection, web.Upgrade)
	request.Header.Set(web.Upgrade, webSocketUpgrade)
	request.Header.Set(web.Origin, webtest.UntrustedOrigin)
	decision := gate.Authorize(httptest.NewRecorder(), request, route)
	if decision.Authorized || decision.DenialReason != access.DenialReasonWebSocketOrigin {
		t.Fatalf("decision = %+v, want the cross-origin cookie WebSocket denied", decision)
	}
}

func TestInvalidHeaderTokenIsDenied(t *testing.T) {
	t.Parallel()
	route := accesstest.ProtectedRoute()
	gate := accesstest.NewGate(t, route, uuid.New(), access.NewSessions())
	decision := gate.Authorize(httptest.NewRecorder(), headerRequest(t, "forged"), route)
	if decision.Authorized || decision.DenialReason != access.DenialReasonSessionInvalid {
		t.Fatalf("decision = %+v, want the forged token denied", decision)
	}
}

const (
	sandboxHostURL       = "https://toolbox-sandbox-test.snapflow.test/files"
	siblingPortOrigin    = "https://3000-sandbox-test.snapflow.test"
	otherSandboxOrigin   = "https://3000-sandbox-other.snapflow.test"
	webSocketProtocolKey = "Sec-WebSocket-Protocol"
)

func sessionCookieFor(t *testing.T, gate *access.Gate, route routes.HTTP) *http.Cookie {
	t.Helper()
	recorder := httptest.NewRecorder()
	gate.Authorize(recorder, grantTestRequest(t, route, ""), route)
	return requirePartitionedSessionCookie(t, recorder.Result())
}

func cookiePost(t *testing.T, cookie *http.Cookie, origin string) *http.Request {
	t.Helper()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, sandboxHostURL, nil)
	request.AddCookie(cookie)
	if origin != "" {
		request.Header.Set(web.Origin, origin)
		request.Header.Set(web.FetchSite, "cross-site")
	}
	return request
}

func TestCookieWritesRequireATrustedOrigin(t *testing.T) {
	t.Parallel()
	route := accesstest.DashboardRoute()
	gate := accesstest.NewGate(t, route, uuid.New(), access.NewSessions())
	cookie := sessionCookieFor(t, gate, route)
	tests := []struct {
		name       string
		origin     string
		authorized bool
	}{
		{name: "dashboard origin", origin: webtest.DashboardOrigin, authorized: true},
		{name: "same sandbox on another port", origin: siblingPortOrigin, authorized: true},
		{name: "another sandbox", origin: otherSandboxOrigin, authorized: false},
		{name: "another site", origin: webtest.UntrustedOrigin, authorized: false},
		{name: "opaque origin", origin: "null", authorized: false},
		{name: "non-browser client", origin: "", authorized: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			decision := gate.Authorize(httptest.NewRecorder(), cookiePost(t, cookie, test.origin), route)
			if decision.Authorized != test.authorized {
				t.Fatalf("decision = %+v, want authorized %t", decision, test.authorized)
			}
		})
	}
}

func TestHeaderTokenWritesSkipTheOriginRule(t *testing.T) {
	t.Parallel()
	route := accesstest.ProtectedRoute()
	gate := accesstest.NewGate(t, route, uuid.New(), access.NewSessions())
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, sandboxHostURL, nil)
	request.Header.Set(access.AccessTokenHeader, redeemToken(t, gate, route))
	request.Header.Set(web.Origin, webtest.UntrustedOrigin)
	if decision := gate.Authorize(httptest.NewRecorder(), request, route); !decision.Authorized {
		t.Fatalf("decision = %+v, want the header token accepted", decision)
	}
}

func TestSubprotocolTokenAuthenticatesHeaderlessWebSockets(t *testing.T) {
	t.Parallel()
	route := accesstest.ProtectedRoute()
	gate := accesstest.NewGate(t, route, uuid.New(), access.NewSessions())
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "https://app.example.test/ws", nil)
	request.Header.Set(web.Connection, web.Upgrade)
	request.Header.Set(web.Upgrade, webSocketUpgrade)
	request.Header.Set(web.Origin, webtest.UntrustedOrigin)
	request.Header.Set(webSocketProtocolKey, "tty, "+access.AccessTokenProtocolPrefix+redeemToken(t, gate, route))
	if decision := gate.Authorize(httptest.NewRecorder(), request, route); !decision.Authorized {
		t.Fatalf("decision = %+v, want the subprotocol token accepted", decision)
	}
	access.StripCredentials(request)
	if got := request.Header.Get(webSocketProtocolKey); got != "tty" {
		t.Fatalf("%s reaching the guest = %q, want only the guest protocol", webSocketProtocolKey, got)
	}
}

func TestAPlantedSameNameCookieCannotShadowTheSession(t *testing.T) {
	t.Parallel()
	route := accesstest.ProtectedRoute()
	gate := accesstest.NewGate(t, route, uuid.New(), access.NewSessions())
	cookie := sessionCookieFor(t, gate, route)
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "https://app.example.test/files", nil)
	request.AddCookie(&http.Cookie{Name: cookie.Name, Value: "planted"})
	request.AddCookie(cookie)
	if decision := gate.Authorize(httptest.NewRecorder(), request, route); !decision.Authorized {
		t.Fatalf("decision = %+v, want the real session found behind the planted cookie", decision)
	}
}

func TestHeaderTokenPinsItsBackend(t *testing.T) {
	t.Parallel()
	route := accesstest.ProtectedRoute()
	gate := accesstest.NewGate(t, route, uuid.New(), access.NewSessions())
	request := headerRequest(t, redeemToken(t, gate, route))
	other := accesstest.ProtectedRoute()
	other.BackendID = uuid.New()
	backendID, pinned := access.RequiredBackend(request, []routes.HTTP{other, route})
	if !pinned || backendID != route.BackendID {
		t.Fatalf("required backend = %s %t, want %s", backendID, pinned, route.BackendID)
	}
}

func TestMalformedGrantIsRefusedBeforeRedemption(t *testing.T) {
	t.Parallel()
	route := accesstest.ProtectedRoute()
	gate := accesstest.NewGate(t, route, uuid.New(), access.NewSessions())
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "https://app.example.test/?"+access.GrantQueryParameter+"=short", nil)
	if decision := gate.Authorize(httptest.NewRecorder(), request, route); decision.DenialReason != access.DenialReasonGrantFormat {
		t.Fatalf("decision = %+v, want the malformed grant refused", decision)
	}
}
