// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package style

import (
	"io"

	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/colorprofile"
	"github.com/charmbracelet/x/term"
)

type OutputConfig struct {
	NoColor bool
	Environ []string
}

func NewWriter(destination io.Writer, cfg OutputConfig) *colorprofile.Writer {
	writer := colorprofile.NewWriter(destination, cfg.Environ)
	if cfg.NoColor && writer.Profile > colorprofile.Ascii {
		writer.Profile = colorprofile.Ascii
	}
	return writer
}

func PlainWriter(destination io.Writer) *colorprofile.Writer {
	return &colorprofile.Writer{Forward: destination, Profile: colorprofile.NoTTY}
}

func IsTerminal(stream any) bool {
	file, ok := stream.(term.File)
	return ok && term.IsTerminal(file.Fd())
}

func DarkBackground(input, output any) bool {
	in, inputOK := input.(term.File)
	out, outputOK := output.(term.File)
	if !inputOK || !outputOK || !term.IsTerminal(in.Fd()) || !term.IsTerminal(out.Fd()) {
		return true
	}
	return lipgloss.HasDarkBackground(in, out)
}
