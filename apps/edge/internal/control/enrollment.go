// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/edge/internal/identity"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const completeEnrollmentOperation = "complete Edge enrollment"

func enroll(
	ctx context.Context,
	api *apiclient.ClientWithResponses,
	edgeIdentity *identity.Identity,
	enrollmentSecret string,
) error {
	proof, err := edgeIdentity.EnrollmentProof(time.Now())
	if err != nil {
		return fmt.Errorf("create Edge enrollment proof: %w", err)
	}
	publicKey, err := edgeIdentity.PublicKeyPEM()
	if err != nil {
		return err
	}
	edgeID, err := uuid.Parse(edgeIdentity.EdgeID())
	if err != nil {
		return fmt.Errorf("parse Edge ID: %w", err)
	}
	result, err := api.CompleteEdgeEnrollmentWithResponse(ctx, apiclient.CompleteEdgeEnrollmentDto{
		IssuedAt:          proof.IssuedAt,
		Nonce:             proof.Nonce,
		Signature:         proof.Signature,
		EdgeId:            edgeID,
		EnrollmentSecret:  strings.TrimSpace(enrollmentSecret),
		IdentityPublicKey: publicKey,
		IdentityKeyId:     edgeIdentity.KeyID(),
	})
	if err := apierror.CheckResponse(completeEnrollmentOperation, result, err); err != nil {
		return err
	}
	enrolled := result.JSON200
	if enrolled == nil || enrolled.EdgeId != edgeID || enrolled.CredentialGeneration < 1 {
		return errors.New("complete Edge enrollment returned an invalid response")
	}
	return nil
}
