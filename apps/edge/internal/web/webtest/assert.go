// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package webtest

import (
	"net/http"
	"testing"

	"github.com/snapflowio/edge/internal/web"
)

const (
	DashboardOrigin = "https://dashboard.example.test"
	UntrustedOrigin = "https://attacker.example.test"
)

func AssertResponse(t *testing.T, header http.Header, wantOrigin string) {
	t.Helper()
	if got := header.Get(web.AccessControlAllowOrigin); got != wantOrigin {
		t.Fatalf("%s = %q, want %q", web.AccessControlAllowOrigin, got, wantOrigin)
	}
	wantCredentials := ""
	if wantOrigin != "" {
		wantCredentials = web.CredentialsAllowed
	}
	if got := header.Get(web.AccessControlAllowCredentials); got != wantCredentials {
		t.Fatalf("%s = %q, want %q", web.AccessControlAllowCredentials, got, wantCredentials)
	}
	if !web.ContainsToken(header.Values(web.Vary), web.Origin) {
		t.Fatalf("%s = %v, want %s", web.Vary, header.Values(web.Vary), web.Origin)
	}
}
