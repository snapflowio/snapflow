// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package managertest

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/snapflowio/snapshot-manager/internal/access"
	"github.com/snapflowio/snapshot-manager/internal/manager"
)

const (
	registryBasePath = "/v2/"
	invalidToken     = "not-a-token"
	testSubject      = "service:managertest"
)

func TestEnvironmentServesTheAuthenticatedRegistry(t *testing.T) {
	t.Parallel()

	environment := Start(t)
	tests := []struct {
		name       string
		username   string
		password   string
		wantStatus int
	}{
		{name: "without credentials", wantStatus: http.StatusUnauthorized},
		{name: "with an invalid token", username: access.TokenUsername, password: invalidToken, wantStatus: http.StatusUnauthorized},
		{name: "with a registry token", username: access.TokenUsername, password: environment.Tokens.Token(t, testSubject), wantStatus: http.StatusOK},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, environment.URL+registryBasePath, http.NoBody)
			if err != nil {
				t.Fatalf("create request: %v", err)
			}
			if test.username != "" {
				request.SetBasicAuth(test.username, test.password)
			}
			response, err := http.DefaultClient.Do(request)
			if err != nil {
				t.Fatalf("GET %s: %v", registryBasePath, err)
			}
			if err := response.Body.Close(); err != nil {
				t.Fatalf("close response body: %v", err)
			}
			if response.StatusCode != test.wantStatus {
				t.Fatalf("GET %s status = %d, want %d", registryBasePath, response.StatusCode, test.wantStatus)
			}
		})
	}

	if err := environment.Shutdown(); err != nil {
		t.Fatalf("Shutdown() error = %v", err)
	}
	if err := environment.Server.Run(context.Background()); !errors.Is(err, manager.ErrAlreadyStarted) {
		t.Fatalf("Run() after shutdown error = %v, want %v", err, manager.ErrAlreadyStarted)
	}
}
