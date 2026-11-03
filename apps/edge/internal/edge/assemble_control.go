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

	"github.com/snapflowio/edge/internal/certs"
	"github.com/snapflowio/edge/internal/control"
	"github.com/snapflowio/edge/internal/identity"
	"github.com/snapflowio/edge/internal/routes"
)

func (server *Server) openTLS(assembled *assembly) error {
	certificates, err := certs.Open(server.config.TLS, certs.WithLogger(server.options.logger))
	if err != nil {
		return err
	}
	tunnelTLS, err := certificates.TunnelTLSConfig()
	if err != nil {
		return err
	}
	publicTLS, err := certificates.OriginTLSConfig()
	if err != nil {
		return err
	}
	assembled.certificates = certificates
	assembled.tunnelTLS = tunnelTLS
	assembled.publicTLS = publicTLS
	return nil
}

func (server *Server) openControlPlane(ctx context.Context, assembled *assembly) error {
	logger := server.options.logger
	edgeIdentity, err := identity.LoadOrCreate(server.config.StateDir, server.config.EdgeID)
	if err != nil {
		return err
	}
	api, err := control.NewAPIClient(server.config.Control.APIURL)
	if err != nil {
		return err
	}
	session, err := control.Establish(
		ctx,
		api,
		edgeIdentity,
		server.config.Control.EnrollmentSecret,
		control.WithLogger(logger),
	)
	if err != nil {
		return fmt.Errorf("establish Edge control session: %w", err)
	}
	client, err := control.NewClient(api, session)
	if err != nil {
		return err
	}
	store, err := routes.OpenStore(
		server.config.StateDir,
		server.config.EdgeID,
		func() int32 { return session.Credentials().Generation },
		routes.WithLogger(logger),
	)
	if err != nil {
		return err
	}
	assembled.identity = edgeIdentity
	assembled.session = session
	assembled.client = client
	assembled.routes = store
	return nil
}
