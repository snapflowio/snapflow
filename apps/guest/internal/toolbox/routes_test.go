// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package toolbox

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/computer-use/plugin"
	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/toolbox/computeruse"
	"github.com/snapflowio/guest/internal/toolbox/port"
	"github.com/snapflowio/guest/internal/toolbox/process/interpreter"
)

const (
	testAuthHeader         = "X-Snapflow-Guest-Token"
	testCredential         = "toolbox-test-credential"
	testCredentialFileName = "toolbox"
	testCredentialFileMode = 0o600
)

type testRouter struct {
	router  *echo.Echo
	workDir string
	matched *echo.RouteInfo
}

func newTestRouter(t *testing.T) testRouter {
	t.Helper()
	dir := t.TempDir()
	credentialFile := filepath.Join(dir, testCredentialFileName)
	if err := os.WriteFile(credentialFile, []byte(testCredential), testCredentialFileMode); err != nil {
		t.Fatalf("write toolbox credential: %v", err)
	}
	logger := slog.New(slog.DiscardHandler)
	s := New(Config{WorkDir: dir, AuthTokenFile: credentialFile, AuthHeader: testAuthHeader}, Dependencies{Logger: logger, Reaper: childreap.New()})
	s.loadComputerUse(context.Background())
	router := s.newRouter(routerDeps{
		ComputerUse: s.computerUse,
		Interpreter: interpreter.NewInterpreterController(logger, s.reaper, dir),
		Ports:       port.NewDetector(),
	})
	matched := &echo.RouteInfo{}
	router.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			*matched = c.RouteInfo()
			return next(c)
		}
	})
	return testRouter{router: router, workDir: dir, matched: matched}
}

func (r testRouter) serve(t *testing.T, method, path string, authenticated bool) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequestWithContext(t.Context(), method, path, nil)
	if authenticated {
		request.Header.Set(testAuthHeader, testCredential)
	}
	recorder := httptest.NewRecorder()
	r.router.ServeHTTP(recorder, request)
	return recorder
}

func (r testRouter) assertMatched(t *testing.T, method, pattern string) {
	t.Helper()
	if r.matched.Method != method || r.matched.Path != pattern {
		t.Fatalf("request resolved to %q %q, want %q %q", r.matched.Method, r.matched.Path, method, pattern)
	}
}

func decodeBody[T any](t *testing.T, recorder *httptest.ResponseRecorder) T {
	t.Helper()
	var body T
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response %q: %v", recorder.Body.String(), err)
	}
	return body
}

func TestComputerUseRoutesResolve(t *testing.T) {
	router := newTestRouter(t)
	routes := []struct{ method, path, pattern string }{
		{http.MethodPost, "/computeruse/start", "/computeruse/start"},
		{http.MethodPost, "/computeruse/stop", "/computeruse/stop"},
		{http.MethodGet, "/computeruse/process-status", "/computeruse/process-status"},
		{http.MethodGet, "/computeruse/process/xvnc/status", "/computeruse/process/:processName/status"},
		{http.MethodPost, "/computeruse/process/xvnc/restart", "/computeruse/process/:processName/restart"},
		{http.MethodGet, "/computeruse/screenshot/region/compressed", "/computeruse/screenshot/region/compressed"},
		{http.MethodPost, "/computeruse/mouse/click", "/computeruse/mouse/click"},
		{http.MethodGet, "/computeruse/a11y/tree", "/computeruse/a11y/tree"},
	}
	for _, route := range routes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			recorder := router.serve(t, route.method, route.path, true)
			router.assertMatched(t, route.method, route.pattern)
			if recorder.Code != http.StatusConflict {
				t.Fatalf("status = %d (%s), want %d from the availability check", recorder.Code, recorder.Body.String(), http.StatusConflict)
			}
			body := decodeBody[computeruse.UnavailableResponse](t, recorder)
			if body.Code != computeruse.CodeComputerUseUnavailable {
				t.Fatalf("code = %q, want %q", body.Code, computeruse.CodeComputerUseUnavailable)
			}
		})
	}
}

func TestComputerUseStatusReportsUnavailable(t *testing.T) {
	router := newTestRouter(t)
	recorder := router.serve(t, http.MethodGet, "/computeruse/status", true)
	router.assertMatched(t, http.MethodGet, "/computeruse/status")
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d (%s), want %d", recorder.Code, recorder.Body.String(), http.StatusOK)
	}
	body := decodeBody[plugin.ComputerUseStatusResponse](t, recorder)
	if body.Status != string(computeruse.AvailabilityUnavailable) {
		t.Fatalf("computer-use status = %q, want %q", body.Status, computeruse.AvailabilityUnavailable)
	}
}

func TestToolboxRoutesResolve(t *testing.T) {
	router := newTestRouter(t)
	recorder := router.serve(t, http.MethodGet, "/work-dir", true)
	router.assertMatched(t, http.MethodGet, "/work-dir")
	if recorder.Code != http.StatusOK {
		t.Fatalf("work-dir status = %d (%s), want %d", recorder.Code, recorder.Body.String(), http.StatusOK)
	}
	if body := decodeBody[WorkDirResponse](t, recorder); body.Dir != router.workDir {
		t.Fatalf("work dir = %q, want %q", body.Dir, router.workDir)
	}
	router.serve(t, http.MethodGet, "/process/pty/unknown-session", true)
	router.assertMatched(t, http.MethodGet, "/process/pty/:sessionId")
}

func TestToolboxUnknownRouteIsNotFound(t *testing.T) {
	router := newTestRouter(t)
	if recorder := router.serve(t, http.MethodGet, "/no-such-route", true); recorder.Code != http.StatusNotFound {
		t.Fatalf("unknown route status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
}

func TestToolboxRoutesRequireCredential(t *testing.T) {
	recorder := newTestRouter(t).serve(t, http.MethodPost, "/computeruse/start", false)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
}
