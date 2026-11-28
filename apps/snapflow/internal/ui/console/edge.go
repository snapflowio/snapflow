// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"fmt"
	"os"
	"strings"

	"github.com/snapflowio/snapflow/internal/foundation/systemd"
	"github.com/snapflowio/snapflow/internal/install/edge"
	"github.com/snapflowio/snapflow/internal/supplychain/tuf"
	"github.com/snapflowio/snapflow/internal/ui/cli"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	"github.com/spf13/cobra"
)

const (
	edgeEnrollmentSecretEnvironment = "SNAPFLOW_EDGE_ENROLLMENT_SECRET"
	edgeAPIURLFlag                  = "api-url"
	edgeIDFlag                      = "edge-id"
	edgeOriginSiteFlag              = "origin-site"
	edgeOriginHostsFlag             = "origin-hosts"
	edgeChannelFlag                 = "channel"
)

type edgeInstallOptions struct {
	profile     cli.ProfileFlags
	channel     string
	apiURL      string
	edgeID      string
	originSite  string
	originHosts string
}

func newEdgeCommand(application *App) *cobra.Command {
	help := text.HelpEdge()
	command := &cobra.Command{Use: help.Use, Short: help.Short, Long: help.Long, Args: cobra.NoArgs}
	command.AddCommand(
		newEdgeInstallCommand(application),
		newEdgeUpdateCommand(application),
		newEdgeStatusCommand(application),
	)
	return command
}

func newEdgeInstallCommand(application *App) *cobra.Command {
	options := edgeInstallOptions{channel: string(tuf.StableChannel)}
	help := text.HelpEdgeInstall()
	command := &cobra.Command{Use: help.Use, Short: help.Short, Long: help.Long, Example: help.Example, Args: cobra.NoArgs}
	command.RunE = application.action(command, func(console *cli.Console) error {
		installer, err := newEdgeInstaller(options.profile)
		if err != nil {
			return err
		}
		channel, err := tuf.ParseChannel(options.channel)
		if err != nil {
			return cli.ConfigurationFailure(err)
		}
		settings := edge.Settings{
			Channel:          channel,
			APIURL:           strings.TrimSpace(options.apiURL),
			EdgeID:           strings.TrimSpace(options.edgeID),
			EnrollmentSecret: strings.TrimSpace(os.Getenv(edgeEnrollmentSecretEnvironment)),
			OriginSite:       strings.TrimSpace(options.originSite),
			OriginHosts:      strings.TrimSpace(options.originHosts),
		}
		if err := installer.Install(command.Context(), settings); err != nil {
			return err
		}
		fmt.Fprintf(console.Out, text.EdgeInstalled, channel)
		return nil
	})
	options.profile.Register(command)
	flags := command.Flags()
	flags.StringVar(&options.channel, edgeChannelFlag, options.channel, text.FlagChannel)
	flags.StringVar(&options.apiURL, edgeAPIURLFlag, "", text.FlagEdgeAPIURL)
	flags.StringVar(&options.edgeID, edgeIDFlag, "", text.FlagEdgeID)
	flags.StringVar(&options.originSite, edgeOriginSiteFlag, "", text.FlagEdgeOriginSite)
	flags.StringVar(&options.originHosts, edgeOriginHostsFlag, "", text.FlagEdgeOriginHosts)
	cli.RequireFlags(command, edgeAPIURLFlag, edgeIDFlag)
	return command
}

func newEdgeUpdateCommand(application *App) *cobra.Command {
	var profile cli.ProfileFlags
	help := text.HelpEdgeUpdate()
	command := &cobra.Command{Use: help.Use, Short: help.Short, Long: help.Long, Args: cobra.NoArgs}
	command.RunE = application.action(command, func(console *cli.Console) error {
		installer, err := newEdgeInstaller(profile)
		if err != nil {
			return err
		}
		updated, err := installer.Update(command.Context())
		if err != nil {
			return err
		}
		if !updated {
			fmt.Fprint(console.Out, text.EdgeCurrent)
			return nil
		}
		status, err := installer.Status(command.Context())
		if err != nil {
			return err
		}
		fmt.Fprintf(console.Out, text.EdgeUpdated, status.Version)
		return nil
	})
	profile.Register(command)
	return command
}

func newEdgeStatusCommand(application *App) *cobra.Command {
	var profile cli.ProfileFlags
	help := text.HelpEdgeStatus()
	command := &cobra.Command{Use: help.Use, Short: help.Short, Args: cobra.NoArgs}
	command.RunE = application.action(command, func(console *cli.Console) error {
		installer, err := newEdgeInstaller(profile)
		if err != nil {
			return err
		}
		status, err := installer.Status(command.Context())
		if err != nil {
			return err
		}
		fmt.Fprintf(console.Out, text.EdgeStatusLine, status.Version, status.Channel, status.Service.ActiveState, status.Service.SubState)
		return nil
	})
	profile.Register(command)
	return command
}

func newEdgeInstaller(profile cli.ProfileFlags) (*edge.Installer, error) {
	runtimeProfile, err := profile.Runtime()
	if err != nil {
		return nil, err
	}
	return edge.NewInstaller(runtimeProfile, systemd.Bus{})
}
