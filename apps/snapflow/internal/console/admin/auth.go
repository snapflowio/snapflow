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
	"os"

	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/state"
)

type LoginConfig struct {
	Profile            config.ProfileName
	APIURL             string
	Name               string
	Organization       string
	Replace            bool
	OnAuthorization    func(control.DeviceAuthorization)
	ChooseOrganization func(context.Context, control.OrganizationChoice) (control.Organization, error)
	Version            string
}

func Login(ctx context.Context, cfg LoginConfig) (control.RegistrationResult, error) {
	configuration, err := config.Load(cfg.Profile)
	if err != nil {
		return control.RegistrationResult{}, fmt.Errorf("load Snapflow configuration: %w", err)
	}
	stateDirectory := configuration.Machine.StateDirectory
	apiURL := cfg.APIURL
	if apiURL == "" {
		apiURL = configuration.Profile.APIURL
	}
	name, err := machineName(cfg.Name)
	if err != nil {
		return control.RegistrationResult{}, err
	}
	return control.Register(ctx, control.RegistrationConfig{
		Profile: configuration.Profile, StateDirectory: stateDirectory, APIURL: apiURL, Name: name,
		Organization: cfg.Organization, ReplaceExisting: cfg.Replace,
		OnAuthorization: cfg.OnAuthorization, ChooseOrganization: cfg.ChooseOrganization, Version: cfg.Version,
	})
}

func Identity(ctx context.Context, cfg *config.Config) (RegistrationStatus, error) {
	inspection, err := state.Inspect(ctx, cfg.Machine.StateDirectory)
	if errors.Is(err, state.ErrNotRegistered) {
		return RegistrationStatus{}, nil
	}
	if err != nil {
		return RegistrationStatus{}, fmt.Errorf("inspect machine registration: %w", err)
	}
	return registrationStatus(inspection), nil
}

func machineName(override string) (string, error) {
	if override != "" {
		return override, nil
	}
	name, err := os.Hostname()
	if err != nil {
		return "", fmt.Errorf("resolve this machine's hostname: %w", err)
	}
	return name, nil
}
