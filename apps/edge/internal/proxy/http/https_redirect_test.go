// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPSRedirectTargetsTheHTTPSListenerPort(t *testing.T) {
	t.Parallel()
	for name, test := range map[string]struct {
		target string
		port   uint16
		want   string
	}{
		"development listener": {
			target: "http://App.Example.Test:8082/path?query=1",
			port:   8444,
			want:   "https://app.example.test:8444/path?query=1",
		},
		"default port omitted": {
			target: "http://app.example.test/path",
			port:   defaultHTTPSPort,
			want:   "https://app.example.test/path",
		},
		"trailing dot normalized": {
			target: "http://app.example.test.:80/",
			port:   defaultHTTPSPort,
			want:   "https://app.example.test/",
		},
	} {
		request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, test.target, nil)
		if got := httpsRedirectURL(request, test.port); got != test.want {
			t.Fatalf("%s: redirect = %q, want %q", name, got, test.want)
		}
	}
}
