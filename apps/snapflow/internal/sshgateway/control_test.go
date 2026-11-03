// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sshgateway

import (
	"net/http"
	"testing"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control/controltest"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	sshRelayAPI    = controltest.APIPrefix + "/sandbox/ssh-access/relay"
	testGrantToken = "grant-token"
	testSandboxID  = "sandbox-1"
)

func accessControl(t *testing.T, status int, sandboxID string) *ControlPlane {
	t.Helper()
	control, err := NewControlPlane(controltest.NewClient(t, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != sshRelayAPI {
			t.Errorf("unexpected request path %q", request.URL.Path)
		}
		var resolve apiclient.ResolveSshRelayDto
		controltest.DecodeJSON(t, request, &resolve)
		if resolve.Token != testGrantToken {
			t.Errorf("resolved token = %q", resolve.Token)
		}
		controltest.WriteJSON(t, writer, status, apiclient.MachineSshAccessDto{SandboxId: sandboxID})
	})))
	if err != nil {
		t.Fatalf("NewControlPlane() error = %v", err)
	}
	return control
}

func TestResolveSSHAccessReturnsGrantedSandbox(t *testing.T) {
	sandboxID, err := accessControl(t, http.StatusOK, testSandboxID).ResolveSSHAccess(t.Context(), testGrantToken)
	if err != nil || sandboxID != testSandboxID {
		t.Fatalf("ResolveSSHAccess() = %q, %v", sandboxID, err)
	}
}

func TestResolveSSHAccessRejectsEmptySandbox(t *testing.T) {
	if _, err := accessControl(t, http.StatusOK, "").ResolveSSHAccess(t.Context(), testGrantToken); err == nil {
		t.Fatal("ResolveSSHAccess accepted an empty sandbox")
	}
}

func TestResolveSSHAccessDescribesRejection(t *testing.T) {
	_, err := accessControl(t, http.StatusForbidden, testSandboxID).ResolveSSHAccess(t.Context(), testGrantToken)
	if !apierror.HasStatus(err, http.StatusForbidden) {
		t.Fatalf("ResolveSSHAccess() error = %v, want HTTP 403", err)
	}
}
