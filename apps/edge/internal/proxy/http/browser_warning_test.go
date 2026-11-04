// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package http

import "testing"

func TestSameOriginRedirectKeepsOnlyPathsOnTheCurrentHost(t *testing.T) {
	t.Parallel()
	for name, test := range map[string]struct {
		value string
		want  string
	}{
		"path and query kept":       {value: "/app/page?tab=1", want: "/app/page?tab=1"},
		"escaped path kept":         {value: "/files/a%2Fb", want: "/files/a%2Fb"},
		"fragment dropped":          {value: "/page#section", want: "/page"},
		"empty":                     {value: "", want: "/"},
		"relative path":             {value: "page", want: "/"},
		"absolute URL":              {value: "https://evil.example/", want: "/"},
		"protocol-relative URL":     {value: "//evil.example/", want: "/"},
		"backslash host":            {value: "/\\evil.example/", want: "/"},
		"encoded protocol-relative": {value: "/%2Fevil.example/", want: "/"},
		"control character prefix":  {value: "/\t/evil.example/", want: "/"},
		"javascript scheme":         {value: "javascript:alert(1)", want: "/"},
	} {
		if got := sameOriginRedirect(test.value); got != test.want {
			t.Errorf("%s: sameOriginRedirect(%q) = %q, want %q", name, test.value, got, test.want)
		}
	}
}
