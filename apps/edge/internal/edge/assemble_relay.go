// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"context"
	"crypto/tls"
	"fmt"
	"sync/atomic"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/certs"
	"github.com/snapflowio/edge/internal/control"
	"github.com/snapflowio/edge/internal/passthrough"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/statefile"
	"github.com/snapflowio/edge/internal/tunnel"
	"github.com/snapflowio/tunnel-go/transport"
)

type relayAssembly struct {
	certificates *certs.Reloader
	tunnelTLS    *tls.Config
	publicTLS    *tls.Config
	admission    *admit.Controller
	active       atomic.Pointer[control.Session]
	routes       *routes.Store
	tunnels      *tunnel.Registry
	router       *passthrough.Router
	components   registry
}

func (relay *relayAssembly) sessionGeneration() int32 {
	session := relay.active.Load()
	if session == nil {
		return 0
	}
	return session.Credentials().Generation
}

func (server *Server) openRelay() (*relayAssembly, error) {
	relay := &relayAssembly{}
	steps := [...]func() error{
		func() error { return server.openTLS(relay) },
		func() error { return server.openRelayRouting(relay) },
		func() error { return server.openTunnels(relay) },
		func() error { return server.openRouter(relay) },
	}
	for _, step := range steps {
		if err := step(); err != nil {
			return nil, err
		}
	}
	relay.components.register("TLS certificate reload", relay.certificates)
	relay.components.register("admission maintenance", relay.admission)
	relay.components.register("Machine and origin tunnels", relay.tunnels)
	relay.components.register("HTTPS router", relay.router)
	return relay, nil
}

func (server *Server) openRelayRouting(relay *relayAssembly) error {
	admission, err := admit.New()
	if err != nil {
		return err
	}
	store, err := routes.NewStore(
		server.config.EdgeID,
		relay.sessionGeneration,
		routes.WithLogger(server.options.logger),
	)
	if err != nil {
		return err
	}
	relay.admission, relay.routes = admission, store
	return nil
}

func (server *Server) openTunnels(relay *relayAssembly) error {
	edgeID, err := uuid.Parse(server.config.EdgeID)
	if err != nil {
		return fmt.Errorf("parse configured edge ID: %w", err)
	}
	quicServerSecret, err := statefile.LoadOrCreateSecret(
		server.config.StateDir,
		quicServerSecretFile,
		quicServerSecretSize,
	)
	if err != nil {
		return fmt.Errorf("load QUIC server secret: %w", err)
	}
	serverKeys, err := transport.DeriveServerKeys(quicServerSecret)
	clear(quicServerSecret)
	if err != nil {
		return fmt.Errorf("derive QUIC server keys: %w", err)
	}
	relay.tunnels, err = tunnel.New(server.config.Tunnel, tunnel.Dependencies{
		EdgeID:     edgeID,
		TLS:        relay.tunnelTLS,
		ServerKeys: serverKeys,
		Routes:     relay.routes,
	}, tunnel.WithLogger(server.options.logger))
	return err
}

func (server *Server) openRouter(relay *relayAssembly) error {
	router, err := passthrough.New(server.config.HTTP.HTTPSAddress, server.config.Origin, passthrough.Dependencies{
		Origins:   relay.tunnels,
		Admission: relay.admission,
	}, passthrough.WithLogger(server.options.logger))
	if err != nil {
		return err
	}
	relay.router = router
	return nil
}

func (relay *relayAssembly) drainPlan() drainPlan {
	return drainPlan{
		begin: func(context.Context) {
			relay.admission.BeginDrain()
			relay.tunnels.BeginDrain()
		},
		complete: func() bool {
			return relay.admission.Snapshot().HTTPConnectionActive == 0
		},
		timeout:      drainTimeout,
		pollInterval: drainPollInterval,
	}
}
