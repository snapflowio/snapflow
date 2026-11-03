// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package update

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/tuf"
)

const (
	DefaultDrainTimeout     = 30 * time.Minute
	DefaultReadinessTimeout = 5 * time.Minute
	DefaultPollInterval     = 5 * time.Second
)

type Service interface {
	Start(context.Context, io.Writer, io.Writer) error
	Stop(context.Context, io.Writer, io.Writer) error
}

type Config struct {
	Profile          config.Profile
	Channel          tuf.Channel
	StateDirectory   string
	DrainTimeout     time.Duration
	ReadinessTimeout time.Duration
	PollInterval     time.Duration
	Service          Service
	SystemFiles      func(context.Context) error
	Stdout           io.Writer
	Stderr           io.Writer
}

type Result struct {
	Version string `json:"version"`
	Digest  string `json:"digest"`
	Ready   bool   `json:"ready"`
}

type activation struct {
	candidate      *install.ReleaseRecord
	drainOperation string
	startOperation string
	activate       func(context.Context) (install.ReleaseRecord, error)
}

func Apply(ctx context.Context, cfg Config) (result Result, resultErr error) {
	validated, err := cfg.validate()
	if err != nil {
		return Result{}, err
	}
	controlPlane, err := connectControlPlane(ctx, validated.StateDirectory)
	if err != nil {
		return Result{}, err
	}
	channel, err := install.SelectChannel(validated.Profile, validated.Channel)
	if err != nil {
		return Result{}, errors.Join(err, controlPlane.close(context.WithoutCancel(ctx)))
	}
	candidate, err := install.Stage(ctx, validated.Profile, channel)
	if err != nil {
		return Result{}, errors.Join(
			fmt.Errorf("stage verified Snapflow update: %w", err),
			controlPlane.close(context.WithoutCancel(ctx)),
		)
	}
	defer func() {
		resultErr = errors.Join(resultErr, candidate.Cleanup())
		resultErr = controlPlane.finish(ctx, validated, resultErr)
	}()
	candidateRecord := install.ReleaseRecord{
		Digest: candidate.Digest, Channel: candidate.Channel, Version: candidate.Version,
		InstalledAt: time.Now().UTC(),
	}
	if err := controlPlane.publishStatus(ctx, validated.Profile, PhaseStaged, &candidateRecord, ""); err != nil {
		return Result{}, err
	}
	return transact(ctx, validated, controlPlane, activation{
		candidate:      &candidateRecord,
		drainOperation: "request Snapflow update drain",
		startOperation: "start updated machine",
		activate: func(activationContext context.Context) (install.ReleaseRecord, error) {
			record, err := install.Activate(activationContext, validated.Profile, candidate)
			if err != nil {
				return install.ReleaseRecord{}, fmt.Errorf("install verified Snapflow update: %w", err)
			}
			return record, nil
		},
	})
}

func Rollback(ctx context.Context, cfg Config) (result Result, resultErr error) {
	validated, err := cfg.validate()
	if err != nil {
		return Result{}, err
	}
	controlPlane, err := connectControlPlane(ctx, validated.StateDirectory)
	if err != nil {
		return Result{}, err
	}
	defer func() {
		resultErr = controlPlane.finish(ctx, validated, resultErr)
	}()
	return transact(ctx, validated, controlPlane, activation{
		drainOperation: "request Snapflow rollback drain",
		startOperation: "start rolled-back machine",
		activate: func(activationContext context.Context) (install.ReleaseRecord, error) {
			manager, err := install.New(install.ProfileConfig(validated.Profile))
			if err != nil {
				return install.ReleaseRecord{}, err
			}
			return manager.Rollback(activationContext)
		},
	})
}

