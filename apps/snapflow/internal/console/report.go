// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"fmt"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/console/view"
)

func (application *App) report(err error) {
	message, hint, show := cli.Report(err)
	if !show {
		return
	}
	console, consoleErr := application.resolveConsole()
	if consoleErr != nil {
		fmt.Fprintln(application.cfg.Err, message)
		return
	}
	fmt.Fprintln(console.Err, view.Failure(console.Theme, message, hint))
}
