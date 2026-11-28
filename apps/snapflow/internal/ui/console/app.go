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

	"github.com/snapflowio/snapflow/internal/ui/cli"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	"github.com/snapflowio/snapflow/internal/ui/console/update"
	"github.com/spf13/cobra"
)

var ErrAlreadyStarted = errors.New("snapflow command was already started")

type Config struct {
	In                io.Reader
	Out               io.Writer
	Err               io.Writer
	Environ           []string
	ReleaseFilesInUse update.ReleaseFilesInUse
}

type App struct {
	cfg       Config
	options   options
	arguments []string
	console   *cli.Console
	mu        sync.Mutex
	started   bool
}

func New(cfg Config, opts ...Option) *App {
	return &App{cfg: cfg, options: newOptions(opts)}
}

func (application *App) Run(ctx context.Context, arguments []string) error {
	application.mu.Lock()
	if application.started {
		application.mu.Unlock()
		return ErrAlreadyStarted
	}
	application.started = true
	application.arguments = arguments
	application.mu.Unlock()
	root := newRootCommand(application) //nolint:contextcheck // builds cobra commands, which take their context from ExecuteContext at run time
	root.SetArgs(arguments)
	failed, err := root.ExecuteContextC(ctx)
	if err != nil {
		err = usageFailure(failed, err)
		application.report(err)
	}
	return err
}

func usageFailure(failed *cobra.Command, err error) error {
	if failed == nil {
		return cli.ConfigurationFailure(err)
	}
	return cli.UsageFailure(err, text.HelpHint(failed.CommandPath()))
}

func (application *App) action(command *cobra.Command, body func(*cli.Console) error) func(*cobra.Command, []string) error {
	return func(*cobra.Command, []string) error {
		if err := cli.BindEnvironment(command, os.LookupEnv); err != nil {
			return cli.Fail(cli.ExitConfigurationError, err, text.HelpHint(command.CommandPath()))
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
		return cli.RuntimeFailure(body(console))
	}
}

func (application *App) resolveConsole() (*cli.Console, error) {
	if application.console != nil {
		return application.console, nil
	}
	console, err := cli.NewConsole(cli.ConsoleConfig{
		In: application.cfg.In, Out: application.cfg.Out, Err: application.cfg.Err,
	})
	if err != nil {
		return nil, err
	}
	application.console = console
	return console, nil
}
