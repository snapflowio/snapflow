// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control_test

import (
	"context"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"

	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/control/controltest"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	registerAPI              = controltest.APIPrefix + "/machines/register"
	organizationListAPI      = controltest.APIPrefix + "/auth/organization/list"
	organizationSetActiveAPI = controltest.APIPrefix + "/auth/organization/set-active"
	approvalSessionAPI       = controltest.APIPrefix + "/auth/get-session"
	testMachineName          = "garage-4090"
	testVersion              = "1.2.3"
	testUnknownOrganization  = "no-such-org"
	bearerAuthorization      = "Bearer " + testAccessToken
	listMachinesAPI          = controltest.APIPrefix + "/machines"
	revokeMachineAPI         = controltest.APIPrefix + "/machines/{id}/identity/revoke"
	testReplacedMachineID    = "6f0c1d6e-2b8a-4c8e-9f3a-1d2c3b4a5f60"
	testOtherMachineID       = "0e9d8c7b-6a5f-4e3d-8c2b-1a0f9e8d7c6b"
	testOtherMachineName     = "rack-07"
)

func teamOrganization() control.Organization {
	return control.Organization{
		ID: "7b1d0c5e-2a4f-4e8b-9c36-1f5a8d2e6b40", Name: "Acme Compute", Slug: "acme",
	}
}

func personalOrganization() control.Organization {
	return control.Organization{
		ID: "3f6c2a1e-9b7d-4c58-8e21-6a0d4b9f7c13", Name: "Garage", Slug: "garage",
	}
}

type registrationAPI struct {
	t             testing.TB
	status        int
	organizations []control.Organization
	mu            sync.Mutex
	activeID      string
	activations   []string
	signOuts      atomic.Int32
	registrations atomic.Int32
	machines      []map[string]string
	revokeStatus  int
	revoked       []string
}

func newRegistrationAPI(t testing.TB, status int, organizations ...control.Organization) *registrationAPI {
	return &registrationAPI{
		t: t, status: status, organizations: organizations, activeID: organizations[0].ID,
		revokeStatus: http.StatusNoContent,
	}
}

func (api *registrationAPI) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc(deviceCodeAPI, func(writer http.ResponseWriter, request *http.Request) {
		var body map[string]string
		controltest.DecodeJSON(api.t, request, &body)
		if body["client_id"] != control.CLIDeviceClientID {
			api.t.Errorf("device code client = %q", body["client_id"])
		}
		controltest.WriteJSON(api.t, writer, http.StatusOK, map[string]any{
			"device_code": testDeviceCode, "user_code": testUserCode,
			"verification_uri": "http://dashboard/device", "verification_uri_complete": "http://dashboard/device?user_code=" + testUserCode,
			"expires_in": testCodeLifetime, "interval": testPollInterval,
		})
	})
	mux.Handle(deviceTokenAPI, &tokenEndpoint{t: api.t, replies: []tokenReply{oauthFailure("authorization_pending"), approved()}})
	mux.HandleFunc("GET "+organizationListAPI, func(writer http.ResponseWriter, request *http.Request) {
		api.assertBearer(request)
		controltest.WriteJSON(api.t, writer, http.StatusOK, api.organizations)
	})
	mux.HandleFunc("GET "+approvalSessionAPI, func(writer http.ResponseWriter, request *http.Request) {
		api.assertBearer(request)
		controltest.WriteJSON(api.t, writer, http.StatusOK, map[string]any{
			"session": map[string]string{"activeOrganizationId": api.active()},
			"user":    map[string]string{"id": "user-1"},
		})
	})
	mux.HandleFunc("POST "+organizationSetActiveAPI, api.setActive)
	mux.HandleFunc(registerAPI, api.register)
	mux.HandleFunc("GET "+listMachinesAPI, func(writer http.ResponseWriter, request *http.Request) {
		api.assertBearer(request)
		controltest.WriteJSON(api.t, writer, http.StatusOK, map[string]any{"items": api.machines, "nextCursor": nil})
	})
	mux.HandleFunc("POST "+revokeMachineAPI, api.revoke)
	mux.HandleFunc(signOutAPI, func(writer http.ResponseWriter, request *http.Request) {
		api.assertBearer(request)
		api.signOuts.Add(1)
		controltest.WriteJSON(api.t, writer, http.StatusOK, map[string]bool{"success": true})
	})
	return mux
}

func (api *registrationAPI) active() string {
	api.mu.Lock()
	defer api.mu.Unlock()
	return api.activeID
}

