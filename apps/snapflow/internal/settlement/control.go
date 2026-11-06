// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	fetchVouchersOperation = "fetch machine vouchers"
	entityTagQuote         = `"`
	voucherWait            = control.LongPollWait
)

type VoucherSource interface {
	FetchVouchers(ctx context.Context, digest string) (document *apiclient.MachineVoucherRelay, changed bool, err error)
}

type ControlPlane struct {
	client *control.Client
}

func NewControlPlane(client *control.Client) (*ControlPlane, error) {
	if client == nil {
		return nil, errors.New("voucher control-plane client is required")
	}
	return &ControlPlane{client: client}, nil
}

// FetchVouchers long-polls the voucher document; changed is false when the
// document still has the digest the machine holds.
func (api *ControlPlane) FetchVouchers(
	ctx context.Context,
	digest string,
) (*apiclient.MachineVoucherRelay, bool, error) {
	waitSeconds := int(voucherWait / time.Second)
	params := &apiclient.GetMachineVouchersParams{WaitSeconds: &waitSeconds}
	if digest != "" {
		entityTag := entityTagQuote + digest + entityTagQuote
		params.IfNoneMatch = &entityTag
	}
	response, err := api.client.GetMachineVouchersWithResponse(ctx, params)
	if err == nil && response.StatusCode() == http.StatusNotModified {
		return nil, false, nil
	}
	document, err := apierror.Decode(
		fetchVouchersOperation, response, err, (*apiclient.GetMachineVouchersResult).GetJSON200,
	)
	if err != nil {
		return nil, false, err
	}
	return document, true, nil
}
