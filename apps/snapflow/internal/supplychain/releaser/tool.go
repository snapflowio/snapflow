// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package releaser

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sync"

	"github.com/snapflowio/snapflow/internal/ui/cli"
)

var ErrAlreadyStarted = errors.New("snapflow-release command was already started")

type Config struct {
	In  io.Reader
	Out io.Writer
	Err io.Writer
}

type Tool struct {
	cfg     Config
	options options
	mu      sync.Mutex
	started bool
}

func New(cfg Config, opts ...Option) *Tool {
	return &Tool{cfg: cfg, options: newOptions(opts)}
}

func (tool *Tool) Run(ctx context.Context, arguments []string) error {
	tool.mu.Lock()
	if tool.started {
		tool.mu.Unlock()
		return ErrAlreadyStarted
	}
	tool.started = true
	tool.mu.Unlock()
	root := newRootCommand(tool) //nolint:contextcheck // builds cobra commands, which take their context from ExecuteContext at run time
	root.SetArgs(arguments)
	err := root.ExecuteContext(ctx)
	if err != nil {
		fmt.Fprintln(tool.cfg.Err, err)
	}
	return err
}

func ExitCode(err error) int {
	if err == nil {
		return cli.ExitSuccess
	}
	return cli.ExitRuntimeError
}