func (api *registrationAPI) activated() []string {
	api.mu.Lock()
	defer api.mu.Unlock()
	return slices.Clone(api.activations)
}

func (api *registrationAPI) setActive(writer http.ResponseWriter, request *http.Request) {
	api.assertBearer(request)
	var body map[string]string
	controltest.DecodeJSON(api.t, request, &body)
	api.mu.Lock()
	api.activeID = body["organizationId"]
	api.activations = append(api.activations, body["organizationId"])
	api.mu.Unlock()
	controltest.WriteJSON(api.t, writer, http.StatusOK, map[string]string{"id": body["organizationId"]})
}

func (api *registrationAPI) register(writer http.ResponseWriter, request *http.Request) {
	api.assertBearer(request)
	api.registrations.Add(1)
	var body map[string]string
	controltest.DecodeJSON(api.t, request, &body)
	if body["name"] != testMachineName || body["appVersion"] != testVersion {
		api.t.Errorf("registration body = %v", body)
	}
	api.assertProof(body)
	if api.status != http.StatusOK {
		controltest.WriteJSON(api.t, writer, api.status, map[string]string{"message": "name is taken"})
		return
	}
	controltest.WriteJSON(api.t, writer, http.StatusOK, apiclient.MachineRegistrationDto{
		MachineId: uuid.MustParse(controltest.MachineID), OwnerId: uuid.MustParse(api.active()),
	})
}

func (api *registrationAPI) revoke(writer http.ResponseWriter, request *http.Request) {
	api.assertBearer(request)
	api.mu.Lock()
	api.revoked = append(api.revoked, request.PathValue("id"))
	api.mu.Unlock()
	if api.revokeStatus != http.StatusNoContent {
		controltest.WriteJSON(api.t, writer, api.revokeStatus, map[string]string{"message": "revoke refused"})
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}

func (api *registrationAPI) revokedMachines() []string {
	api.mu.Lock()
	defer api.mu.Unlock()
	return slices.Clone(api.revoked)
}

func (api *registrationAPI) assertBearer(request *http.Request) {
	if got := request.Header.Get("Authorization"); got != bearerAuthorization {
		api.t.Errorf("%s authorization = %q", request.URL.Path, got)
	}
	if request.Header.Get("X-Api-Key") != "" {
		api.t.Errorf("%s sent an API key", request.URL.Path)
	}
}

func (api *registrationAPI) assertProof(body map[string]string) {
	block, rest := pem.Decode([]byte(body["identityPublicKey"]))
	if block == nil || len(rest) != 0 {
		api.t.Errorf("identity public key is not a single PEM block")
		return
	}
	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	publicKey, isEd25519 := parsed.(ed25519.PublicKey)
	if err != nil || !isEd25519 {
		api.t.Errorf("identity public key = %T, %v", parsed, err)
		return
	}
	keyID, err := state.KeyID(publicKey)
	if err != nil {
		api.t.Error(err)
		return
	}
	message := strings.Join([]string{
		"snapflow.machine-registration", body["name"], keyID, body["issuedAt"], body["nonce"],
	}, "\n")
	signature, err := base64.RawURLEncoding.DecodeString(body["signature"])
	if err != nil || !ed25519.Verify(publicKey, []byte(message), signature) {
		api.t.Errorf("registration signature does not verify over %q", message)
	}
}

type organizationChooser struct {
	pick      control.Organization
	presented []control.OrganizationChoice
}

func (chooser *organizationChooser) choose(
	ctx context.Context,
	choice control.OrganizationChoice,
) (control.Organization, error) {
	chooser.presented = append(chooser.presented, choice)
	return chooser.pick, ctx.Err()
}

type registrationRun struct {
	api     *registrationAPI
	chooser *organizationChooser
	shown   control.DeviceAuthorization
	result  control.RegisteredIdentity
	err     error
}

func register(
	t *testing.T,
	api *registrationAPI,
	organization string,
	pick control.Organization,
	options ...func(*control.RegistrationConfig),
) *registrationRun {
	t.Helper()
	server := httptest.NewServer(api.handler())
	t.Cleanup(server.Close)
	run := &registrationRun{api: api, chooser: &organizationChooser{pick: pick}}
	cfg := control.RegistrationConfig{
		APIURL: server.URL + controltest.APIPrefix, Name: testMachineName,
		Organization: organization, Version: testVersion,
		OnAuthorization:    func(authorization control.DeviceAuthorization) { run.shown = authorization },
		ChooseOrganization: run.chooser.choose,
	}
	for _, option := range options {
		option(&cfg)
	}
	waits := &recordedWaits{}
	run.result, run.err = control.RegisterIdentity(t.Context(), cfg, waits.wait)
	if api.signOuts.Load() != 1 {
		t.Errorf("sign-outs = %d, want 1", api.signOuts.Load())
	}
	return run
}

func (run *registrationRun) assertRegisteredInto(t *testing.T, organization control.Organization) {
	t.Helper()
	if run.err != nil {
		t.Fatal(run.err)
	}
	identity := run.result.Identity
	if identity.MachineID != controltest.MachineID || identity.OwnerID != organization.ID {
		t.Fatalf("identity = %s/%s", identity.MachineID, identity.OwnerID)
	}
	if run.result.Organization != organization {
		t.Fatalf("organization = %+v, want %+v", run.result.Organization, organization)
	}
	if err := identity.Validate(); err != nil {
		t.Fatalf("registered identity is invalid: %v", err)
	}
}

func TestRegisterIdentitySignsOut(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusOK, personalOrganization())
	run := register(t, api, "", control.Organization{})
	run.assertRegisteredInto(t, personalOrganization())
	if run.shown.UserCode != testUserCode || run.shown.VerificationURIComplete == "" {
		t.Fatalf("shown authorization = %+v", run.shown)
	}
	if len(api.activated()) != 0 || len(run.chooser.presented) != 0 {
		t.Fatalf("activations = %v, choices = %d", api.activated(), len(run.chooser.presented))
	}
}

