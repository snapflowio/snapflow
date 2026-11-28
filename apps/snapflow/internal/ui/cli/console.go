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
	"os"
)

type ConsoleConfig struct {
	In  io.Reader
	Out io.Writer
	Err io.Writer
}

type Console struct {
	In          io.Reader
	Out         io.Writer
	Err         io.Writer
	Interactive bool
}

func NewConsole(cfg ConsoleConfig) (*Console, error) {
	if cfg.In == nil || cfg.Out == nil || cfg.Err == nil {
		return nil, errors.New("console input, output, and error streams are required")
	}
	return &Console{
		In: cfg.In, Out: cfg.Out, Err: cfg.Err,
		Interactive: isTerminal(cfg.In) && isTerminal(cfg.Out),
	}, nil
}

func isTerminal(stream any) bool {
	file, isFile := stream.(*os.File)
	if !isFile {
		return false
	}
	info, err := file.Stat()
	return err == nil && info.Mode()&os.ModeCharDevice != 0
}
