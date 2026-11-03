// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package cli

import (
	"fmt"

	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/spf13/cobra"
)

const ProfileFlag = "profile"

type ProfileFlags struct {
	name string
}

func (selection *ProfileFlags) Register(command *cobra.Command) {
	command.Flags().StringVar(&selection.name, ProfileFlag, string(config.Production), text.FlagProfile)
	if err := command.Flags().MarkHidden(ProfileFlag); err != nil {
		panic(err)
	}
}

func (selection ProfileFlags) Name() (config.ProfileName, error) {
	return config.ParseProfile(selection.name)
}

func (selection ProfileFlags) Runtime() (config.Profile, error) {
	name, err := selection.Name()
	if err != nil {
		return config.Profile{}, err
	}
	return config.RuntimeProfile(name)
}

func (selection ProfileFlags) Config() (*config.Config, error) {
	name, err := selection.Name()
	if err != nil {
		return nil, err
	}
	configuration, err := config.Load(name)
	if err != nil {
		return nil, fmt.Errorf("load Snapflow configuration: %w", err)
	}
	return configuration, nil
}

func (selection ProfileFlags) StateDirectory() (string, error) {
	configuration, err := selection.Config()
	if err != nil {
		return "", err
	}
	return configuration.Machine.StateDirectory, nil
}

func RequireFlags(command *cobra.Command, names ...string) {
	for _, name := range names {
		if err := command.MarkFlagRequired(name); err != nil {
			panic(err)
		}
	}
}
