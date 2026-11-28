// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

import (
	"slices"
	"strings"
)

const (
	ConfirmationDeclined   = "cancelled; nothing was changed"
	ConfirmationNoTerminal = "this command asks for confirmation, but no terminal is attached to answer it"
	ConfirmHint            = "rerun with --yes to confirm without a prompt"
	PromptChoices          = "[y/N]"
	UninstallConfirm       = "Uninstall stops Snapflow, ends running sandboxes, and stops listing this machine. Continue?"
	PurgeConfirm           = "--purge also erases this machine's identity, keys, workloads, and releases. Continue?"
	ResetConfirm           = "Reset erases the local development release state. Continue?"
)

const (
	answerYesShort = "y"
	answerYes      = "yes"
)

func IsYes(answer string) bool {
	return slices.Contains([]string{answerYesShort, answerYes}, strings.ToLower(answer))
}
