// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control_test

import (
	"io"
	"log/slog"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/control/controltest"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	sessionAPI             = controltest.APIPrefix + "/machines/session"
	testSessionID          = "5d2e8f1a-7c4b-4e9d-9a3f-1b6c8e0d2f47"
	testIssuedSessionToken = "session-token"
	testSessionGeneration  = 3
	sessionExpiryTime      = time.Hour
)

func TestCreateActivatesAndCloseRevokesSession(t *testing.T) {
	var closeAuthorization string
	client := controltest.NewClient(t, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != sessionAPI {
			t.Errorf("unexpected request path %q", request.URL.Path)
			writer.WriteHeader(http.StatusNotFound)
			return
		}
		switch request.Method {
		case http.MethodPost:
			var proof apiclient.CreateMachineSessionDto
			controltest.DecodeJSON(t, request, &proof)
			if proof.MachineId.String() != controltest.MachineID {
				t.Errorf("session proof machine = %q", proof.MachineId)
			}
			controltest.WriteJSON(t, writer, http.StatusCreated, apiclient.MachineSessionDto{
				SessionId: uuid.MustParse(testSessionID), TokenType: apiclient.MachineSessionDtoTokenTypeDPoP, Token: testIssuedSessionToken,
				ExpiresAt: time.Now().Add(sessionExpiryTime), Generation: testSessionGeneration,
			})
		case http.MethodDelete:
			closeAuthorization = request.Header.Get("Authorization")
			writer.WriteHeader(http.StatusNoContent)
		default:
			t.Errorf("unexpected method %s", request.Method)
		}
	}))
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	service, err := control.CreateSession(t.Context(), client, controltest.MachineID, control.WithLogger(logger))
	if err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}
	if got := service.Credentials(); got.ID != testSessionID || got.Generation != testSessionGeneration {
		t.Fatalf("Credentials() = %+v", got)
	}
	if err := service.Close(t.Context()); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
	if closeAuthorization != control.MachineTokenType+" "+testIssuedSessionToken {
		t.Fatalf("close authorization = %q, want the activated session token", closeAuthorization)
	}
}

func TestCreateStopsOnPermanentRejection(t *testing.T) {
	client := controltest.NewClient(t, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusForbidden)
	}))
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	_, err := control.CreateSession(t.Context(), client, controltest.MachineID, control.WithLogger(logger))
	if !apierror.HasStatus(err, http.StatusForbidden) {
		t.Fatalf("CreateSession() error = %v, want HTTP 403", err)
	}
}
