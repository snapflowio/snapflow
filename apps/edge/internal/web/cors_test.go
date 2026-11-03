// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package web_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
	"github.com/snapflowio/edge/internal/web/webtest"
)

func dashboardPolicy() routes.HTTPPolicy {
	return routes.HTTPPolicy{
		Visibility:       routes.HTTPVisibilityProtected,
		AllowedOrigins:   []string{webtest.DashboardOrigin},
		AllowCredentials: true,
	}
}

func TestCORSPreflightAllowsOnlyTrustedOrigins(t *testing.T) {
	t.Parallel()
	policy := dashboardPolicy()
	tests := []struct {
		name       string
		origin     string
		method     string
		wantStatus int
		wantOrigin string
	}{
		{
			name:       "trusted origin",
			origin:     webtest.DashboardOrigin,
			method:     http.MethodPost,
			wantStatus: http.StatusNoContent,
			wantOrigin: webtest.DashboardOrigin,
		},
		{
			name:       "untrusted origin",
			origin:     webtest.UntrustedOrigin,
			method:     http.MethodPost,
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "unsupported method",
			origin:     webtest.DashboardOrigin,
			method:     http.MethodConnect,
			wantStatus: http.StatusForbidden,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			request := httptest.NewRequestWithContext(t.Context(), http.MethodOptions, "https://app.example.test/files", nil)
			request.Header.Set(web.Origin, test.origin)
			request.Header.Set(web.AccessControlRequestMethod, test.method)
			request.Header.Set(web.AccessControlRequestHeaders, "content-type, x-request-id")
			recorder := httptest.NewRecorder()
			if !web.HandleCORSPreflight(recorder, request, policy) {
				t.Fatal("a preflight request was not handled")
			}
			response := recorder.Result()
			if response.StatusCode != test.wantStatus {
				t.Fatalf("status = %d, want %d", response.StatusCode, test.wantStatus)
			}
			if test.wantOrigin == "" {
				if got := response.Header.Get(web.AccessControlAllowOrigin); got != "" {
					t.Fatalf("%s = %q on a rejected preflight", web.AccessControlAllowOrigin, got)
				}
				return
			}
			webtest.AssertResponse(t, response.Header, test.wantOrigin)
			if got := response.Header.Get(web.AccessControlAllowHeaders); got != "Content-Type, X-Request-Id" {
				t.Fatalf("%s = %q", web.AccessControlAllowHeaders, got)
			}
			if !strings.Contains(response.Header.Get(web.AccessControlAllowMethods), test.method) {
				t.Fatalf("%s = %q", web.AccessControlAllowMethods, response.Header.Get(web.AccessControlAllowMethods))
			}
		})
	}
}

func TestUpstreamCORSHeadersAreReplacedByThePolicy(t *testing.T) {
	t.Parallel()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "https://app.example.test/files", nil)
	request.Header.Set(web.Origin, webtest.DashboardOrigin)
	response := &http.Response{Header: http.Header{}}
	response.Header.Set(web.AccessControlAllowOrigin, "*")
	response.Header.Set(web.AccessControlAllowMethods, http.MethodGet)
	if err := web.ApplyCORSResponse(response, request, dashboardPolicy()); err != nil {
		t.Fatalf("apply CORS response: %v", err)
	}
	webtest.AssertResponse(t, response.Header, webtest.DashboardOrigin)
	if got := response.Header.Get(web.AccessControlAllowMethods); got != "" {
		t.Fatalf("upstream %s = %q leaked through", web.AccessControlAllowMethods, got)
	}
}
