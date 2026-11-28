// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"context"
	"fmt"

	"github.com/snapflowio/edge/internal/control"
	"github.com/snapflowio/edge/internal/identity"
	"github.com/snapflowio/edge/internal/tlsbundle"
)

func (server *Server) ensureTLSBundle(ctx context.Context) error {
	if tlsbundle.Present(server.config.TLS) {
		return nil
	}
	server.options.logger.Info("no cached TLS bundle; fetching it from the control plane before serving")
	edgeIdentity, err := identity.LoadOrCreate(server.config.StateDir, server.config.EdgeID)
	if err != nil {
		return err
	}
	api, err := control.NewAPIClient(server.config.Control.APIURL)
	if err != nil {
		return err
	}
	session, err := server.establishSession(ctx, api, edgeIdentity)
	if err != nil {
		return err
	}
	client, err := control.NewClient(api, session)
	if err != nil {
		return err
	}
	if err := tlsbundle.Install(ctx, server.config.TLS, client); err != nil {
		return fmt.Errorf("install the edge TLS bundle: %w", err)
	}
	return nil
}

func (server *Server) openTLSSync(assembled *assembly) error {
	syncer, err := tlsbundle.NewSyncer(server.config.TLS, assembled.client, server.options.logger)
	if err != nil {
		return err
	}
	assembled.tlsSync = syncer
	return nil
}
