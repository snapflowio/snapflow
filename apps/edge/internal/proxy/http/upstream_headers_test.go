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
	"net/http/httptrace"
	"net/textproto"
	"slices"
	"sync"
	"testing"

	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
)

const (
	tossedCookie        = "theme=dark; Domain=snapflow.test; Path=/"
	confinedCookie      = "theme=dark; Path=/"
	guestAllowOrigin    = "*"
	crossSite           = "cross-site"
	fetchSiteSameOrigin = "same-origin"
)

func TestGuestHeadersAreFilteredOnInformationalAndFinalResponses(t *testing.T) {
	t.Parallel()
	backend := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set(web.SetCookie, tossedCookie)
		writer.Header().Set(web.AccessControlAllowOrigin, guestAllowOrigin)
		writer.WriteHeader(http.StatusEarlyHints)
		writer.Header().Del(web.AccessControlAllowOrigin)
		writer.Header().Add(web.SetCookie, access.CookiePrefix+"0123456789abcdef=forged; Path=/")
		writer.Header().Add(web.SetCookie, previewWarningCookieName+"=true; Path=/")
		writer.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(backend.Close)
	fixture := newMeteringFixture(t, dialingTunnel{address: backendAddress(t, backend)}, routes.HTTPPolicy{})
	frontend := httptest.NewServer(fixture.handler())
	t.Cleanup(frontend.Close)

	var mu sync.Mutex
	var informational []http.Header
	trace := &httptrace.ClientTrace{Got1xxResponse: func(code int, header textproto.MIMEHeader) error {
		mu.Lock()
		defer mu.Unlock()
		if code == http.StatusEarlyHints {
			informational = append(informational, http.Header(header).Clone())
		}
		return nil
	}}
	request, err := http.NewRequestWithContext(httptrace.WithClientTrace(t.Context(), trace), http.MethodGet, frontend.URL, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("request through the edge: %v", err)
	}
	defer response.Body.Close()
	fixture.waitServed(t)

	mu.Lock()
	defer mu.Unlock()
	if len(informational) != 1 ||
		!slices.Equal(informational[0].Values(web.SetCookie), []string{confinedCookie}) ||
		informational[0].Get(web.AccessControlAllowOrigin) != "" {
		t.Fatalf("103 headers reaching the client = %v", informational)
	}
	if got := response.Header.Values(web.SetCookie); !slices.Equal(got, []string{confinedCookie}) {
		t.Fatalf("final Set-Cookie = %q, want only %q", got, confinedCookie)
	}
}

func TestWarningAcceptanceRequiresASameOriginPost(t *testing.T) {
	t.Parallel()
	frontend := &Frontend{logger: slog.New(slog.DiscardHandler)}
	route := routes.HTTP{Policy: routes.HTTPPolicy{ShowBrowserWarning: true}}
	accept := func(fetchSite string) *http.Response {
		request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "https://3000-sandbox.snapflow.test"+previewWarningAcceptPath+"?redirect=/", nil)
		request.Header.Set(web.FetchSite, fetchSite)
		recorder := httptest.NewRecorder()
		if !frontend.handleBrowserWarning(recorder, request, route) {
			t.Fatal("the warning handler did not answer its accept endpoint")
		}
		return recorder.Result()
	}
	if response := accept(crossSite); response.StatusCode != http.StatusForbidden || len(response.Cookies()) != 0 {
		t.Fatalf("cross-site acceptance = %d %v, want refused", response.StatusCode, response.Cookies())
	}
	response := accept(fetchSiteSameOrigin)
	cookies := response.Cookies()
	if response.StatusCode != http.StatusSeeOther || len(cookies) != 1 ||
		cookies[0].Name != previewWarningCookieName || !cookies[0].Secure || cookies[0].Domain != "" {
		t.Fatalf("same-origin acceptance = %d %+v, want a __Host- cookie and a redirect", response.StatusCode, cookies)
	}
}
