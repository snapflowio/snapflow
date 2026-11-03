// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admin

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/console/update"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/tuf"
)

var ErrDevelopmentMaintenance = errors.New("the development profile is updated with Moon tasks")

type UpdateCheck struct {
	Channel          tuf.Channel `json:"channel"`
	AvailableVersion string      `json:"availableVersion"`
	InstalledVersion string      `json:"installedVersion,omitempty"`
	UpdateAvailable  bool        `json:"updateAvailable"`
}

type MaintenanceConfig struct {
	Profile config.ProfileName
	Channel tuf.Channel
	Service *ServiceManager
	Log     io.Writer
}

func CheckUpdate(profileName config.ProfileName, requested tuf.Channel) (UpdateCheck, error) {
	profile, err := maintenanceProfile(profileName)
	if err != nil {
		return UpdateCheck{}, err
	}
	channel, err := install.SelectChannel(profile, requested)
	if err != nil {
		return UpdateCheck{}, err
	}
	repository, err := profile.RepositoryConfig(nil)
	if err != nil {
		return UpdateCheck{}, err
	}
	client, err := tuf.NewClient(repository)
	if err != nil {
		return UpdateCheck{}, fmt.Errorf("open the signed release channel: %w", err)
	}
	selected, err := client.Resolve(channel)
	if err != nil {
		return UpdateCheck{}, fmt.Errorf("check the signed release channel: %w", err)
	}
	check := UpdateCheck{Channel: channel, AvailableVersion: selected.Version, UpdateAvailable: true}
	journal, err := install.InspectJournal(profile.ReleaseStateRoot)
	if err != nil {
		return UpdateCheck{}, fmt.Errorf("inspect the installed release: %w", err)
	}
	if journal.Active != nil {
		check.InstalledVersion = journal.Active.Version
		check.UpdateAvailable = tuf.CompareVersions(check.AvailableVersion, check.InstalledVersion) > 0
	}
	return check, nil
}

func ApplyUpdate(ctx context.Context, cfg MaintenanceConfig) (update.Result, error) {
	options, err := cfg.updateConfig()
	if err != nil {
		return update.Result{}, err
	}
	return update.Apply(ctx, options)
}

func Rollback(ctx context.Context, cfg MaintenanceConfig) (update.Result, error) {
	options, err := cfg.updateConfig()
	if err != nil {
		return update.Result{}, err
	}
	return update.Rollback(ctx, options)
}

func (cfg MaintenanceConfig) updateConfig() (update.Config, error) {
	if cfg.Service == nil || cfg.Log == nil {
		return update.Config{}, errors.New("the Snapflow service manager and log output are required")
	}
	profile, err := maintenanceProfile(cfg.Profile)
	if err != nil {
		return update.Config{}, err
	}
	configuration, err := config.Load(cfg.Profile)
	if err != nil {
		return update.Config{}, fmt.Errorf("load Snapflow configuration: %w", err)
	}
	return update.Config{
		Profile: profile, Channel: cfg.Channel, StateDirectory: configuration.Machine.StateDirectory,
		Service: cfg.Service, Stdout: cfg.Log, Stderr: cfg.Log,
		SystemFiles: func(ctx context.Context) error {
			return SyncActiveSystemFiles(ctx, profile, cfg.Service.commands, cfg.Log)
		},
	}, nil
}

func maintenanceProfile(name config.ProfileName) (config.Profile, error) {
	if name == config.Development {
		return config.Profile{}, ErrDevelopmentMaintenance
	}
	return config.RuntimeProfile(name)
}
