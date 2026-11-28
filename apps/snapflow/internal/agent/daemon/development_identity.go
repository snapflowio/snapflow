// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	"github.com/snapflowio/snapflow/internal/network/control"
)

func (daemon *Daemon) developmentEnrollmentSecret() string {
	if daemon.cfg.Profile.Name != config.Development {
		return ""
	}
	return strings.TrimSpace(os.Getenv(config.DevelopmentEnrollmentSecretEnvironment))
}

func (daemon *Daemon) enrollDevelopmentIdentity(
	ctx context.Context,
	store *state.Store,
	secret string,
	stored *state.Identity,
	loadErr error,
) (*state.Identity, error) {
	keys, err := developmentKeys(stored, loadErr)
	if err != nil {
		return nil, err
	}
	enrolled, err := control.EnrollDevelopment(ctx, control.DevelopmentEnrollment{
		APIURL:  daemon.cfg.Profile.APIURL,
		Name:    config.DevelopmentMachineName,
		Secret:  secret,
		Version: daemon.options.version,
	}, keys)
	if err != nil {
		return nil, fmt.Errorf("enroll the development machine: %w", err)
	}
	if sameRegistration(stored, enrolled) {
		return stored, nil
	}
	if err := store.Save(ctx, enrolled); err != nil {
		return nil, fmt.Errorf("save the development machine identity: %w", err)
	}
	daemon.logger.Info("Enrolled the development machine", "machineId", enrolled.MachineID,
		"organizationId", enrolled.OrganizationID, "hostAddress", enrolled.HostKey)
	return enrolled, nil
}

func developmentKeys(stored *state.Identity, loadErr error) (state.EnrollmentKeys, error) {
	switch {
	case loadErr == nil:
		return stored.EnrollmentKeys(), nil
	case errors.Is(loadErr, state.ErrNotRegistered), errors.Is(loadErr, state.ErrIdentityKeyUnavailable):
		return state.GenerateEnrollmentKeys()
	default:
		return state.EnrollmentKeys{}, loadErr
	}
}

func sameRegistration(stored, enrolled *state.Identity) bool {
	return stored != nil && stored.APIURL == enrolled.APIURL && stored.MachineID == enrolled.MachineID &&
		stored.OrganizationID == enrolled.OrganizationID && stored.KeyID == enrolled.KeyID &&
		stored.HostKey.Address() == enrolled.HostKey.Address()
}
