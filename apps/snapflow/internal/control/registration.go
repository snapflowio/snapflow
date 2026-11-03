// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"crypto/ed25519"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	registerMachineOperation = "register machine"
	listMachinesOperation    = "find the machine to replace"
	revokeMachineOperation   = "revoke the replaced machine"
)

var (
	ErrAlreadyRegistered        = errors.New("this machine is already registered with Snapflow")
	ErrRegistrationConflict     = errors.New("the machine registration conflicts with an existing machine")
	ErrReplaceForbidden         = errors.New("your organization role cannot revoke machines, so this machine cannot be replaced")
	ErrReplaceOtherOrganization = errors.New("this machine belongs to an organization the approving account is not a member of")
)

type RegistrationConfig struct {
	Profile            config.Profile
	StateDirectory     string
	APIURL             string
	Name               string
	Organization       string
	ReplaceExisting    bool
	ReplacedMachineID  string
	ReplacedOwnerID    string
	OnAuthorization    func(DeviceAuthorization)
	ChooseOrganization func(context.Context, OrganizationChoice) (Organization, error)
	Version            string
}

type RegistrationResult struct {
	MachineID      string       `json:"machineId"`
	OwnerID        string       `json:"ownerId"`
	Organization   Organization `json:"organization"`
	StateDirectory string       `json:"stateDirectory"`
}

type registeredIdentity struct {
	identity     *state.Identity
	organization Organization
}

type registrationLogin struct {
	cfg         RegistrationConfig
	api         *apiclient.ClientWithResponses
	accessToken string
}

func Register(ctx context.Context, cfg RegistrationConfig) (result RegistrationResult, resultErr error) {
	cfg.APIURL = strings.TrimRight(strings.TrimSpace(cfg.APIURL), "/")
	cfg.Name = strings.TrimSpace(cfg.Name)
	cfg.Organization = strings.TrimSpace(cfg.Organization)
	if err := cfg.validate(); err != nil {
		return RegistrationResult{}, err
	}
	database, err := state.OpenDatabase(ctx, cfg.StateDirectory)
	if err != nil {
		return RegistrationResult{}, fmt.Errorf("open Snapflow state: %w", err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, database.Close(ctx))
	}()
	vault, err := state.NewPlatformVault(cfg.StateDirectory)
	if err != nil {
		return RegistrationResult{}, fmt.Errorf("open machine key vault: %w", err)
	}
	store, err := state.NewStore(state.StoreConfig{Database: database, Vault: vault})
	if err != nil {
		return RegistrationResult{}, fmt.Errorf("initialize machine identity: %w", err)
	}
	existing, loadErr := store.Metadata(ctx)
	switch {
	case loadErr == nil && !cfg.ReplaceExisting:
		return RegistrationResult{}, ErrAlreadyRegistered
	case loadErr == nil:
		cfg.ReplacedMachineID, cfg.ReplacedOwnerID = existing.MachineID, existing.OwnerID
	case !errors.Is(loadErr, state.ErrNotRegistered):
		return RegistrationResult{}, fmt.Errorf("inspect existing machine registration: %w", loadErr)
	}
	result, err = login(ctx, cfg, store)
	if err != nil {
		return RegistrationResult{}, err
	}
	result.StateDirectory = cfg.StateDirectory
	return result, nil
}

func (cfg RegistrationConfig) validate() error {
	if cfg.APIURL == "" || cfg.Name == "" || cfg.Version == "" {
		return errors.New("machine registration requires a control-plane API URL, machine name, and version")
	}
	if cfg.OnAuthorization == nil || cfg.ChooseOrganization == nil {
		return errors.New("machine approval and organization choice handlers are required")
	}
	if err := cfg.Profile.ValidateAPIURL(cfg.APIURL); err != nil {
		return fmt.Errorf("validate control-plane API: %w", err)
	}
	return nil
}

func login(ctx context.Context, cfg RegistrationConfig, store *state.Store) (RegistrationResult, error) {
	registered, err := registerIdentity(ctx, cfg, waitFor)
	if registered.identity == nil {
		return RegistrationResult{}, err
	}
	if saveErr := store.Save(ctx, registered.identity); saveErr != nil {
		return RegistrationResult{}, errors.Join(fmt.Errorf("save machine identity: %w", saveErr), err)
	}
	return RegistrationResult{
		MachineID: registered.identity.MachineID, OwnerID: registered.identity.OwnerID,
		Organization: registered.organization,
	}, err
}

func registerIdentity(
	ctx context.Context,
	cfg RegistrationConfig,
	wait func(context.Context, time.Duration) error,
) (registered registeredIdentity, resultErr error) {
	devices, err := newDeviceClient(cfg.APIURL)
	if err != nil {
		return registeredIdentity{}, err
	}
	devices.wait = wait
	api, err := newAPIClient(devices.baseURL, &http.Client{Timeout: deviceHTTPTimeout})
	if err != nil {
		return registeredIdentity{}, err
	}
	authorization, err := devices.requestCode(ctx)
	if err != nil {
		return registeredIdentity{}, err
	}
	cfg.OnAuthorization(authorization)
	accessToken, err := devices.awaitToken(ctx, authorization)
	if err != nil {
		return registeredIdentity{}, err
	}
	defer func() {
		resultErr = errors.Join(resultErr, devices.signOut(context.WithoutCancel(ctx), accessToken))
	}()
	organization, err := selectReplacementOrganization(ctx, devices, accessToken, cfg)
	if err != nil {
		return registeredIdentity{}, err
	}
	if cfg.ReplacedOwnerID != "" && organization.ID != cfg.ReplacedOwnerID {
		cfg.ReplaceExisting = false
	}
	session := registrationLogin{cfg: cfg, api: api, accessToken: accessToken}
	registered, err = session.register(ctx)
	registered.organization = organization
	return registered, err
}

