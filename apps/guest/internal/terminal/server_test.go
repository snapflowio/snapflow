// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package terminal

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

const (
	testHeader     = "X-Snapflow-Guest-Token"
	testCredential = "terminal-credential"
	credentialMode = 0o600
)

func authenticatedHandler(t *testing.T) http.Handler {
	t.Helper()
	credentialFile := filepath.Join(t.TempDir(), "terminal")
	if err := os.WriteFile(credentialFile, []byte(testCredential), credentialMode); err != nil {
		t.Fatalf("write credential: %v", err)
	}
	handler, err := New(Config{AuthHeader: testHeader, AuthTokenFile: credentialFile}, Dependencies{Logger: slog.New(slog.DiscardHandler)}).handler()
	if err != nil {
		t.Fatalf("build terminal handler: %v", err)
	}
	return handler
}

func TestTerminalRejectsRequestsWithoutGuestCredential(t *testing.T) {
	handler := authenticatedHandler(t)
	for _, path := range []string{"/", "/ws"} {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil))
		if recorder.Code != http.StatusUnauthorized {
			t.Fatalf("%s status = %d, want %d", path, recorder.Code, http.StatusUnauthorized)
		}
	}
}

func TestTerminalServesFrontendWithGuestCredential(t *testing.T) {
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	request.Header.Set(testHeader, testCredential)
	recorder := httptest.NewRecorder()
	authenticatedHandler(t).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}
