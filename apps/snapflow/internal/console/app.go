// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"context"
	"errors"
	"io"
	"os"
	"sync"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/spf13/cobra"
)

var ErrAlreadyStarted = errors.New("snapflow command was already started")

type Config struct {
	In      io.Reader
	Out     io.Writer
	Err     io.Writer
	Environ []string
}

type App struct {
	cfg       Config
	options   options
	arguments []string
	noColor   bool
	console   *cli.Console
	mu        sync.Mutex
	started   bool
	cancel    context.CancelFunc
	done      chan struct{}
}

func New(cfg Config, opts ...Option) *App {
	return &App{cfg: cfg, options: newOptions(opts), done: make(chan struct{})}
}

func (application *App) Run(ctx context.Context, arguments []string) error {
	runContext, cancel := context.WithCancel(ctx)
	defer cancel()
	application.mu.Lock()
	if application.started {
		application.mu.Unlock()
		return ErrAlreadyStarted
	}
	application.started = true
	application.arguments = arguments
	application.cancel = cancel
	application.mu.Unlock()
	defer close(application.done)
	root := newRootCommand(application) //nolint:contextcheck // builds cobra commands, which take their context from ExecuteContext at run time
	root.SetArgs(arguments)
	err := root.ExecuteContext(runContext)
	if err != nil {
		application.report(err)
	}
	return err
}

func (application *App) Shutdown(ctx context.Context) error {
	application.mu.Lock()
	started, cancel := application.started, application.cancel
	application.mu.Unlock()
	if !started {
		return nil
	}
	cancel()
	select {
	case <-application.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (application *App) action(command *cobra.Command, body func(*cli.Console) error) func(*cobra.Command, []string) error {
	return func(*cobra.Command, []string) error {
		if err := cli.BindEnvironment(command, os.LookupEnv); err != nil {
			return err
		}
		console, err := application.resolveConsole()
		if err != nil {
			return err
		}
		if err := cli.RequireRoot(invocation(command)); err != nil {
			if console.Interactive {
				return cli.Elevate(console, application.arguments, application.cfg.Environ, err)
			}
			return err
		}
		return body(console)
	}
}

func (application *App) resolveConsole() (*cli.Console, error) {
	if application.console != nil {
		return application.console, nil
	}
	console, err := cli.NewConsole(cli.ConsoleConfig{
		In: application.cfg.In, Out: application.cfg.Out, Err: application.cfg.Err,
		NoColor: application.noColor, Environ: application.cfg.Environ,
	})
	if err != nil {
		return nil, err
	}
	application.console = console
	return console, nil
}
