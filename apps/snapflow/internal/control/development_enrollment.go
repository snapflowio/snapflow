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
	"net/http"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const enrollDevelopmentMachineOperation = "enroll the development machine"

type DevelopmentEnrollment struct {
	APIURL  string
	Name    string
	Secret  string
	Version string
}

// EnrollDevelopment binds signingKey to the development administrator's machine with the shared
// enrollment secret of the local stack, so a development machine never needs an interactive sign-in.
func EnrollDevelopment(ctx context.Context, enrollment DevelopmentEnrollment, signingKey ed25519.PrivateKey) (*state.Identity, error) {
	if enrollment.APIURL == "" || enrollment.Name == "" || enrollment.Secret == "" || enrollment.Version == "" {
		return nil, errors.New("development enrollment requires a control-plane API URL, machine name, secret, and version")
	}
	serverURL, err := normalizeServerURL(enrollment.APIURL)
	if err != nil {
		return nil, err
	}
	api, err := newAPIClient(serverURL, &http.Client{Timeout: deviceHTTPTimeout})
	if err != nil {
		return nil, err
	}
	request, err := registrationRequest(enrollment.Name, enrollment.Version, signingKey)
	if err != nil {
		return nil, err
	}
	response, err := api.EnrollDevelopmentMachineWithResponse(ctx,
		&apiclient.EnrollDevelopmentMachineParams{XSnapflowDevelopmentEnrollmentSecret: enrollment.Secret}, request)
	registration, err := apierror.Decode(enrollDevelopmentMachineOperation, response, err,
		(*apiclient.EnrollDevelopmentMachineResult).GetJSON200)
	if err != nil {
		return nil, err
	}
	publicKey, err := signingPublicKey(signingKey)
	if err != nil {
		return nil, err
	}
	keyID, err := state.KeyID(publicKey)
	if err != nil {
		return nil, err
	}
	return &state.Identity{
		APIURL: enrollment.APIURL, MachineID: registration.MachineId.String(),
		OwnerID: registration.OwnerId.String(), KeyID: keyID, SigningKey: signingKey,
	}, nil
}
