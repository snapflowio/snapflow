// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package local

import (
	"context"
	"fmt"

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/state"
)

func (result *StatusResult) inspectPaymentHolds(ctx context.Context, cfg *config.Config) {
	if !result.Registration.Registered {
		return
	}
	holds, err := state.InspectPaymentHolds(ctx, cfg.Machine.StateDirectory)
	if err != nil {
		result.fail(fmt.Errorf("read payment holds: %w", err))
		return
	}
	result.PaymentHolds = holds
}
