// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"context"
	"os"
	"os/exec"

	tea "charm.land/bubbletea/v2"
	"github.com/snapflowio/snapflow/internal/cli/text"
)

const (
	openCommand      = "xdg-open"
	runAsCommand     = "runuser"
	runAsUserFlag    = "-u"
	argumentsEnd     = "--"
	sudoUserVariable = "SUDO_USER"
	displayVariable  = "DISPLAY"
	waylandVariable  = "WAYLAND_DISPLAY"
	sshVariable      = "SSH_CONNECTION"
	rootUserID       = 0
)

func browserOpener(ctx context.Context, lookup func(string) string) func(string) tea.Cmd {
	desktop := (lookup(displayVariable) != "" || lookup(waylandVariable) != "") && lookup(sshVariable) == ""
	if !desktop {
		return func(string) tea.Cmd { return nil }
	}
	sudoUser := lookup(sudoUserVariable)
	return func(url string) tea.Cmd {
		return func() tea.Msg {
			command := exec.CommandContext(ctx, openCommand, url)
			if os.Geteuid() == rootUserID && sudoUser != "" {
				command = exec.CommandContext(ctx, runAsCommand, runAsUserFlag, sudoUser, argumentsEnd, openCommand, url)
			}
			return browserMsg{err: command.Run()}
		}
	}
}

func browserNote(err error) string {
	if err != nil {
		return text.ApprovalBrowserFail
	}
	return text.ApprovalBrowser
}
