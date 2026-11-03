// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access_test

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/access/accesstest"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
	"github.com/snapflowio/edge/internal/web/webtest"
)

const testGrantBytes = 32

// wellFormedGrant has the shape of an API-issued grant: 32 bytes, unpadded base64url.
func wellFormedGrant() string {
	return base64.RawURLEncoding.EncodeToString(make([]byte, testGrantBytes))
}

func grantTestRequest(t *testing.T, route routes.HTTP, origin string) *http.Request {
	t.Helper()
	request := httptest.NewRequestWithContext(
		t.Context(),
		http.MethodGet,
		"https://app.example.test/page?keep=1&"+access.GrantQueryParameter+"="+wellFormedGrant()+"&"+
			access.BackendQueryParameter+"="+route.BackendID.String(),
		nil,
	)
	if origin != "" {
		request.Header.Set(web.Origin, origin)
	}
	return request
}

func TestGrantRedemptionSetsAPartitionedCrossSiteSessionCookie(t *testing.T) {
	t.Parallel()
	route := accesstest.ProtectedRoute()
	sessionID := uuid.New()
	sessions := access.NewSessions()
	gate := accesstest.NewGate(t, route, sessionID, sessions)
	recorder := httptest.NewRecorder()
	decision := gate.Authorize(recorder, grantTestRequest(t, route, ""), route)
	if !decision.Responded {
		t.Fatalf("decision = %+v, want a redirect to the clean URL", decision)
	}
	response := recorder.Result()
	if response.StatusCode != http.StatusSeeOther ||
		response.Header.Get("Location") != "/page?keep=1" {
		t.Fatalf("redirect = %d %q", response.StatusCode, response.Header.Get("Location"))
	}
	cookie := requirePartitionedSessionCookie(t, response)
	followUp := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "https://app.example.test/page?keep=1", nil)
	followUp.AddCookie(cookie)
	decision = gate.Authorize(httptest.NewRecorder(), followUp, route)
	if !decision.Authorized || decision.SessionID != sessionID {
		t.Fatalf("follow-up decision = %+v, want the session cookie accepted", decision)
	}
	if reported := sessions.Report(); len(reported) != 0 {
		t.Fatalf("an unused redeemed session was reported: %v", reported)
	}
}

func TestGrantRedirectAllowsCredentialedCORSOnlyForTrustedOrigins(t *testing.T) {
	t.Parallel()
	route := accesstest.DashboardRoute()
	tests := []struct {
		name   string
		origin string
		want   string
	}{
		{name: "trusted dashboard origin", origin: webtest.DashboardOrigin, want: webtest.DashboardOrigin},
		{name: "untrusted origin", origin: webtest.UntrustedOrigin, want: ""},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			gate := accesstest.NewGate(t, route, uuid.New(), access.NewSessions())
			recorder := httptest.NewRecorder()
			if decision := gate.Authorize(recorder, grantTestRequest(t, route, test.origin), route); !decision.Responded {
				t.Fatalf("decision = %+v, want a redirect", decision)
			}
			webtest.AssertResponse(t, recorder.Result().Header, test.want)
		})
	}
}

func requirePartitionedSessionCookie(t *testing.T, response *http.Response) *http.Cookie {
	t.Helper()
	cookies := response.Cookies()
	if len(cookies) != 1 {
		t.Fatalf("cookies = %v, want one session cookie", cookies)
	}
	cookie := cookies[0]
	if !strings.HasPrefix(cookie.Name, access.CookiePrefix) || cookie.Path != "/" ||
		cookie.Domain != "" || !cookie.Secure || !cookie.HttpOnly ||
		cookie.SameSite != http.SameSiteNoneMode || !cookie.Partitioned {
		t.Fatalf("session cookie = %+v, want __Host- Secure HttpOnly SameSite=None Partitioned", cookie)
	}
	if !strings.Contains(response.Header.Get("Set-Cookie"), "; SameSite=None; Partitioned") {
		t.Fatalf("Set-Cookie = %q, want SameSite=None and Partitioned", response.Header.Get("Set-Cookie"))
	}
	return cookie
}
