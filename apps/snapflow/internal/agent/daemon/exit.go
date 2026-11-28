// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"errors"

	"github.com/snapflowio/snapflow/internal/network/control"
	"github.com/snapflowio/snapflow/internal/ui/cli"
)

func ExitCode(err error) int {
	var failed *PhaseError
	switch {
	case err == nil:
		return cli.ExitSuccess
	case errors.Is(err, control.ErrMachineRemoved):
		return cli.ExitSuccess
	case errors.As(err, &failed):
		return cli.ExitConfigurationError
	default:
		return cli.ExitRuntimeError
	}
}
