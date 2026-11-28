// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/snapflowio/microvm-go/host"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/network/control"
	"github.com/snapflowio/snapflow/internal/supplychain/release"
	sandboxruntime "github.com/snapflowio/snapflow/internal/workloads/runtime"
	"github.com/snapflowio/snapflow/internal/workloads/runtime/microvm"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

const preflightWarningJoiner = "; "

type foundation struct {
	release   release.VerifiedRelease
	preflight host.PreflightReport
	database  *state.Database
	store     *state.Store
	identity  *state.Identity
	session   *control.Session
	policy    control.ControlPolicy
	policies  *control.PolicyMaintainer
}

func (daemon *Daemon) bootstrap(ctx context.Context) (*foundation, error) {
	ready := &foundation{}
	steps := []startupStep{
		{PhaseAcquireLease, daemon.acquireLease},
		{PhaseApplySettings, daemon.applyHostSettings},
		{PhaseLoadRelease, func() error {
			var err error
			ready.release, err = loadActiveRelease(daemon.cfg.Runtime.ReleaseRoot)
			return err
		}},
		{PhaseHostPreflight, func() error {
			var err error
			ready.preflight, err = daemon.preflight(ctx, ready.release)
			return err
		}},
		{PhaseOpenState, func() error { return daemon.openState(ctx, ready) }},
		{PhaseLoadIdentity, func() error { return daemon.loadIdentity(ctx, ready) }},
		{PhaseCreateSession, func() error {
			if err := daemon.openSession(ctx, ready); err != nil {
				return err
			}
			daemon.reportUpdateStatus(ctx)
			return nil
		}},
		{PhaseResolvePolicy, func() error { return daemon.resolvePolicy(ctx, ready) }},
	}
	if err := daemon.runSteps(steps); err != nil {
		return nil, err
	}
	return ready, nil
}

func (daemon *Daemon) acquireLease() error {
	lease, err := install.AcquireMachineLease(daemon.cfg.Runtime.ManagementRuntimeRoot)
	if err != nil {
		return fmt.Errorf("acquire the single Snapflow process lease: %w", err)
	}
	daemon.closers.push("Snapflow process lease", lease.Close)
	return nil
}

func (daemon *Daemon) preflight(ctx context.Context, verified release.VerifiedRelease) (host.PreflightReport, error) {
	report, err := microvm.HostPreflight(ctx, daemon.cfg.Runtime.DataDirectory, verified.Assets.MkfsErofs)
	if err != nil {
		return host.PreflightReport{}, err
	}
	if err := sandboxruntime.RequireHost(report); err != nil {
		return host.PreflightReport{}, err
	}
	if !report.FirecrackerTemplateAvailable {
		daemon.logger.Warn(
			"Prepared Firecracker templates are unavailable; sandboxes will use cold boot",
			"reason", strings.Join(report.Warnings, preflightWarningJoiner),
		)
	}
	return report, nil
}

func (daemon *Daemon) openState(ctx context.Context, ready *foundation) error {
	stateDirectory := daemon.cfg.Machine.StateDirectory
	database, err := state.OpenDatabase(ctx, stateDirectory)
	if err != nil {
		return err
	}
	closeContext := context.WithoutCancel(ctx)
	daemon.closers.push("Snapflow state", func() error { return database.Close(closeContext) })
	vault, err := state.NewPlatformVault(stateDirectory)
	if err != nil {
		return fmt.Errorf("open machine credential vault: %w", err)
	}
	store, err := state.NewStore(state.StoreConfig{Database: database, Vault: vault})
	if err != nil {
		return fmt.Errorf("initialize machine identity: %w", err)
	}
	ready.database, ready.store = database, store
	return nil
}

func (daemon *Daemon) loadIdentity(ctx context.Context, ready *foundation) error {
	identity, err := ready.store.Load(ctx)
	if secret := daemon.developmentEnrollmentSecret(); secret != "" {
		identity, err = daemon.enrollDevelopmentIdentity(ctx, ready.store, secret, identity, err)
	}
	if err != nil {
		return fmt.Errorf("load machine identity; enroll with the same profile or state directory: %w", err)
	}
	if err := daemon.cfg.Profile.ValidateAPIURL(identity.APIURL); err != nil {
		return fmt.Errorf("registered control plane does not match the selected profile: %w", err)
	}
	ready.identity = identity
	return nil
}

func (daemon *Daemon) openSession(ctx context.Context, ready *foundation) error {
	client, err := control.NewForIdentity(ready.identity, control.WithTransport(otelhttp.NewTransport(http.DefaultTransport)))
	if err != nil {
		return fmt.Errorf("configure control-plane client: %w", err)
	}
	machineSession, err := control.CreateSession(ctx, client, ready.identity.MachineID, control.WithLogger(daemon.logger))
	if err != nil {
		return err
	}
	daemon.client, ready.session = client, machineSession
	closeContext := context.WithoutCancel(ctx)
	daemon.closers.push("machine session", func() error {
		revokeContext, cancel := context.WithTimeout(closeContext, daemon.cfg.Health.Timeout)
		defer cancel()
		return machineSession.Close(revokeContext)
	})
	return nil
}

func (daemon *Daemon) resolvePolicy(ctx context.Context, ready *foundation) error {
	production := daemon.cfg.Profile.ProductionSecurity
	resolved, err := control.ResolvePolicy(ctx, daemon.client, production)
	if err != nil {
		return fmt.Errorf("resolve authenticated machine control policy: %w", err)
	}
	if err := daemon.cfg.Profile.ValidateGuestRegistry(resolved.GuestRegistryURL, ready.release.Manifest.Guest.Reference); err != nil {
		return fmt.Errorf("machine control policy guest registry does not match the installed profile release: %w", err)
	}
	policies, err := control.NewPolicyMaintainer(daemon.client, production, resolved, control.WithLogger(daemon.logger))
	if err != nil {
		return err
	}
	ready.policy, ready.policies = resolved, policies
	return nil
}
