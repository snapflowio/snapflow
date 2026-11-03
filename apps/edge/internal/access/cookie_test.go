// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/google/uuid"
)

func TestExpiredCookieKeepsSessionCookieAttributes(t *testing.T) {
	t.Parallel()
	recorder := httptest.NewRecorder()
	backendID := uuid.New()
	ExpireCookie(recorder, backendID)
	cookies := recorder.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != cookieName(backendID) ||
		cookies[0].MaxAge >= 0 || cookies[0].Path != cookiePath ||
		!cookies[0].Secure || !cookies[0].HttpOnly ||
		cookies[0].SameSite != http.SameSiteNoneMode || !cookies[0].Partitioned {
		t.Fatalf("expired cookie = %+v, want the partitioned session cookie attributes", cookies)
	}
}

func TestAccessCookieNamesArePerBackend(t *testing.T) {
	t.Parallel()
	backendID := uuid.New()
	sameBackendID, err := uuid.Parse(backendID.String())
	if err != nil {
		t.Fatalf("parse backend id: %v", err)
	}
	if cookieName(backendID) != cookieName(sameBackendID) {
		t.Fatal("a backend cookie name is not stable")
	}
	if cookieName(backendID) == cookieName(uuid.New()) {
		t.Fatal("two backends share an access cookie name")
	}
}

func TestStripAccessCookiesRemovesEveryAccessCookieBeforeProxying(t *testing.T) {
	t.Parallel()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "https://app.example.test/", nil)
	request.AddCookie(&http.Cookie{Name: cookieName(uuid.New()), Value: "first"})
	request.AddCookie(&http.Cookie{Name: "application", Value: "kept"})
	request.AddCookie(&http.Cookie{Name: cookieName(uuid.New()), Value: "second"})
	StripCredentials(request)
	names := make([]string, 0, len(request.Cookies()))
	for _, cookie := range request.Cookies() {
		names = append(names, cookie.Name)
	}
	if !slices.Equal(names, []string{"application"}) {
		t.Fatalf("forwarded cookies = %v, want only the application cookie", names)
	}
}
