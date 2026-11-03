// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package computeruse

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
)

var errTestPluginCause = errors.New("libX11.so.6: cannot open shared object file")

func TestLazyComputerUseReportsAvailability(t *testing.T) {
	cases := []struct {
		name         string
		mark         func(*LazyComputerUse)
		availability Availability
		err          error
	}{
		{name: "loading", mark: func(*LazyComputerUse) {}, availability: AvailabilityLoading, err: errNotLoaded},
		{name: "unavailable", mark: (*LazyComputerUse).MarkUnavailable, availability: AvailabilityUnavailable, err: ErrUnavailable},
		{name: "failed", mark: func(lazy *LazyComputerUse) { lazy.MarkFailed(errTestPluginCause) }, availability: AvailabilityFailed, err: errLoadFailed},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			lazy := NewLazyComputerUse()
			tc.mark(lazy)
			if lazy.Availability() != tc.availability {
				t.Fatalf("availability = %q, want %q", lazy.Availability(), tc.availability)
			}
			status, err := lazy.GetStatus()
			if err != nil {
				t.Fatalf("status failed: %v", err)
			}
			if status.Status != string(tc.availability) {
				t.Fatalf("status = %q, want %q", status.Status, tc.availability)
			}
			if _, err := lazy.Current(); !errors.Is(err, tc.err) {
				t.Fatalf("start error = %v, want %v", err, tc.err)
			}
		})
	}
}

func TestLazyComputerUseFailureKeepsCause(t *testing.T) {
	lazy := NewLazyComputerUse()
	lazy.MarkFailed(errTestPluginCause)

	if _, err := lazy.Current(); !errors.Is(err, errTestPluginCause) {
		t.Fatalf("start error = %v, want it to wrap %v", err, errTestPluginCause)
	}
}

func TestAvailabilityMiddlewareReportsFailureCause(t *testing.T) {
	lazy := NewLazyComputerUse()
	lazy.MarkFailed(errTestPluginCause)
	handler := AvailabilityMiddleware(lazy)(func(*echo.Context) error {
		t.Fatal("the plugin handler ran while the plugin failed to load")
		return nil
	})
	recorder := httptest.NewRecorder()
	ctx := echo.New().NewContext(httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/computeruse/start", nil), recorder)

	if err := handler(ctx); err != nil {
		t.Fatalf("middleware error = %v", err)
	}
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusServiceUnavailable)
	}
	var body UnavailableResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response %q: %v", recorder.Body.String(), err)
	}
	if body.Code != CodeComputerUseFailed || !strings.Contains(body.Message, errTestPluginCause.Error()) {
		t.Fatalf("response = %+v, want code %s and the load failure cause", body, CodeComputerUseFailed)
	}
}

func TestAvailabilityMiddlewareWaitsForPluginLoad(t *testing.T) {
	lazy := NewLazyComputerUse()
	handler := AvailabilityMiddleware(lazy)(func(*echo.Context) error {
		t.Fatal("the plugin handler ran for a sandbox without computer use")
		return nil
	})
	recorder := httptest.NewRecorder()
	ctx := echo.New().NewContext(httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/computeruse/start", nil), recorder)
	go lazy.MarkUnavailable()

	if err := handler(ctx); err != nil {
		t.Fatalf("middleware error = %v", err)
	}
	if recorder.Code != http.StatusConflict {
		t.Fatalf("status = %d (%s), want %d from the settled load", recorder.Code, recorder.Body.String(), http.StatusConflict)
	}
}
