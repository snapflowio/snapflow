// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"context"
	"time"

	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type ReadingStore interface {
	SaveUsageReading(context.Context, state.UsageReading) error
	DeleteUsageReading(context.Context, int64) error
	LoadUsageReadings(context.Context) ([]state.UsageReading, []state.DeadLetter, error)
	LoadUsageChainHead(context.Context, state.UsageChainKey) (string, bool, error)
	AcceptUsageReading(context.Context, int64, state.UsageChainHead) error
	PruneUsageChainHeads(context.Context, time.Time) error
}

type usageAPI interface {
	ListPlacements(context.Context) ([]apiclient.MachineReportablePlacementDto, error)
	Submit(context.Context, apiclient.MachineUsageReceiptDto) error
}
