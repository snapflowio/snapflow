// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package credentials

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

const (
	testHeader     = "X-Snapflow-Guest-Token"
	testCredential = "guest-service-credential"
	credentialMode = 0o600
)

func writeCredential(t *testing.T, value string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "credential")
	if err := os.WriteFile(path, []byte(value+"\n"), credentialMode); err != nil {
		t.Fatalf("write credential: %v", err)
	}
	return path
}

func serve(t *testing.T, credentialFile, header string) *httptest.ResponseRecorder {
	t.Helper()
	handler := RequireHeader(testHeader, credentialFile, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusNoContent)
		if request.Header.Get(testHeader) != testCredential {
			t.Error("handler reached without the credential")
		}
	}))
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/ws", nil)
	if header != "" {
		request.Header.Set(testHeader, header)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func TestRequireHeaderServesAuthenticatedRequests(t *testing.T) {
	if status := serve(t, writeCredential(t, testCredential), testCredential).Code; status != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", status, http.StatusNoContent)
	}
}

func TestRequireHeaderRejectsMissingOrWrongCredential(t *testing.T) {
	credentialFile := writeCredential(t, testCredential)
	for name, header := range map[string]string{"missing": "", "wrong": "other-credential", "prefix": "guest-service"} {
		t.Run(name, func(t *testing.T) {
			if status := serve(t, credentialFile, header).Code; status != http.StatusUnauthorized {
				t.Fatalf("status = %d, want %d", status, http.StatusUnauthorized)
			}
		})
	}
}

func TestRequireHeaderFailsClosedWithoutCredentialFile(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "absent")
	if status := serve(t, missing, testCredential).Code; status != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", status, http.StatusServiceUnavailable)
	}
	if status := serve(t, writeCredential(t, ""), "").Code; status != http.StatusServiceUnavailable {
		t.Fatalf("empty credential status = %d, want %d", status, http.StatusServiceUnavailable)
	}
}
