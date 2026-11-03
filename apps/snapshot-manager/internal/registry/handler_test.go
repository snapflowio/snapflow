// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/snapflowio/snapshot-manager/internal/access"
	"github.com/snapflowio/snapshot-manager/internal/access/accesstest"
)

const registryBasePath = "/v2/"

func TestServerHandlerRequiresScopedTokens(t *testing.T) {
	t.Parallel()

	issuer := accesstest.NewIssuer(t)
	snapshotToken := issuer.Token(t, "machine:1", accesstest.Pull("snapflow/snapshot-a"))
	mirrorToken := issuer.Token(t, "org:1", accesstest.Pull(access.MirrorNamespace+"/*"))
	mirrorTags := registryAPIPrefix + DockerHubMirrorPath + "/library/alpine/tags/list"
	srv, err := New(testConfigWithIssuer(t, issuer), WithLogger(slog.New(slog.DiscardHandler)))
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	httpServer := httptest.NewServer(srv.handler(t.Context()))
	t.Cleanup(httpServer.Close)

	tests := []struct {
		name       string
		path       string
		username   string
		password   string
		wantStatus int
	}{
		{name: "health without credentials", path: HealthPath, wantStatus: http.StatusOK},
		{name: "registry without credentials", path: registryBasePath, wantStatus: http.StatusUnauthorized},
		{name: "registry with a malformed token", path: registryBasePath, username: access.TokenUsername, password: "not-a-token", wantStatus: http.StatusUnauthorized},
		{name: "registry with a token under another username", path: registryBasePath, username: "snapflow", password: snapshotToken, wantStatus: http.StatusUnauthorized},
		{name: "registry with a valid token", path: registryBasePath, username: access.TokenUsername, password: snapshotToken, wantStatus: http.StatusOK},
		{name: "repository the token does not name", path: registryAPIPrefix + "/snapflow/snapshot-b/tags/list", username: access.TokenUsername, password: snapshotToken, wantStatus: http.StatusUnauthorized},
		{name: "mirror without credentials", path: mirrorTags, wantStatus: http.StatusUnauthorized},
		{name: "mirror with a snapshot token", path: mirrorTags, username: access.TokenUsername, password: snapshotToken, wantStatus: http.StatusUnauthorized},
		{name: "repository with a mirror token", path: registryAPIPrefix + "/library/alpine/tags/list", username: access.TokenUsername, password: mirrorToken, wantStatus: http.StatusUnauthorized},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, httpServer.URL+test.path, http.NoBody)
			if err != nil {
				t.Fatalf("create request: %v", err)
			}
			if test.username != "" {
				request.SetBasicAuth(test.username, test.password)
			}

			response, err := httpServer.Client().Do(request)
			if err != nil {
				t.Fatalf("GET %s: %v", test.path, err)
			}
			if err := response.Body.Close(); err != nil {
				t.Fatalf("close response body: %v", err)
			}
			if response.StatusCode != test.wantStatus {
				t.Fatalf("GET %s status = %d, want %d", test.path, response.StatusCode, test.wantStatus)
			}
		})
	}
}

func TestMirrorRepositoriesStripTheMirrorNamespace(t *testing.T) {
	t.Parallel()

	var seen string
	handler := mirrorRepositories(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = r.URL.Path
		w.WriteHeader(http.StatusNoContent)
	}))
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, registryAPIPrefix+DockerHubMirrorPath+"/library/alpine/manifests/3.20", http.NoBody)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if seen != "/v2/library/alpine/manifests/3.20" {
		t.Fatalf("mirror handler saw %q, want the repository without the mirror namespace", seen)
	}
}
