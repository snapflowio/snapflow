// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/access/accesstest"
	"github.com/snapflowio/edge/internal/web"
	"github.com/snapflowio/edge/internal/web/webtest"
)

func TestProtectedAccessDenialCarriesCORSForTrustedOrigins(t *testing.T) {
	t.Parallel()
	route := accesstest.DashboardRoute()
	tests := []struct {
		name       string
		origin     string
		wantOrigin string
	}{
		{name: "trusted origin", origin: webtest.DashboardOrigin, wantOrigin: webtest.DashboardOrigin},
		{name: "untrusted origin", origin: webtest.UntrustedOrigin},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			sessions := access.NewSessions()
			frontend := &Frontend{
				access: accesstest.NewGate(t, route, uuid.New(), sessions),
				logger: slog.New(slog.DiscardHandler),
			}
			request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "https://app.example.test/files", nil)
			request.Header.Set(web.Origin, test.origin)
			recorder := httptest.NewRecorder()
			if _, _, allowed := frontend.authorize(recorder, request, route); allowed {
				t.Fatal("a request without a session cookie was authorized")
			}
			response := recorder.Result()
			if response.StatusCode != http.StatusUnauthorized ||
				response.Header.Get(edgeErrorHeader) != edgeErrorProtectedAccessRequired.descriptor().code {
				t.Fatalf("denial = %d %q", response.StatusCode, response.Header.Get(edgeErrorHeader))
			}
			webtest.AssertResponse(t, response.Header, test.wantOrigin)
		})
	}
}
