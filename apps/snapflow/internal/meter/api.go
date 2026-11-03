// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"context"
	"errors"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type generatedUsageAPI struct {
	client *control.Client
}

func (api *generatedUsageAPI) ListPlacements(
	ctx context.Context,
) ([]apiclient.MachineReportablePlacementDto, error) {
	var placements []apiclient.MachineReportablePlacementDto
	cursor := ""
	seenCursors := make(map[string]bool)

	for {
		params := &apiclient.ListMachineUsagePlacementsParams{}
		if cursor != "" {
			params.Cursor = &cursor
		}
		response, err := api.client.ListMachineUsagePlacementsWithResponse(ctx, params)
		page, err := apierror.Decode(
			listPlacementsOperation, response, err, (*apiclient.ListMachineUsagePlacementsResult).GetJSON200,
		)
		if err != nil {
			return nil, err
		}
		placements = append(placements, page.Items...)

		nextCursor := page.NextCursor
		if nextCursor == nil || *nextCursor == "" {
			return placements, nil
		}
		if seenCursors[*nextCursor] {
			return nil, errors.New("list usage placements: API repeated a pagination cursor")
		}
		seenCursors[*nextCursor] = true
		cursor = *nextCursor
	}
}

func (api *generatedUsageAPI) Submit(
	ctx context.Context,
	receipt apiclient.MachineUsageReceiptDto,
) error {
	response, err := api.client.SubmitMachineUsageReceiptWithResponse(ctx, receipt)
	accepted, err := apierror.Decode(
		submitReceiptOperation, response, err, (*apiclient.SubmitMachineUsageReceiptResult).GetJSON202,
	)
	if err != nil {
		return err
	}
	if accepted.PayloadDigest == "" {
		return errors.New("submit usage receipt returned an invalid response")
	}
	return nil
}