func selectReplacementOrganization(
	ctx context.Context,
	devices *deviceClient,
	accessToken string,
	cfg RegistrationConfig,
) (Organization, error) {
	if cfg.ReplacedOwnerID == "" {
		return devices.selectOrganization(ctx, accessToken, cfg)
	}
	if cfg.Organization != "" {
		return devices.selectOrganization(ctx, accessToken, cfg)
	}
	cfg.Organization = cfg.ReplacedOwnerID
	organization, err := devices.selectOrganization(ctx, accessToken, cfg)
	if errors.Is(err, ErrUnknownOrganization) {
		return Organization{}, ErrReplaceOtherOrganization
	}
	return organization, err
}

func (session registrationLogin) register(ctx context.Context) (registeredIdentity, error) {
	if session.cfg.ReplaceExisting {
		if err := session.revokeReplaced(ctx); err != nil {
			return registeredIdentity{}, err
		}
	}
	publicKey, privateKey, err := state.GenerateSigningKey()
	if err != nil {
		return registeredIdentity{}, err
	}
	keyID, err := state.KeyID(publicKey)
	if err != nil {
		return registeredIdentity{}, err
	}
	registration, err := session.submit(ctx, privateKey)
	if err != nil {
		return registeredIdentity{}, err
	}
	return registeredIdentity{identity: &state.Identity{
		APIURL: session.cfg.APIURL, MachineID: registration.MachineId.String(),
		OwnerID: registration.OwnerId.String(), KeyID: keyID, SigningKey: privateKey,
	}}, nil
}

func (session registrationLogin) revokeReplaced(ctx context.Context) error {
	machineID := session.cfg.ReplacedMachineID
	if machineID == "" {
		found, err := session.findNamedMachine(ctx)
		if err != nil || found == "" {
			return err
		}
		machineID = found
	}
	response, err := session.api.RevokeMachineIdentityWithResponse(ctx, machineID, session.authorize)
	err = apierror.CheckResponse(revokeMachineOperation, response, err)
	switch {
	case apierror.HasStatus(err, http.StatusNotFound):
		return nil
	case apierror.HasStatus(err, http.StatusForbidden):
		return fmt.Errorf("%w: %w", ErrReplaceForbidden, err)
	default:
		return err
	}
}

func (session registrationLogin) findNamedMachine(ctx context.Context) (string, error) {
	var cursor *string
	for {
		response, err := session.api.ListMachinesWithResponse(ctx, &apiclient.ListMachinesParams{Cursor: cursor}, session.authorize)
		page, err := apierror.Decode(listMachinesOperation, response, err, (*apiclient.ListMachinesResult).GetJSON200)
		if err != nil {
			return "", err
		}
		for _, machine := range page.Items {
			if machine.Name == session.cfg.Name {
				return machine.Id, nil
			}
		}
		if page.NextCursor == nil || *page.NextCursor == "" {
			return "", nil
		}
		cursor = page.NextCursor
	}
}

func (session registrationLogin) submit(
	ctx context.Context,
	privateKey ed25519.PrivateKey,
) (*apiclient.MachineRegistrationDto, error) {
	request, err := registrationRequest(session.cfg.Name, session.cfg.Version, privateKey)
	if err != nil {
		return nil, err
	}
	response, err := session.api.RegisterMachineWithResponse(ctx, request, session.authorize)
	registration, err := apierror.Decode(registerMachineOperation, response, err, (*apiclient.RegisterMachineResult).GetJSON200)
	switch {
	case apierror.HasStatus(err, http.StatusConflict):
		return nil, fmt.Errorf("%w: %w", ErrRegistrationConflict, err)
	case err != nil:
		return nil, err
	}
	return registration, nil
}

// registrationRequest proves possession of privateKey for the machine name the control plane binds it to.
func registrationRequest(name, version string, privateKey ed25519.PrivateKey) (apiclient.RegisterMachineDto, error) {
	publicKey, err := signingPublicKey(privateKey)
	if err != nil {
		return apiclient.RegisterMachineDto{}, err
	}
	publicKeyPEM, err := state.PublicKeyPEM(publicKey)
	if err != nil {
		return apiclient.RegisterMachineDto{}, err
	}
	proof, err := state.SignRegistration(name, privateKey, time.Now())
	if err != nil {
		return apiclient.RegisterMachineDto{}, err
	}
	return apiclient.RegisterMachineDto{
		Name:              name,
		IdentityPublicKey: publicKeyPEM,
		IssuedAt:          proof.IssuedAt,
		Nonce:             proof.Nonce,
		Signature:         proof.Signature,
		AppVersion:        &version,
	}, nil
}

func signingPublicKey(privateKey ed25519.PrivateKey) (ed25519.PublicKey, error) {
	publicKey, ok := privateKey.Public().(ed25519.PublicKey)
	if !ok {
		return nil, errors.New("machine signing key has no Ed25519 public key")
	}
	return publicKey, nil
}

func (session registrationLogin) authorize(ctx context.Context, request *http.Request) error {
	request.Header.Set(authorizationHeader, bearerTokenType+" "+session.accessToken)
	return ctx.Err()
}
