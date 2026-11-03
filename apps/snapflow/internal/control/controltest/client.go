// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package controltest

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/snapflowio/snapflow/internal/control"
)

const (
	MachineID = "8a3c1f9e-5f0c-4c55-9d43-3b8f2f4f1f11"
	KeyID     = "machine-test-key"
	APIPrefix = "/api"
)

func NewClient(t testing.TB, handler http.Handler) *control.Client {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	_, signingKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate machine signing key: %v", err)
	}
	client, err := control.New(control.Config{ServerURL: server.URL, Identity: control.MachineIdentity{
		MachineID: MachineID, KeyID: KeyID, SigningKey: signingKey,
	}})
	if err != nil {
		t.Fatalf("create control-plane client: %v", err)
	}
	return client
}

func WriteJSON(t testing.TB, writer http.ResponseWriter, statusCode int, value any) {
	t.Helper()
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(statusCode)
	if err := json.NewEncoder(writer).Encode(value); err != nil {
		t.Errorf("encode test response: %v", err)
	}
}

func DecodeJSON(t testing.TB, request *http.Request, target any) {
	t.Helper()
	if err := json.NewDecoder(request.Body).Decode(target); err != nil {
		t.Errorf("decode test request: %v", err)
	}
}
