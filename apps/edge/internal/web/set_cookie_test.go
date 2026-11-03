// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package web_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/snapflowio/edge/internal/web"
)

const (
	reservedCookiePrefix = "__Host-Snapflow-Access-v1-"
	previewCookieName    = "__Host-Snapflow-Preview-Accepted"
)

func TestConfineUpstreamCookies(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		cookies  []string
		expected []string
	}{
		{
			name:     "removes the domain attribute and keeps the rest",
			cookies:  []string{"session=abc; Path=/; Domain=snapflow.run; HttpOnly; SameSite=Lax"},
			expected: []string{"session=abc; Path=/; HttpOnly; SameSite=Lax"},
		},
		{
			name:     "matches the domain attribute case-insensitively",
			cookies:  []string{"a=1;  dOmAiN =.snapflow.run ;Secure"},
			expected: []string{"a=1;Secure"},
		},
		{
			name:     "keeps host-only cookies unchanged",
			cookies:  []string{"theme=dark; Path=/; Max-Age=60"},
			expected: []string{"theme=dark; Path=/; Max-Age=60"},
		},
		{
			name:     "keeps a value that mentions domain",
			cookies:  []string{"note=domain=x; Path=/"},
			expected: []string{"note=domain=x; Path=/"},
		},
		{
			name:     "drops cookies that use the reserved edge prefix",
			cookies:  []string{reservedCookiePrefix + "0123456789abcdef=forged; Path=/", "kept=1"},
			expected: []string{"kept=1"},
		},
		{
			name:     "drops reserved cookies regardless of case",
			cookies:  []string{"__host-snapflow-access-v1-abc=forged"},
			expected: nil,
		},
		{
			name:     "drops nameless cookies whose value carries the reserved prefix",
			cookies:  []string{"=" + reservedCookiePrefix + "abc=forged; Path=/", reservedCookiePrefix + "abc"},
			expected: nil,
		},
		{
			name:     "drops cookies under any reserved prefix",
			cookies:  []string{previewCookieName + "=1; Path=/", "kept=1"},
			expected: []string{"kept=1"},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			header := http.Header{}
			for _, cookie := range test.cookies {
				header.Add(web.SetCookie, cookie)
			}
			header.Set(web.ContentType, "text/plain")
			web.ConfineUpstreamCookies(header, reservedCookiePrefix, previewCookieName)
			if got := header.Values(web.SetCookie); !slices.Equal(got, test.expected) {
				t.Fatalf("Set-Cookie = %q, want %q", got, test.expected)
			}
			if header.Get(web.ContentType) != "text/plain" {
				t.Fatal("unrelated headers must be kept")
			}
		})
	}
}
