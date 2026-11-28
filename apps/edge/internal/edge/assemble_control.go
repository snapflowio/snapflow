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
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/reconnect"
)

func (server *Server) openTLS(relay *relayAssembly) error {
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
	relay.certificates = certificates
	relay.tunnelTLS = tunnelTLS
	relay.publicTLS = publicTLS
	return nil
}

func (server *Server) openControlPlane(ctx context.Context, assembled *assembly) error {
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
	assembled.active.Store(session)
	assembled.identity = edgeIdentity
	assembled.session = session
	assembled.client = client
	return nil
}

func (server *Server) establishSession(
	ctx context.Context,
	api *apiclient.ClientWithResponses,
	edgeIdentity *identity.Identity,
) (*control.Session, error) {
	logger := server.options.logger
	backoff := reconnect.DefaultBackoff()
	for {
		session, err := control.Establish(
			ctx,
			api,
			edgeIdentity,
			server.config.Control.EnrollmentSecret,
			control.WithLogger(logger),
		)
		if err == nil {
			return session, nil
		}
		delay := backoff.Next()
		logger.Warn("could not establish the Edge control session; the relay keeps serving", "retry_in", delay, "error", err)
		if !reconnect.Wait(ctx, delay) {
			return nil, fmt.Errorf("establish Edge control session: %w", ctx.Err())
		}
	}
}
