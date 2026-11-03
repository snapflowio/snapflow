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

	"github.com/google/uuid"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/localapi"
	"github.com/snapflowio/snapflow/internal/sshgateway"
	"github.com/snapflowio/snapflow/internal/tunnel"
)

func (daemon *Daemon) prepareSSHGateway(ctx context.Context, prepared *services) error {
	if !daemon.cfg.SSH.Enabled {
		daemon.logger.Info("Internal SSH gateway is disabled in Snapflow configuration")
		return nil
	}
	accessControl, err := sshgateway.NewControlPlane(daemon.client)
	if err != nil {
		return fmt.Errorf("initialize SSH access control: %w", err)
	}
	gateway, err := sshgateway.New(
		sshgateway.Config{Port: daemon.cfg.SSH.Port, HostKeyFile: daemon.cfg.SSH.HostKeyFile},
		sshgateway.Dependencies{Runtime: prepared.runtime, Access: accessControl},
		sshgateway.WithLogger(daemon.logger),
	)
	if err != nil {
		return fmt.Errorf("configure SSH gateway: %w", err)
	}
	if err := gateway.Prepare(ctx); err != nil {
		return fmt.Errorf("bind SSH gateway: %w", err)
	}
	daemon.closers.push("SSH gateway", gateway.Close)
	prepared.sshGateway = gateway
	return nil
}

func (daemon *Daemon) prepareTunnels(
	preparationContext context.Context,
	lifecycleContext context.Context,
	ready *foundation,
	prepared *services,
) error {
	machineID, err := uuid.Parse(ready.identity.MachineID)
	if err != nil {
		return fmt.Errorf("parse registered machine identity: %w", err)
	}
	tunnelControl, err := tunnel.NewControlPlane(daemon.client)
	if err != nil {
		return fmt.Errorf("initialize machine tunnel control: %w", err)
	}
	deps := tunnel.ManagerDependencies{Runtime: prepared.runtime, Control: tunnelControl, BuildLogs: prepared.buildLogs}
	if prepared.sshGateway != nil {
		deps.SSHGateway = prepared.sshGateway
	}
	manager, err := tunnel.NewManager(
		tunnel.ManagerConfig{Session: ready.session.Credentials(), MachineID: machineID},
		deps,
		tunnel.WithLogger(daemon.logger),
	)
	if err != nil {
		return fmt.Errorf("initialize outbound machine tunnels: %w", err)
	}
	if err := manager.Prepare(preparationContext, lifecycleContext); err != nil {
		return fmt.Errorf("prepare outbound machine tunnels: %w", err)
	}
	daemon.closers.push("Edge tunnels", func() error {
		manager.Close()
		return nil
	})
	prepared.tunnels = manager
	return nil
}

func (daemon *Daemon) prepareAPI(ctx context.Context, ready *foundation, prepared *services) error {
	server, err := localapi.New(
		localapi.Config{
			Port:        daemon.cfg.API.Port,
			Development: daemon.cfg.Profile.Name == config.Development,
			Version:     daemon.options.version,
		},
		localapi.Dependencies{
			ConnectionToken: ready.policy.ConnectionToken,
			Metrics:         prepared.metrics,
			Registry:        prepared.registry,
			Runtime:         prepared.runtime,
		},
		localapi.WithLogger(daemon.logger),
	)
	if err != nil {
		return err
	}
	if err := server.Prepare(ctx); err != nil {
		return err
	}
	daemon.closers.push("Snapflow API", server.Close)
	prepared.api = server
	return nil
}
