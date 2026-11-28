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

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const enrollDevelopmentMachineOperation = "enroll the development machine"

type DevelopmentEnrollment struct {
	APIURL  string
	Name    string
	Secret  string
	Version string
}

func EnrollDevelopment(ctx context.Context, enrollment DevelopmentEnrollment, keys state.EnrollmentKeys) (*state.Identity, error) {
	if enrollment.Secret == "" {
		return nil, errors.New("development enrollment requires the shared enrollment secret")
	}
	client, err := prepareEnrollment(ctx, enrollment.APIURL, enrollment.Name, enrollment.Version, keys)
	if err != nil {
		return nil, err
	}
	response, err := client.api.EnrollDevelopmentMachineWithResponse(ctx,
		&apiclient.EnrollDevelopmentMachineParams{XSnapflowDevelopmentEnrollmentSecret: enrollment.Secret}, client.proof)
	enrolled, err := apierror.Decode(enrollDevelopmentMachineOperation, response, err,
		(*apiclient.EnrollDevelopmentMachineResult).GetJSON200)
	if err != nil {
		return nil, err
	}
	return client.identity(enrolled, keys)
}
