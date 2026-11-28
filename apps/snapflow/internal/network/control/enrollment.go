// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	enrollMachineOperation    = "enroll this machine"
	readPublicConfigOperation = "read the Snapflow deployment settings"
	enrollmentHTTPTimeout     = 30 * time.Second

	enrollmentKeyInvalidCode = "machine_enrollment_key_invalid"
	enrollmentKeyUsedCode    = "machine_enrollment_key_used"
	hostKeyInUseCode         = "machine_host_key_in_use"
)

var (
	ErrEnrollmentKeyRequired = errors.New("an enrollment key is required to enroll this machine")
	ErrEnrollmentKeyInvalid  = errors.New("the enrollment key is invalid, expired or revoked")
	ErrEnrollmentKeyUsed     = errors.New("the enrollment key was already used to enroll a machine")
	ErrHostKeyInUse          = errors.New("this machine's host key is already registered to another machine")
	ErrEnrollmentConflict    = errors.New("this machine conflicts with one already enrolled")
	ErrEnrollmentRejected    = errors.New("the API rejected this machine's enrollment proof")
)

type Enrollment struct {
	APIURL  string
	Name    string
	Token   string
	Version string
}

type errorBody struct {
	Code string `json:"code"`
}

type enrollmentClient struct {
	apiURL string
	api    *apiclient.ClientWithResponses
	proof  apiclient.MachineEnrollmentProof
}

func Enroll(ctx context.Context, enrollment Enrollment, keys state.EnrollmentKeys) (*state.Identity, error) {
	token := strings.TrimSpace(enrollment.Token)
	if token == "" {
		return nil, ErrEnrollmentKeyRequired
	}
	client, err := prepareEnrollment(ctx, enrollment.APIURL, enrollment.Name, enrollment.Version, keys)
	if err != nil {
		return nil, err
	}
	proof := client.proof
	response, err := client.api.EnrollMachineWithResponse(ctx, apiclient.EnrollMachine{
		Token: token, Name: proof.Name, IdentityPublicKey: proof.IdentityPublicKey, HostAddress: proof.HostAddress,
		IssuedAt: proof.IssuedAt, Nonce: proof.Nonce, IdentitySignature: proof.IdentitySignature,
		HostSignature: proof.HostSignature, AppVersion: proof.AppVersion,
	})
	enrolled, err := apierror.Decode(enrollMachineOperation, response, err, (*apiclient.EnrollMachineResult).GetJSON200)
	if err != nil {
		return nil, enrollmentFailure(responseBody(response), err)
	}
	return client.identity(enrolled, keys)
}

func prepareEnrollment(
	ctx context.Context,
	apiURL, name, version string,
	keys state.EnrollmentKeys,
) (enrollmentClient, error) {
	apiURL, name = strings.TrimRight(strings.TrimSpace(apiURL), "/"), strings.TrimSpace(name)
	if apiURL == "" || name == "" || version == "" {
		return enrollmentClient{}, errors.New("machine enrollment requires a control-plane API URL, machine name, and version")
	}
	serverURL, err := normalizeServerURL(apiURL)
	if err != nil {
		return enrollmentClient{}, err
	}
	api, err := newAPIClient(serverURL, &http.Client{Timeout: enrollmentHTTPTimeout})
	if err != nil {
		return enrollmentClient{}, err
	}
	chainID, err := settlementChainID(ctx, api)
	if err != nil {
		return enrollmentClient{}, err
	}
	proof, err := keys.SignEnrollment(name, chainID, time.Now())
	if err != nil {
		return enrollmentClient{}, err
	}
	return enrollmentClient{apiURL: apiURL, api: api, proof: apiclient.MachineEnrollmentProof{
		Name: proof.Name, IdentityPublicKey: proof.IdentityPublicKey, HostAddress: proof.HostAddress,
		IssuedAt: proof.IssuedAt, Nonce: proof.Nonce, IdentitySignature: proof.IdentitySignature,
		HostSignature: proof.HostSignature, AppVersion: &version,
	}}, nil
}

func settlementChainID(ctx context.Context, api *apiclient.ClientWithResponses) (uint64, error) {
	response, err := api.GetPublicConfigWithResponse(ctx)
	settings, err := apierror.Decode(readPublicConfigOperation, response, err, (*apiclient.GetPublicConfigResult).GetJSON200)
	if err != nil {
		return 0, err
	}
	chainID := float64(settings.Settlement.ChainId)
	if chainID <= 0 || chainID != math.Trunc(chainID) {
		return 0, fmt.Errorf("the API reports an invalid settlement chain id %v", settings.Settlement.ChainId)
	}
	return uint64(chainID), nil
}

func (client enrollmentClient) identity(enrolled *apiclient.MachineEnrollment, keys state.EnrollmentKeys) (*state.Identity, error) {
	if !strings.EqualFold(enrolled.HostAddress, keys.HostKey.Address().Hex()) {
		return nil, fmt.Errorf("the API enrolled host key %s, not this machine's %s", enrolled.HostAddress, keys.HostKey)
	}
	return state.NewIdentity(client.apiURL, enrolled.MachineId.String(), enrolled.OrganizationId.String(), keys)
}

func responseBody(response *apiclient.EnrollMachineResult) []byte {
	if response == nil {
		return nil
	}
	return response.Body
}

func enrollmentFailure(body []byte, err error) error {
	status, found := apierror.StatusOf(err)
	if !found {
		return err
	}
	var failure errorBody
	if json.Unmarshal(body, &failure) != nil {
		failure.Code = ""
	}
	switch {
	case failure.Code == enrollmentKeyInvalidCode, status == http.StatusUnauthorized:
		return fmt.Errorf("%w: %w", ErrEnrollmentKeyInvalid, err)
	case failure.Code == enrollmentKeyUsedCode:
		return fmt.Errorf("%w: %w", ErrEnrollmentKeyUsed, err)
	case failure.Code == hostKeyInUseCode:
		return fmt.Errorf("%w: %w", ErrHostKeyInUse, err)
	case status == http.StatusConflict:
		return fmt.Errorf("%w: %w", ErrEnrollmentConflict, err)
	case status == http.StatusBadRequest:
		return fmt.Errorf("%w: %w", ErrEnrollmentRejected, err)
	default:
		return err
	}
}
