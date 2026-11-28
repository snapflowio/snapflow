// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"fmt"
	"strings"

	"github.com/snapflowio/snapflow/internal/ui/cli/text"
)

const (
	indent          = "  "
	newline         = "\n"
	labelWidth      = 15
	hintPrefix      = "-> "
	bulletPrefix    = "- "
	errorPrefix     = "error: "
	profileOpen     = " ("
	profileClose    = ")"
	headerSeparator = ": "
	promptSuffix    = " "
)

func Header(title, profile string) string {
	return text.Binary + headerSeparator + title + profileOpen + profile + profileClose
}

func Row(label, value string) string {
	return indent + fmt.Sprintf("%-*s", labelWidth, label) + value
}

func Success(message string) string {
	return message
}

func Failure(message, hint string) string {
	rendered := errorPrefix + message
	if hint != "" {
		rendered += newline + hintLine(hint)
	}
	return rendered
}

func hintLine(hint string) string {
	return indent + hintPrefix + hint
}

func Prompt(question string) string {
	return question + promptSuffix + text.PromptChoices + promptSuffix
}

func Lines(lines ...string) string {
	return strings.Join(lines, newline)
}

func list(title string, entries []string) []string {
	if len(entries) == 0 {
		return nil
	}
	lines := []string{"", title}
	for _, entry := range entries {
		lines = append(lines, indent+bulletPrefix+entry)
	}
	return lines
}
