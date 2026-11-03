// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package web

import (
	"crypto/tls"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestContainsTokenMatchesCommaSeparatedValuesCaseInsensitively(t *testing.T) {
	t.Parallel()
	values := []string{"keep-alive", "foo, Upgrade "}
	if !ContainsToken(values, "upgrade") {
		t.Fatal("a listed token was not found")
	}
	if ContainsToken(values, "close") {
		t.Fatal("an unlisted token was found")
	}
}

func TestWebSocketUpgradeRequiresBothHeaders(t *testing.T) {
	t.Parallel()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "http://app.example.test/", nil)
	request.Header.Set(Upgrade, "WebSocket")
	if IsWebSocketUpgrade(request) {
		t.Fatal("an upgrade without a Connection token was treated as a WebSocket")
	}
	request.Header.Set(Connection, "keep-alive, Upgrade")
	if !IsWebSocketUpgrade(request) {
		t.Fatal("a WebSocket upgrade was not recognized")
	}
}

func TestSameOriginComparesSchemeAndHost(t *testing.T) {
	t.Parallel()
	for name, test := range map[string]struct {
		origin string
		secure bool
		want   bool
	}{
		"same https origin":    {origin: "https://app.example.test", secure: true, want: true},
		"scheme mismatch":      {origin: "http://app.example.test", secure: true, want: false},
		"host mismatch":        {origin: "https://other.example.test", secure: true, want: false},
		"credentials rejected": {origin: "https://user@app.example.test", secure: true, want: false},
		"missing origin":       {origin: "", secure: false, want: false},
	} {
		request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "http://app.example.test/", nil)
		if test.secure {
			request.TLS = &tls.ConnectionState{}
		}
		if test.origin != "" {
			request.Header.Set(Origin, test.origin)
		}
		if got := IsSameOrigin(request); got != test.want {
			t.Fatalf("%s: IsSameOrigin = %t, want %t", name, got, test.want)
		}
	}
}
