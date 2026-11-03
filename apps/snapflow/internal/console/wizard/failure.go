// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"errors"

	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/control"
)

type failureHint struct {
	cause error
	hint  func(profile string) string
}

func failureHints() []failureHint {
	return []failureHint{
		{admin.ErrMachineRevoked, text.ReplaceHint},
		{admin.ErrIdentityUnreadable, text.ReplaceHint},
		{control.ErrRegistrationConflict, text.RegistrationConflictHint},
		{control.ErrReplaceForbidden, constantHint(text.ReplaceForbiddenHint)},
		{control.ErrReplaceOtherOrganization, constantHint(text.ReplaceOtherOrganizationHint)},
		{control.ErrUnknownOrganization, constantHint(text.UnknownOrganizationHint)},
		{control.ErrNoActiveOrganization, constantHint(text.NoActiveOrganizationHint)},
		{control.ErrDeviceCodeExpired, text.ApprovalRetryHint},
		{control.ErrDeviceDenied, text.ApprovalRetryHint},
		{control.ErrDeviceGrantInvalid, text.ApprovalRetryHint},
	}
}

func constantHint(hint string) func(string) string {
	return func(string) string { return hint }
}

func hintFor(err error, profile string) string {
	for _, failure := range failureHints() {
		if errors.Is(err, failure.cause) {
			return failure.hint(profile)
		}
	}
	return text.FailedFixPrefix + space + text.ProfileCommand(text.CommandSetup, profile)
}
