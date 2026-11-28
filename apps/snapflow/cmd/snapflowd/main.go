// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package main

import (
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/snapflowio/common-go/pkg/logging"
	"github.com/snapflowio/microvm-go/devices"
	"github.com/snapflowio/microvm-go/jail"
	"github.com/snapflowio/snapflow/internal/agent/daemon"
	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/systemd"
	"github.com/snapflowio/snapflow/internal/ui/cli"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	"github.com/snapflowio/snapflow/internal/workloads/runtime/microvm"
	"github.com/spf13/cobra"
)

var version = "v0.0.0-dev"

const (
	daemonShort        = "Run the private Snapflow service"
	offeredVCPUsFlag   = "offered-vcpus"
	offeredMemoryFlag  = "offered-memory-gib"
	offeredDiskFlag    = "offered-disk-gib"
	maxUnclaimedFlag   = "max-unclaimed-float"
	templateUnusedFlag = "template-max-unused-age"
)

func main() {
	jail.Init()
	devices.Init()
	if err := newDaemonCommand().Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(cli.ExitCode(err))
	}
}

func newDaemonCommand() *cobra.Command {
	selection := cli.ProfileFlags{}
	var offeredVCPUs, offeredMemoryGiB, offeredDiskGiB, maxUnclaimedFloat int64
	var templateMaxUnusedAge time.Duration
	command := &cobra.Command{
		Use:           text.Daemon,
		Short:         daemonShort,
		Version:       version,
		Args:          cobra.NoArgs,
		SilenceErrors: true,
		SilenceUsage:  true,
	}
	command.RunE = func(*cobra.Command, []string) error {
		if err := cli.BindEnvironment(command, os.LookupEnv); err != nil {
			return err
		}
		configuration, err := selection.Config()
		if err != nil {
			return err
		}
		configuration.Runtime.OfferedVCPUs = offeredVCPUs
		configuration.Runtime.OfferedMemoryGiB = offeredMemoryGiB
		configuration.Runtime.OfferedDiskGiB = offeredDiskGiB
		configuration.Runtime.Cache.MaximumUnusedAge = templateMaxUnusedAge
		if err := configuration.Validate(); err != nil {
			return cli.Fail(cli.ExitConfigurationError, err, "")
		}
		configuration.Settlement = config.SettlementConfig{MaxUnclaimedFloat: maxUnclaimedFloat}
		if err := configuration.Settlement.Validate(); err != nil {
			return cli.Fail(cli.ExitConfigurationError, err, "")
		}
		logger := newLogger(configuration.Log.Level)
		machine, err := daemon.New(configuration, daemon.WithLogger(logger), daemon.WithVersion(version))
		if err != nil {
			return err
		}
		ctx, stop := signal.NotifyContext(command.Context(), os.Interrupt, syscall.SIGTERM)
		defer stop()
		return cli.ExitWith(daemon.ExitCode(machine.Run(ctx)))
	}
	selection.Register(command)
	command.Flags().Int64Var(&offeredVCPUs, offeredVCPUsFlag, microvm.AllAdmittable, text.FlagOfferedVCPUs)
	command.Flags().Int64Var(&offeredMemoryGiB, offeredMemoryFlag, microvm.AllAdmittable, text.FlagOfferedMemory)
	command.Flags().Int64Var(&offeredDiskGiB, offeredDiskFlag, microvm.AllAdmittable, text.FlagOfferedDisk)
	command.Flags().Int64Var(&maxUnclaimedFloat, maxUnclaimedFlag, config.DefaultMaxUnclaimedFloat, text.FlagMaxUnclaimed)
	command.Flags().DurationVar(&templateMaxUnusedAge, templateUnusedFlag, config.DefaultCacheMaximumUnusedAge, text.FlagTemplateUnused)
	return command
}

func newLogger(level slog.Level) *slog.Logger {
	journaled, err := systemd.StdoutIsJournal()
	if !journaled {
		logger := logging.SetDefault(logging.Options{Writer: os.Stdout, Level: level})
		if err != nil {
			logger.Warn("Logging in the console format", "error", err)
		}
		return logger
	}
	logger := slog.New(systemd.NewJournalHandler(os.Stdout, level))
	slog.SetDefault(logger)
	return logger
}
