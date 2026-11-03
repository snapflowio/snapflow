// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control_test

import (
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/control/controltest"
)

const (
	testSessionToken = "machine-session-token"
	controlPolicyAPI = controltest.APIPrefix + "/machines/control-policy"
)

func TestNewRejectsInvalidServerURLAndIdentity(t *testing.T) {
	_, signingKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate signing key: %v", err)
	}
	identity := control.MachineIdentity{MachineID: "machine", KeyID: "key", SigningKey: signingKey}
	for _, serverURL := range []string{"", "ftp://api.test", "https://user:pass@api.test", "https://api.test?x=1"} {
		if _, err := control.New(control.Config{ServerURL: serverURL, Identity: identity}); err == nil {
			t.Fatalf("New(%q) accepted an invalid server URL", serverURL)
		}
	}
	if _, err := control.New(control.Config{
		ServerURL: "https://api.test", Identity: control.MachineIdentity{MachineID: "machine", KeyID: "key"},
	}); err == nil {
		t.Fatal("New accepted an identity without a signing key")
	}
}

func TestSessionTokenIsAttachedUntilCleared(t *testing.T) {
	var authorizations []string
	client := controltest.NewClient(t, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != controlPolicyAPI {
			t.Errorf("unexpected request path %q", request.URL.Path)
		}
		if request.Header.Get(control.SnapflowSourceHeader) == "" {
			t.Error("request is missing the Snapflow source header")
		}
		authorizations = append(authorizations, request.Header.Get("Authorization"))
		writer.WriteHeader(http.StatusServiceUnavailable)
	}))
	if err := client.ActivateSession(testSessionToken); err != nil {
		t.Fatalf("activate session: %v", err)
	}
	executePolicyRequest(t, client)
	client.ClearSession()
	executePolicyRequest(t, client)
	if len(authorizations) != 2 {
		t.Fatalf("observed %d requests, want 2", len(authorizations))
	}
	if authorizations[0] != control.MachineTokenType+" "+testSessionToken {
		t.Fatalf("active session authorization = %q", authorizations[0])
	}
	if authorizations[1] != "" {
		t.Fatalf("cleared session authorization = %q, want none", authorizations[1])
	}
}

func TestActivateSessionRejectsEmptyToken(t *testing.T) {
	client := controltest.NewClient(t, http.NotFoundHandler())
	if err := client.ActivateSession("  "); err == nil {
		t.Fatal("ActivateSession accepted an empty token")
	}
}

func executePolicyRequest(t *testing.T, client *control.Client) {
	t.Helper()
	response, err := client.GetMachineControlPolicyWithResponse(t.Context())
	described := apierror.CheckResponse("fetch control policy", response, err)
	if !apierror.HasStatus(described, http.StatusServiceUnavailable) {
		t.Fatalf("request error = %v, want HTTP 503", described)
	}
}

func TestCheckResponseBoundsDetailAndClassifies(t *testing.T) {
	client := controltest.NewClient(t, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		controltest.WriteJSON(t, writer, http.StatusConflict, map[string]any{
			"message": []string{"first", strings.Repeat("x", 2048)},
		})
	}))
	response, err := client.GetMachineControlPolicyWithResponse(t.Context())
	described := apierror.CheckResponse("fetch control policy", response, err)
	var failure *apierror.Error
	if !errors.As(described, &failure) {
		t.Fatalf("apierror.CheckResponse() = %T, want *controlplane.Error", described)
	}
	if !strings.HasPrefix(failure.Detail, "first; ") || len([]rune(failure.Detail)) != 1024 {
		t.Fatalf("detail is not the bounded joined message: %d runes", len([]rune(failure.Detail)))
	}
	if !apierror.HasStatus(described, http.StatusConflict) || !apierror.IsPermanent(described) || apierror.IsRetryable(described) {
		t.Fatalf("HTTP 409 classification is wrong: %v", described)
	}
}

func TestErrorClassification(t *testing.T) {
	cases := []struct {
		status    int
		permanent bool
		retryable bool
		refusal   bool
	}{
		{status: 0, permanent: false, retryable: true, refusal: false},
		{status: http.StatusBadRequest, permanent: true, retryable: false, refusal: true},
		{status: http.StatusUnauthorized, permanent: true, retryable: false, refusal: false},
		{status: http.StatusConflict, permanent: true, retryable: false, refusal: true},
		{status: http.StatusRequestTimeout, permanent: false, retryable: true, refusal: false},
		{status: http.StatusTooManyRequests, permanent: false, retryable: true, refusal: false},
		{status: http.StatusBadGateway, permanent: false, retryable: true, refusal: false},
	}
	for _, testCase := range cases {
		err := &apierror.Error{Operation: "test", StatusCode: testCase.status, Cause: errors.New("cause")}
		if got := apierror.IsPermanent(err); got != testCase.permanent {
			t.Fatalf("apierror.IsPermanent(HTTP %d) = %t", testCase.status, got)
		}
		if got := apierror.IsRetryable(err); got != testCase.retryable {
			t.Fatalf("apierror.IsRetryable(HTTP %d) = %t", testCase.status, got)
		}
		if got := control.IsRefusal(err); got != testCase.refusal {
			t.Fatalf("IsRefusal(HTTP %d) = %t", testCase.status, got)
		}
	}
	transport := apierror.CheckResponse("noop", nil, errors.New("connection refused"))
	if !apierror.IsRetryable(transport) || apierror.HasStatus(transport, http.StatusOK) {
		t.Fatalf("transport failure classification is wrong: %v", transport)
	}
}
