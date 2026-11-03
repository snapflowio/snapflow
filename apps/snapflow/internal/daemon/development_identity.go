// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"crypto/ed25519"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/state"
)

// developmentEnrollmentSecret is read from the environment at use so the configuration never holds it;
// it is empty outside the development profile.
func (daemon *Daemon) developmentEnrollmentSecret() string {
	if daemon.cfg.Profile.Name != config.Development {
		return ""
	}
	return strings.TrimSpace(os.Getenv(config.DevelopmentEnrollmentSecretEnvironment))
}

// enrollDevelopmentIdentity reconciles the stored identity with the local control plane on every
// start, so a development database reset or an unreadable key re-enrolls instead of stopping startup.
func (daemon *Daemon) enrollDevelopmentIdentity(
	ctx context.Context,
	store *state.Store,
	secret string,
	stored *state.Identity,
	loadErr error,
) (*state.Identity, error) {
	signingKey, err := developmentSigningKey(stored, loadErr)
	if err != nil {
		return nil, err
	}
	enrolled, err := control.EnrollDevelopment(ctx, control.DevelopmentEnrollment{
		APIURL:  daemon.cfg.Profile.APIURL,
		Name:    config.DevelopmentMachineName,
		Secret:  secret,
		Version: daemon.options.version,
	}, signingKey)
	if err != nil {
		return nil, fmt.Errorf("enroll the development machine: %w", err)
	}
	if sameRegistration(stored, enrolled) {
		return stored, nil
	}
	if err := store.Save(ctx, enrolled); err != nil {
		return nil, fmt.Errorf("save the development machine identity: %w", err)
	}
	daemon.logger.Info("Enrolled the development machine", "machineId", enrolled.MachineID, "ownerId", enrolled.OwnerID)
	return enrolled, nil
}

func developmentSigningKey(stored *state.Identity, loadErr error) (ed25519.PrivateKey, error) {
	switch {
	case loadErr == nil:
		return stored.SigningKey, nil
	case errors.Is(loadErr, state.ErrNotRegistered), errors.Is(loadErr, state.ErrIdentityKeyUnavailable):
		_, signingKey, err := state.GenerateSigningKey()
		return signingKey, err
	default:
		return nil, loadErr
	}
}

func sameRegistration(stored, enrolled *state.Identity) bool {
	return stored != nil && stored.APIURL == enrolled.APIURL && stored.MachineID == enrolled.MachineID &&
		stored.OwnerID == enrolled.OwnerID && stored.KeyID == enrolled.KeyID
}