func transact(ctx context.Context, cfg Config, controlPlane *controlPlaneConnection, change activation) (Result, error) {
	if err := controlPlane.drain(ctx, cfg, change); err != nil {
		return Result{}, err
	}
	if err := cfg.Service.Stop(ctx, cfg.Stdout, cfg.Stderr); err != nil {
		return Result{}, fmt.Errorf("stop drained Snapflow service: %w", err)
	}
	if err := controlPlane.publishStatus(ctx, cfg.Profile, PhaseActivating, change.candidate, ""); err != nil {
		return Result{}, restoreService(ctx, cfg, controlPlane, false, err)
	}
	record, err := change.activate(ctx)
	if err != nil {
		return Result{}, restoreService(ctx, cfg, controlPlane, false, err)
	}
	if err := cfg.SystemFiles(ctx); err != nil {
		return Result{}, restoreService(ctx, cfg, controlPlane, true, err)
	}
	controlPlane.handoff()
	if err := cfg.Service.Start(ctx, cfg.Stdout, cfg.Stderr); err != nil {
		return Result{}, restoreService(ctx, cfg, controlPlane, true, fmt.Errorf("%s: %w", change.startOperation, err))
	}
	readinessContext, cancelReadiness := context.WithTimeout(ctx, cfg.ReadinessTimeout)
	err = WaitForReadiness(readinessContext, controlPlane.client, controlPlane.identity.MachineID, cfg.PollInterval)
	cancelReadiness()
	if err != nil {
		return Result{}, restoreService(ctx, cfg, controlPlane, true, err)
	}
	if err := saveStatus(cfg.Profile, PhaseReady, nil, ""); err != nil {
		return Result{}, err
	}
	return Result{Version: record.Version, Digest: record.Digest, Ready: true}, nil
}

func (cfg Config) validate() (Config, error) {
	if cfg.Service == nil || cfg.SystemFiles == nil {
		return Config{}, errors.New("the Snapflow service manager and system file installer are required")
	}
	if cfg.DrainTimeout <= 0 {
		cfg.DrainTimeout = DefaultDrainTimeout
	}
	if cfg.ReadinessTimeout <= 0 {
		cfg.ReadinessTimeout = DefaultReadinessTimeout
	}
	if cfg.PollInterval <= 0 {
		cfg.PollInterval = DefaultPollInterval
	}
	if cfg.Stdout == nil || cfg.Stderr == nil {
		return Config{}, errors.New("the Snapflow update output streams are required")
	}
	return cfg, nil
}

func restoreService(
	ctx context.Context,
	cfg Config,
	controlPlane *controlPlaneConnection,
	rollbackRelease bool,
	cause error,
) error {
	recoveryContext, cancelRecovery := context.WithTimeout(context.WithoutCancel(ctx), cfg.ReadinessTimeout)
	defer cancelRecovery()
	stopErr := cfg.Service.Stop(recoveryContext, cfg.Stdout, cfg.Stderr)
	var rollbackErr error
	if rollbackRelease {
		manager, managerErr := install.New(install.ProfileConfig(cfg.Profile))
		if managerErr != nil {
			return errors.Join(cause, stopErr, managerErr)
		}
		_, rollbackErr = manager.Rollback(recoveryContext)
		if rollbackErr == nil {
			rollbackErr = cfg.SystemFiles(recoveryContext)
		}
	}
	controlErr := controlPlane.openSession(recoveryContext)
	if controlErr == nil {
		controlErr = controlPlane.publishStatus(recoveryContext, cfg.Profile, PhaseActivating, nil, cause.Error())
	}
	controlPlane.handoff()
	startErr := cfg.Service.Start(recoveryContext, cfg.Stdout, cfg.Stderr)
	if recoveryErr := errors.Join(stopErr, rollbackErr, controlErr, startErr); recoveryErr != nil {
		return errors.Join(cause, fmt.Errorf("restore previous Snapflow service: %w", recoveryErr))
	}
	readinessErr := WaitForReadiness(recoveryContext, controlPlane.client, controlPlane.identity.MachineID, cfg.PollInterval)
	if readinessErr != nil {
		return errors.Join(cause, fmt.Errorf("verify restored machine readiness: %w", readinessErr))
	}
	if statusErr := saveStatus(cfg.Profile, PhaseReady, nil, cause.Error()); statusErr != nil {
		return errors.Join(cause, statusErr)
	}
	return fmt.Errorf("the Snapflow update failed and the previous verified release was restored: %w", cause)
}