func TestRegisterIdentityConflictStillSignsOut(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusConflict, personalOrganization())
	run := register(t, api, "", control.Organization{})
	if !errors.Is(run.err, control.ErrRegistrationConflict) || run.result.Identity != nil {
		t.Fatalf("result = %+v, %v; want registration conflict", run.result, run.err)
	}
}

func TestRegisterIdentityResolvesTheOrganizationFlag(t *testing.T) {
	for name, flag := range map[string]string{"slug": teamOrganization().Slug, "id": teamOrganization().ID} {
		t.Run(name, func(t *testing.T) {
			api := newRegistrationAPI(t, http.StatusOK, personalOrganization(), teamOrganization())
			run := register(t, api, flag, control.Organization{})
			run.assertRegisteredInto(t, teamOrganization())
			if activations := api.activated(); !slices.Equal(activations, []string{teamOrganization().ID}) {
				t.Fatalf("activations = %v, want %s", activations, teamOrganization().ID)
			}
			if len(run.chooser.presented) != 0 {
				t.Fatal("the organization choice was presented although --organization was given")
			}
		})
	}
}

func TestRegisterIdentityRejectsAnUnknownOrganization(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusOK, personalOrganization(), teamOrganization())
	run := register(t, api, testUnknownOrganization, control.Organization{})
	if !errors.Is(run.err, control.ErrUnknownOrganization) || !strings.Contains(run.err.Error(), testUnknownOrganization) {
		t.Fatalf("error = %v; want unknown organization", run.err)
	}
	if api.registrations.Load() != 0 || len(api.activated()) != 0 {
		t.Fatalf("registrations = %d, activations = %v", api.registrations.Load(), api.activated())
	}
}

func TestRegisterIdentityPresentsTheOrganizationsAndKeepsTheActiveOne(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusOK, personalOrganization(), teamOrganization())
	run := register(t, api, "", personalOrganization())
	run.assertRegisteredInto(t, personalOrganization())
	want := control.OrganizationChoice{
		Organizations: []control.Organization{personalOrganization(), teamOrganization()}, Active: personalOrganization(),
	}
	if len(run.chooser.presented) != 1 || run.chooser.presented[0].Active != want.Active ||
		!slices.Equal(run.chooser.presented[0].Organizations, want.Organizations) {
		t.Fatalf("presented = %+v, want %+v", run.chooser.presented, want)
	}
	if len(api.activated()) != 0 {
		t.Fatalf("activations = %v; the active organization was kept", api.activated())
	}
}

func TestRegisterIdentityActivatesTheChosenOrganization(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusOK, personalOrganization(), teamOrganization())
	run := register(t, api, "", teamOrganization())
	run.assertRegisteredInto(t, teamOrganization())
	if activations := api.activated(); !slices.Equal(activations, []string{teamOrganization().ID}) {
		t.Fatalf("activations = %v, want %s", activations, teamOrganization().ID)
	}
}

