// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	tea "charm.land/bubbletea/v2"
	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/control"
)

type SetupRunner interface {
	Phases() []admin.SetupPhase
	Run(context.Context, admin.SetupInteraction) (admin.SetupResult, error)
}

type Config struct {
	Setup      SetupRunner
	Console    *cli.Console
	Profile    string
	Lookup     func(string) string
	ResultJSON io.Writer
}

func (cfg Config) validate() error {
	if cfg.Setup == nil || cfg.Console == nil || cfg.Lookup == nil {
		return errors.New("setup wizard needs a setup run, a console, and an environment lookup")
	}
	return nil
}

func Run(ctx context.Context, cfg Config) error {
	if err := cfg.validate(); err != nil {
		return err
	}
	runContext, cancel := context.WithCancel(ctx)
	defer cancel()
	organizations := make(chan control.Organization, 1)
	program := tea.NewProgram(newModel(modelConfig{
		theme: cfg.Console.Theme, profile: cfg.Profile, phases: cfg.Setup.Phases(), organizations: organizations,
		openBrowser: browserOpener(runContext, cfg.Lookup), now: time.Now,
	}), tea.WithContext(runContext), tea.WithColorProfile(cfg.Console.Profile))
	done := make(chan struct{})
	go func() {
		defer close(done)
		result, err := cfg.Setup.Run(runContext, bridge{
			send: program.Send, organizations: organizations,
		})
		program.Send(setupDoneMsg{result: result, err: err})
	}()
	final, runErr := program.Run()
	cancel()
	<-done
	if runErr != nil {
		return fmt.Errorf("run the setup wizard: %w", runErr)
	}
	current, isModel := final.(model)
	if !isModel {
		return errors.New("setup wizard returned an unexpected model")
	}
	return current.outcome()
}

func (current model) outcome() error {
	switch current.stage {
	case stageDone:
		return nil
	case stageCancelled:
		return cli.ExitWith(cli.ExitInterrupted)
	default:
		return cli.ExitWith(exitCode(current.err))
	}
}

func exitCode(err error) int {
	if errors.Is(err, admin.ErrHostNotReady) {
		return cli.ExitConfigurationError
	}
	return cli.ExitRuntimeError
}
