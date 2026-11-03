// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/snapflowio/common-go/pkg/logging"
	"github.com/snapflowio/microvm-go/devices"
	"github.com/snapflowio/microvm-go/jail"
	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/daemon"
	"github.com/snapflowio/snapflow/internal/runtime/microvm"
	"github.com/spf13/cobra"
)

var version = "v0.0.0-dev"

const (
	daemonShort       = "Run the private Snapflow service"
	offeredVCPUsFlag  = "offered-vcpus"
	offeredMemoryFlag = "offered-memory-gib"
	offeredDiskFlag   = "offered-disk-gib"
)

func main() {
	// Jailed VMMs and GPU memory scrubs start as this binary in their own
	// modes; those paths never reach the daemon command.
	jail.Init()
	devices.Init()
	if err := newDaemonCommand().Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(cli.ExitCode(err))
	}
}

func newDaemonCommand() *cobra.Command {
	selection := cli.ProfileFlags{}
	var offeredVCPUs, offeredMemoryGiB, offeredDiskGiB int64
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
		level, err := logging.ParseLevel(configuration.Log.Level)
		if err != nil {
			logging.SetDefault(logging.Options{Writer: os.Stdout}).Error("Invalid Snapflow configuration", "error", err)
			return cli.ExitWith(cli.ExitConfigurationError)
		}
		logger := logging.SetDefault(logging.Options{Writer: os.Stdout, Level: level})
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
	return command
}
