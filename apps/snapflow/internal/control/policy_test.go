// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control_test

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/control/controltest"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	testRegistry        = "https://registry.snapflow.test"
	testInsecureRegisty = "http://registry.snapflow.test"
	testConnectionToken = "connection-token"
	testRevision        = 4
	testSchemaVersion   = 1
	testPolicyLifetime  = time.Hour
)

func policyServer(t *testing.T, registry string, status int) *control.Client {
	t.Helper()
	return controltest.NewClient(t, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != controlPolicyAPI {
			t.Errorf("unexpected request path %q", request.URL.Path)
		}
		issuedAt := time.Now().Add(-time.Minute)
		controltest.WriteJSON(t, writer, status, apiclient.MachineControlPolicyDto{
			SchemaVersion: testSchemaVersion, Revision: testRevision, IssuedAt: issuedAt,
			ExpiresAt: issuedAt.Add(testPolicyLifetime), GuestRegistryUrl: registry,
			DesktopEnabled: true, SerialConsoleEnabled: false, ConnectionToken: testConnectionToken,
		})
	}))
}

func TestResolveReturnsValidatedPolicy(t *testing.T) {
	resolved, err := control.ResolvePolicy(t.Context(), policyServer(t, testRegistry, http.StatusOK), true)
	if err != nil {
		t.Fatalf("ResolvePolicy() error = %v", err)
	}
	if resolved.Revision != testRevision || resolved.GuestRegistryURL != testRegistry ||
		!resolved.DesktopEnabled || resolved.ConnectionToken != testConnectionToken {
		t.Fatalf("ResolvePolicy() = %+v", resolved)
	}
}

func TestResolveRequiresHTTPSRegistryInProduction(t *testing.T) {
	client := policyServer(t, testInsecureRegisty, http.StatusOK)
	if _, err := control.ResolvePolicy(t.Context(), client, true); err == nil {
		t.Fatal("ResolvePolicy() accepted an HTTP guest registry in production")
	}
	if _, err := control.ResolvePolicy(t.Context(), client, false); err != nil {
		t.Fatalf("ResolvePolicy() rejected an HTTP guest registry outside production: %v", err)
	}
}

func TestResolveDescribesControlPlaneRejection(t *testing.T) {
	_, err := control.ResolvePolicy(t.Context(), policyServer(t, testRegistry, http.StatusUnauthorized), true)
	if !apierror.HasStatus(err, http.StatusUnauthorized) {
		t.Fatalf("ResolvePolicy() error = %v, want HTTP 401", err)
	}
}

func TestValidateRefresh(t *testing.T) {
	active := control.ControlPolicy{SchemaVersion: testSchemaVersion, Revision: testRevision, GuestRegistryURL: testRegistry, ConnectionToken: testConnectionToken}
	changed := active
	changed.Revision++
	changed.ConnectionToken = "rotated"
	if err := control.ValidatePolicyRefresh(active, changed); !errors.Is(err, control.ErrRestartRequired) {
		t.Fatalf("ValidatePolicyRefresh(changed) = %v, want ErrRestartRequired", err)
	}
	lowerFingerprint := changed
	lowerFingerprint.Revision = testRevision - 1
	if err := control.ValidatePolicyRefresh(active, lowerFingerprint); !errors.Is(err, control.ErrRestartRequired) {
		t.Fatalf("ValidatePolicyRefresh(lower fingerprint) = %v, want ErrRestartRequired", err)
	}
	conflicting := changed
	conflicting.Revision = testRevision
	if err := control.ValidatePolicyRefresh(active, conflicting); err == nil || errors.Is(err, control.ErrRestartRequired) {
		t.Fatalf("ValidatePolicyRefresh(same revision, new content) = %v, want a conflict error", err)
	}
	sameContent := active
	sameContent.Revision = testRevision - 1
	if err := control.ValidatePolicyRefresh(active, sameContent); err != nil {
		t.Fatalf("ValidatePolicyRefresh(new revision, same content) = %v", err)
	}
	if err := control.ValidatePolicyRefresh(active, active); err != nil {
		t.Fatalf("ValidatePolicyRefresh(unchanged) = %v", err)
	}
}
