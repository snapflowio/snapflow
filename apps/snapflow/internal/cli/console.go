// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package cli

import (
	"errors"
	"io"

	"github.com/charmbracelet/colorprofile"
	"github.com/snapflowio/snapflow/internal/cli/style"
)

type ConsoleConfig struct {
	In      io.Reader
	Out     io.Writer
	Err     io.Writer
	NoColor bool
	Environ []string
}

type Console struct {
	In          io.Reader
	Out         io.Writer
	Err         io.Writer
	Theme       style.Theme
	Profile     colorprofile.Profile
	Interactive bool
}

func NewConsole(cfg ConsoleConfig) (*Console, error) {
	if cfg.In == nil || cfg.Out == nil || cfg.Err == nil {
		return nil, errors.New("console input, output, and error streams are required")
	}
	output := style.OutputConfig{NoColor: cfg.NoColor, Environ: cfg.Environ}
	out := style.NewWriter(cfg.Out, output)
	return &Console{
		In:          cfg.In,
		Out:         out,
		Err:         style.NewWriter(cfg.Err, output),
		Theme:       style.New(style.DarkBackground(cfg.In, cfg.Out)),
		Profile:     out.Profile,
		Interactive: style.IsTerminal(cfg.In) && style.IsTerminal(cfg.Out),
	}, nil
}
