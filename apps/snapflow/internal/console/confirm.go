// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"bufio"
	"errors"
	"fmt"
	"strings"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/view"
)

var errConfirmationDeclined = errors.New(text.ConfirmationDeclined)

func confirm(console *cli.Console, yes bool, question string) error {
	if yes {
		return nil
	}
	if !console.Interactive {
		return cli.Fail(cli.ExitConfigurationError, errors.New(question), text.ConfirmHint)
	}
	fmt.Fprint(console.Err, view.Prompt(console.Theme, question))
	answer, err := bufio.NewReader(console.In).ReadString('\n')
	if err != nil {
		return fmt.Errorf("read confirmation: %w", err)
	}
	if !text.IsYes(strings.TrimSpace(answer)) {
		return cli.Fail(cli.ExitRuntimeError, errConfirmationDeclined, "")
	}
	return nil
}
