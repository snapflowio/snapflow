// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/access"
	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/meter"
	"github.com/snapflowio/edge/internal/proxy"
	httpproxy "github.com/snapflowio/edge/internal/proxy/http"
	"github.com/snapflowio/edge/internal/proxy/tcp"
	"github.com/snapflowio/edge/internal/proxy/udp"
	"github.com/snapflowio/edge/internal/speedtest"
	"github.com/snapflowio/edge/internal/statefile"
	"github.com/snapflowio/edge/internal/tunnel"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	quicServerSecretFile = "quic-server-secret"
	quicServerSecretSize = 32
	accessSigningKeyFile = "protected-access-signing-key"
)

func (server *Server) openProxy(assembled *assembly) error {
	logger := server.options.logger
	usage, err := meter.Open(server.config.StateDir, meter.Dependencies{
		API:     assembled.client,
		Routes:  assembled.routes,
		Signer:  assembled.identity,
		Session: assembled.session,
	}, meter.WithLogger(logger))
	if err != nil {
		return err
	}
	admission, err := admit.New()
	if err != nil {
		return err
	}
	datagrams, err := udp.New(assembled.routes, usage, admission, udp.WithLogger(logger))
	if err != nil {
		return err
	}
	assembled.meter, assembled.admission, assembled.udp = usage, admission, datagrams
	if assembled.tunnels, err = server.openTunnels(assembled); err != nil {
		return err
	}
	if err := datagrams.AttachSender(assembled.tunnels); err != nil {
		return err
	}
	if err := server.openHTTP(assembled); err != nil {
		return err
	}
	streams, err := tcp.New(assembled.routes, assembled.tunnels, usage, admission, tcp.WithLogger(logger))
	if err != nil {
		return err
	}
	ports, err := proxy.NewPorts(assembled.routes, streams, datagrams)
	if err != nil {
		return err
	}
	assembled.tcp, assembled.ports = streams, ports
	return nil
}

func (server *Server) openTunnels(assembled *assembly) (Tunnels, error) {
	if server.options.tunnels != nil {
		return server.options.tunnels, nil
	}
	edgeID, err := uuid.Parse(server.config.EdgeID)
	if err != nil {
		return nil, fmt.Errorf("parse configured edge ID: %w", err)
	}
	quicServerSecret, err := statefile.LoadOrCreateSecret(
		server.config.StateDir,
		quicServerSecretFile,
		quicServerSecretSize,
	)
	if err != nil {
		return nil, fmt.Errorf("load QUIC server secret: %w", err)
	}
	serverKeys, err := transport.DeriveServerKeys(quicServerSecret)
	clear(quicServerSecret)
	if err != nil {
		return nil, fmt.Errorf("derive QUIC server keys: %w", err)
	}
	return tunnel.New(server.config.Tunnel, tunnel.Dependencies{
		EdgeID:     edgeID,
		TLS:        assembled.tunnelTLS,
		ServerKeys: serverKeys,
		Routes:     assembled.routes,
		Receiver:   assembled.udp,
	}, tunnel.WithLogger(server.options.logger))
}

func (server *Server) openHTTP(assembled *assembly) error {
	logger := server.options.logger
	signingKey, err := statefile.LoadOrCreateSecret(
		server.config.StateDir,
		accessSigningKeyFile,
		access.SigningKeyBytes,
	)
	if err != nil {
		return fmt.Errorf("load protected access signing key: %w", err)
	}
	defer clear(signingKey)
	speedtestHandler, err := speedtest.New(
		assembled.identity,
		assembled.client,
		speedtest.WithLogger(logger),
	)
	if err != nil {
		return err
	}
	sessions := access.NewSessions()
	gate, err := access.NewGate(assembled.client, signingKey, sessions, access.WithLogger(logger))
	if err != nil {
		return err
	}
	frontend, err := httpproxy.New(server.config.HTTP, httpproxy.Dependencies{
		TLS:                  assembled.publicTLS,
		Routes:               assembled.routes,
		Streams:              assembled.tunnels,
		Meter:                assembled.meter,
		Access:               gate,
		Admission:            assembled.admission,
		Speedtest:            speedtestHandler,
		SpeedtestConnContext: speedtest.ConnContext,
	}, httpproxy.WithLogger(logger))
	if err != nil {
		return err
	}
	assembled.sessions, assembled.http = sessions, frontend
	return nil
}
