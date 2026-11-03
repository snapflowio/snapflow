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

	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/web"
)

func TestUpstreamRewriteRemovesEdgeAccessHeaders(t *testing.T) {
	t.Parallel()
	in := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "https://toolbox-1.snapflow.run/files", nil)
	in.Header.Set(access.AccessTokenHeader, "session-token")
	in.Header.Set(access.AccessModeHeader, access.AccessModeToken)
	in.Header.Set(web.Accept, web.JSONMediaType)
	out := in.Clone(t.Context())
	rewriteUpstreamRequest(out, in, routes.HTTP{PublicHost: "toolbox-1.snapflow.run"}, requestMetadata{scheme: web.SchemeHTTPS})
	for _, header := range []string{access.AccessTokenHeader, access.AccessModeHeader} {
		if value := out.Header.Get(header); value != "" {
			t.Fatalf("%s reached the guest as %q", header, value)
		}
	}
	if out.Header.Get(web.Accept) != web.JSONMediaType {
		t.Fatal("unrelated request headers must reach the guest")
	}
}

func TestUpstreamRewriteKeepsTheRawQuery(t *testing.T) {
	t.Parallel()
	const rawQuery = "z=1&a=2&flag&x=1;y=2"
	in := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "https://3000-1.snapflow.run/a?"+rawQuery, nil)
	out := in.Clone(t.Context())
	out.URL.RawQuery = "a=2&flag=&z=1"
	rewriteUpstreamRequest(out, in, routes.HTTP{PublicHost: "3000-1.snapflow.run"}, requestMetadata{scheme: web.SchemeHTTPS})
	if out.URL.RawQuery != rawQuery {
		t.Fatalf("query reaching the guest = %q, want %q", out.URL.RawQuery, rawQuery)
	}
}
