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

	"rsc.io/qr"
)

const (
	qrQuietZone      = 2
	qrModulesPerCell = 2
	glyphNone        = " "
	glyphUpper       = "▀"
	glyphLower       = "▄"
	glyphFull        = "█"
)

func QR(content string, darkTerminal bool) (string, error) {
	code, err := qr.Encode(content, qr.L)
	if err != nil {
		return "", fmt.Errorf("encode QR code: %w", err)
	}
	lit := func(x, y int) bool {
		inside := x >= 0 && y >= 0 && x < code.Size && y < code.Size
		dark := inside && code.Black(x, y)
		return dark != darkTerminal
	}
	var rendered strings.Builder
	for y := -qrQuietZone; y < code.Size+qrQuietZone; y += qrModulesPerCell {
		if y > -qrQuietZone {
			rendered.WriteString(newline)
		}
		for x := -qrQuietZone; x < code.Size+qrQuietZone; x++ {
			rendered.WriteString(halfBlock(lit(x, y), lit(x, y+1)))
		}
	}
	return rendered.String(), nil
}

func halfBlock(upper, lower bool) string {
	switch {
	case upper && lower:
		return glyphFull
	case upper:
		return glyphUpper
	case lower:
		return glyphLower
	default:
		return glyphNone
	}
}
