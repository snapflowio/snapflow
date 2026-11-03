// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package health

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/readiness"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	healthcheckOperation = "publish machine healthcheck"
	readinessOperation   = "publish machine readiness"
)

type Config struct {
	Version          string
	Interval         time.Duration
	Timeout          time.Duration
	SSHHostPublicKey string
}

type Dependencies struct {
	Client    *control.Client
	Collector readiness.Collector
	Runtime   readiness.Runtime
	Inventory func(context.Context) (*machinev1alpha1.HostInventory, error)
}

type Reporter struct {
	log              *slog.Logger
	interval         time.Duration
	timeout          time.Duration
	collector        readiness.Collector
	client           *control.Client
	runtime          readiness.Runtime
	sshHostPublicKey string
	version          string
	inventory        func(context.Context) (*machinev1alpha1.HostInventory, error)
}

func New(cfg Config, deps Dependencies, opts ...Option) (*Reporter, error) {
	if deps.Client == nil || deps.Runtime == nil || deps.Collector == nil || deps.Inventory == nil || cfg.Version == "" {
		return nil, errors.New("healthcheck control-plane client, runtime, metrics collector, machine inventory, and version are required")
	}
	if cfg.Interval <= 0 || cfg.Timeout <= 0 {
		return nil, errors.New("healthcheck interval and timeout must be positive")
	}
	return &Reporter{
		log:              newOptions(opts).logger.With(slog.String("component", "healthcheck")),
		client:           deps.Client,
		interval:         cfg.Interval,
		timeout:          cfg.Timeout,
		collector:        deps.Collector,
		runtime:          deps.Runtime,
		sshHostPublicKey: cfg.SSHHostPublicKey,
		version:          cfg.Version,
		inventory:        deps.Inventory,
	}, nil
}

func (s *Reporter) Run(ctx context.Context) error {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			s.log.InfoContext(ctx, "Healthcheck loop stopped")
			return nil
		case <-ticker.C:
			if err := s.ReportReady(ctx); err != nil {
				s.log.WarnContext(ctx, "Failed to send healthcheck", "error", err)
			}
		}
	}
}

func (s *Reporter) ReportReady(ctx context.Context) error {
	requestContext, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	hostInventory, err := s.inventory(requestContext)
	if err != nil {
		return fmt.Errorf("collect the host inventory: %w", err)
	}
	healthcheck, err := readiness.BuildPayload(requestContext, readiness.PayloadConfig{
		State: apiclient.MachineReadinessStateReady, Version: s.version,
		Runtime: s.runtime, Collector: s.collector, SSHHostPublicKey: s.sshHostPublicKey,
		InventoryDigest: hostInventory.GetInventoryDigest(),
	})
	if err != nil {
		return err
	}
	response, err := s.client.MachineHealthcheckWithResponse(requestContext, healthcheck)
	if err := apierror.CheckResponse(healthcheckOperation, response, err); err != nil {
		return err
	}
	s.log.DebugContext(requestContext, "Healthcheck sent successfully")
	return nil
}

func ReportReadiness(
	ctx context.Context,
	client *control.Client,
	version string,
	state apiclient.MachineReadinessState,
	reason string,
) error {
	response, err := client.MachineHealthcheckWithResponse(ctx, readiness.Healthcheck(version, state, reason))
	return apierror.CheckResponse(readinessOperation, response, err)
}