func replacing(machineID string) func(*control.RegistrationConfig) {
	return func(cfg *control.RegistrationConfig) {
		cfg.ReplaceExisting, cfg.ReplacedMachineID = true, machineID
	}
}

func TestReplaceRevokesTheStoredMachineBeforeRegistering(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusOK, personalOrganization())
	run := register(t, api, "", control.Organization{}, replacing(testReplacedMachineID))
	run.assertRegisteredInto(t, personalOrganization())
	if revoked := api.revokedMachines(); !slices.Equal(revoked, []string{testReplacedMachineID}) {
		t.Fatalf("revoked = %v, want the stored machine", revoked)
	}
}

func TestReplaceFindsTheMachineByNameWithoutStoredState(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusOK, personalOrganization())
	api.machines = []map[string]string{
		{"id": testOtherMachineID, "name": testOtherMachineName},
		{"id": testReplacedMachineID, "name": testMachineName},
	}
	run := register(t, api, "", control.Organization{}, replacing(""))
	run.assertRegisteredInto(t, personalOrganization())
	if revoked := api.revokedMachines(); !slices.Equal(revoked, []string{testReplacedMachineID}) {
		t.Fatalf("revoked = %v, want the machine with the same name", revoked)
	}
}

func TestReplaceWithoutAMatchingMachineJustRegisters(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusOK, personalOrganization())
	api.machines = []map[string]string{{"id": testOtherMachineID, "name": testOtherMachineName}}
	run := register(t, api, "", control.Organization{}, replacing(""))
	run.assertRegisteredInto(t, personalOrganization())
	if revoked := api.revokedMachines(); len(revoked) != 0 {
		t.Fatalf("revoked = %v, want none", revoked)
	}
}

func TestReplaceToleratesAnAlreadyDeletedMachine(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusOK, personalOrganization())
	api.revokeStatus = http.StatusNotFound
	run := register(t, api, "", control.Organization{}, replacing(testReplacedMachineID))
	run.assertRegisteredInto(t, personalOrganization())
}

func TestReplaceStopsWhenTheRoleCannotRevoke(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusOK, personalOrganization())
	api.revokeStatus = http.StatusForbidden
	run := register(t, api, "", control.Organization{}, replacing(testReplacedMachineID))
	if !errors.Is(run.err, control.ErrReplaceForbidden) || run.result.Identity != nil || api.registrations.Load() != 0 {
		t.Fatalf("result = %+v, %v; want replace forbidden before registering", run.result, run.err)
	}
}

func replacingOwnedBy(machineID, ownerID string) func(*control.RegistrationConfig) {
	return func(cfg *control.RegistrationConfig) {
		cfg.ReplaceExisting, cfg.ReplacedMachineID, cfg.ReplacedOwnerID = true, machineID, ownerID
	}
}

func TestReplaceRegistersIntoTheOwningOrganizationWithoutAsking(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusOK, personalOrganization(), teamOrganization())
	run := register(t, api, "", control.Organization{},
		replacingOwnedBy(testReplacedMachineID, teamOrganization().ID))
	run.assertRegisteredInto(t, teamOrganization())
	if len(run.chooser.presented) != 0 {
		t.Fatalf("organization choices presented = %d, want none", len(run.chooser.presented))
	}
	if revoked := api.revokedMachines(); !slices.Equal(revoked, []string{testReplacedMachineID}) {
		t.Fatalf("revoked = %v, want the stored machine", revoked)
	}
}

func TestReplaceRefusesAnApproverOutsideTheOwningOrganization(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusOK, personalOrganization())
	run := register(t, api, "", control.Organization{},
		replacingOwnedBy(testReplacedMachineID, teamOrganization().ID))
	if !errors.Is(run.err, control.ErrReplaceOtherOrganization) || len(api.revokedMachines()) != 0 || api.registrations.Load() != 0 {
		t.Fatalf("result = %+v, %v; want other organization before revoking", run.result, run.err)
	}
}

func TestReplaceIntoAnExplicitOtherOrganizationMovesWithoutRevoking(t *testing.T) {
	api := newRegistrationAPI(t, http.StatusOK, personalOrganization(), teamOrganization())
	api.machines = []map[string]string{{"id": testOtherMachineID, "name": testMachineName}}
	run := register(t, api, personalOrganization().Slug, control.Organization{},
		replacingOwnedBy(testReplacedMachineID, teamOrganization().ID))
	run.assertRegisteredInto(t, personalOrganization())
	if revoked := api.revokedMachines(); len(revoked) != 0 {
		t.Fatalf("revoked = %v, want none when moving to another organization", revoked)
	}
}
