// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/control"
)

const approvalLabelWidth = 18

type ApprovalConfig struct {
	Code   control.DeviceAuthorization
	ShowQR bool
	Status string
}

func Approval(theme style.Theme, cfg ApprovalConfig) (string, error) {
	label := theme.Secondary.Width(approvalLabelWidth)
	lines := []string{
		theme.Title.Render(text.ApprovalTitle),
		"",
		label.Render(text.ApprovalOpen) + theme.Link.Render(cfg.Code.VerificationURIComplete),
		label.Render(text.ApprovalConfirm) + theme.Brand.Render(cfg.Code.UserCode),
	}
	if cfg.ShowQR {
		code, err := QR(cfg.Code.VerificationURIComplete, theme.Dark)
		if err != nil {
			return "", err
		}
		lines = append(lines, "", code, theme.Muted.Render(text.ApprovalScan))
	}
	if cfg.Status != "" {
		lines = append(lines, "", theme.Secondary.Render(cfg.Status))
	}
	return theme.Panel.Render(Lines(lines...)), nil
}
