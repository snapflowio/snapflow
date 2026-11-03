// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package proxy

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/labstack/echo/v5"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/common-go/pkg/guestspec"
)

const (
	routePattern   = "/proxy/:" + PortParameter + "/*"
	testCredential = "guest-token"
	forwardedPath  = "/api/items"
)

func newTestRouter() *echo.Echo {
	router := echo.NewWithConfig(echo.Config{
		HTTPErrorHandler: common_errors.NewHTTPErrorHandler(func(ctx *echo.Context, err error) common_errors.ErrorResponse {
			return common_errors.ErrorResponse{StatusCode: http.StatusInternalServerError, Message: err.Error()}
		}),
	})
	router.Any(routePattern, New(slog.New(slog.DiscardHandler)).Serve)
	return router
}

func TestHandlerRejectsPortsThatAreNotNumbers(t *testing.T) {
	router := newTestRouter()
	for _, port := range []string{"80@169.254.169.254", "0", "70000", "http:"} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/proxy/"+url.PathEscape(port)+"/", nil))
		if recorder.Code != http.StatusBadRequest {
			t.Errorf("port %q status = %d, want %d", port, recorder.Code, http.StatusBadRequest)
		}
	}
}

func TestHandlerForwardsToLocalPortWithoutTheGuestCredential(t *testing.T) {
	received := make(chan *http.Request, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		received <- request
		writer.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()
	upstreamURL, err := url.Parse(upstream.URL)
	if err != nil {
		t.Fatal(err)
	}
	port := upstreamURL.Port()
	router := newTestRouter()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/proxy/"+port+forwardedPath+"?q=1", nil)
	request.Header.Set(guestspec.AuthHeader, testCredential)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
	forwarded := <-received
	if forwarded.URL.Path != forwardedPath || forwarded.URL.RawQuery != "q=1" {
		t.Fatalf("forwarded URL = %s, want %s?q=1", forwarded.URL, forwardedPath)
	}
	if forwarded.Header.Get(guestspec.AuthHeader) != "" {
		t.Fatal("the guest service credential was forwarded to the workload")
	}
}
