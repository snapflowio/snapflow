// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"time"

	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/systemd"
	"github.com/snapflowio/snapflow/internal/supplychain/tuf"
)

type Installer struct {
	profile config.Profile
	systemd systemd.Manager
}

type Status struct {
	Channel tuf.Channel
	Version string
	Service systemd.UnitState
}

func NewInstaller(profile config.Profile, manager systemd.Manager) (*Installer, error) {
	if manager == nil {
		return nil, errors.New("the edge installer needs systemd")
	}
	return &Installer{profile: profile, systemd: manager}, nil
}

func (installer *Installer) Install(ctx context.Context, settings Settings) error {
	if err := settings.Validate(); err != nil {
		return err
	}
	client, err := installer.client()
	if err != nil {
		return err
	}
	selected, err := client.Resolve(tuf.ProductEdge, settings.Channel)
	if err != nil {
		return err
	}
	identity, err := stage(ctx, client, selected)
	if err != nil {
		return err
	}
	if err := activate(identity); err != nil {
		return err
	}
	if err := writeSystemFiles(settings); err != nil {
		return err
	}
	if err := installer.systemd.Reload(ctx); err != nil {
		return fmt.Errorf("reload systemd: %w", err)
	}
	if err := installer.systemd.Enable(ctx, ServiceUnit, UpdateTimerUnit); err != nil {
		return fmt.Errorf("enable the edge units: %w", err)
	}
	if err := installer.restart(ctx); err != nil {
		return err
	}
	if err := installer.systemd.Start(ctx, UpdateTimerUnit); err != nil {
		return fmt.Errorf("start the edge update timer: %w", err)
	}
	if !waitHealthy(ctx) {
		return errors.New("the edge did not start serving HTTPS; check journalctl -u " + ServiceUnit)
	}
	if err := writeState(installedRelease{Channel: settings.Channel, Version: selected.Version, Identity: identity}); err != nil {
		return err
	}
	return prune(identity)
}

func (installer *Installer) Update(ctx context.Context) (bool, error) {
	state, err := readState()
	if err != nil {
		return false, err
	}
	client, err := installer.client()
	if err != nil {
		return false, err
	}
	selected, err := client.Resolve(tuf.ProductEdge, state.Channel)
	if err != nil {
		return false, err
	}
	if tuf.CompareVersions(selected.Version, state.Version) <= 0 {
		return false, nil
	}
	identity, err := stage(ctx, client, selected)
	if err != nil {
		return false, err
	}
	if err := activate(identity); err != nil {
		return false, err
	}
	if err := installer.restart(ctx); err != nil || !waitHealthy(ctx) {
		return false, errors.Join(
			fmt.Errorf("edge %s did not come up healthy; rolled back to %s", selected.Version, state.Version),
			err,
			installer.rollback(ctx, state.Identity),
		)
	}
	updated := installedRelease{Channel: state.Channel, Version: selected.Version, Identity: identity, Previous: state.Identity}
	if err := writeState(updated); err != nil {
		return false, err
	}
	return true, prune(identity, state.Identity)
}

func (installer *Installer) Status(ctx context.Context) (Status, error) {
	state, err := readState()
	if err != nil {
		return Status{}, err
	}
	service, err := installer.systemd.State(ctx, ServiceUnit)
	if err != nil {
		return Status{}, fmt.Errorf("read the edge service state: %w", err)
	}
	return Status{Channel: state.Channel, Version: state.Version, Service: service}, nil
}

func (installer *Installer) client() (*tuf.Client, error) {
	repository, err := installer.profile.RepositoryConfig(nil)
	if err != nil {
		return nil, err
	}
	repository.StateRoot = releaseStateRoot
	return tuf.NewClient(repository)
}

func (installer *Installer) restart(ctx context.Context) error {
	if err := installer.systemd.Stop(ctx, ServiceUnit); err != nil {
		return fmt.Errorf("stop the edge: %w", err)
	}
	if err := installer.systemd.Start(ctx, ServiceUnit); err != nil {
		return fmt.Errorf("start the edge: %w", err)
	}
	return nil
}

func (installer *Installer) rollback(ctx context.Context, identity string) error {
	if err := activate(identity); err != nil {
		return err
	}
	return installer.restart(ctx)
}

func waitHealthy(ctx context.Context) bool {
	deadline := time.Now().Add(healthTimeout)
	for time.Now().Before(deadline) {
		if healthy(ctx, healthAddress, healthPollInterval) {
			return true
		}
		select {
		case <-ctx.Done():
			return false
		case <-time.After(healthPollInterval):
		}
	}
	return false
}

func writeSystemFiles(settings Settings) error {
	if err := os.MkdirAll(path.Dir(environmentFile), privateDirectory); err != nil {
		return fmt.Errorf("create the edge configuration directory: %w", err)
	}
	if err := atomicfile.WriteFile(environmentFile, []byte(settings.environment()), secretMode); err != nil {
		return fmt.Errorf("write the edge environment: %w", err)
	}
	for _, unit := range units() {
		content, err := unitFiles.ReadFile(path.Join("files", unit))
		if err != nil {
			return fmt.Errorf("read the %s unit: %w", unit, err)
		}
		if err := atomicfile.WriteFile(path.Join(unitDirectory, unit), content, unitMode); err != nil {
			return fmt.Errorf("install the %s unit: %w", unit, err)
		}
	}
	return nil
}
