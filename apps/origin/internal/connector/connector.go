// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package connector

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"os"
	"sync"
	"sync/atomic"

	"github.com/google/uuid"
	"github.com/snapflowio/origin/internal/config"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/reconnect"
	"github.com/snapflowio/tunnel-go/transport"
)

const (
	maxConcurrentStreams = 4096
	sessionCloseCode     = 0
	sessionCloseReason   = "origin connector session closed"
)

type Certificates interface {
	Ready() <-chan struct{}
	GetClientCertificate(*tls.CertificateRequestInfo) (*tls.Certificate, error)
}

type Connector struct {
	site      string
	edges     []string
	upstream  string
	tls       *tls.Config
	ready     <-chan struct{}
	logger    *slog.Logger
	connected atomic.Int32
	streams   chan struct{}
}

func New(settings config.Config, certificates Certificates, logger *slog.Logger) (*Connector, error) {
	if certificates == nil || logger == nil {
		return nil, errors.New("origin connector requires certificates and a logger")
	}
	roots, err := edgeRoots(settings.EdgeCertificateAuthority)
	if err != nil {
		return nil, err
	}
	return &Connector{
		site:     settings.Site,
		edges:    settings.Edges,
		upstream: settings.Upstream,
		tls: &tls.Config{
			MinVersion:           tls.VersionTLS13,
			RootCAs:              roots,
			GetClientCertificate: certificates.GetClientCertificate,
		},
		ready:   certificates.Ready(),
		logger:  logger,
		streams: make(chan struct{}, maxConcurrentStreams),
	}, nil
}

func edgeRoots(extraAuthorityFile string) (*x509.CertPool, error) {
	roots, err := x509.SystemCertPool()
	if err != nil {
		return nil, fmt.Errorf("load edge trust roots: %w", err)
	}
	if extraAuthorityFile == "" {
		return roots, nil
	}
	authority, err := os.ReadFile(extraAuthorityFile)
	if err != nil {
		return nil, fmt.Errorf("read edge certificate authority: %w", err)
	}
	if !roots.AppendCertsFromPEM(authority) {
		return nil, errors.New("edge certificate authority file holds no PEM certificate")
	}
	return roots, nil
}

func (connector *Connector) ConnectedEdges() int32 {
	return connector.connected.Load()
}

func (connector *Connector) Run(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return nil
	case <-connector.ready:
	}
	var supervisors sync.WaitGroup
	for _, address := range connector.edges {
		supervisors.Go(func() { connector.superviseEdge(ctx, address) })
	}
	supervisors.Wait()
	return nil
}

func (connector *Connector) superviseEdge(ctx context.Context, address string) {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		connector.logger.Error("invalid edge tunnel address", "edge", address, "error", err)
		return
	}
	tlsConfig := connector.tls.Clone()
	tlsConfig.ServerName = host
	dialer := transport.NewDialer()
	backoff := reconnect.DefaultBackoff()
	for ctx.Err() == nil {
		err := connector.runSession(ctx, dialer, address, tlsConfig, &backoff)
		if ctx.Err() != nil {
			return
		}
		delay := backoff.Next()
		connector.logger.Warn("origin tunnel to edge ended", "edge", address, "retry_in", delay, "error", err)
		if !reconnect.Wait(ctx, delay) {
			return
		}
	}
}

func (connector *Connector) runSession(
	ctx context.Context,
	dialer *transport.Dialer,
	address string,
	tlsConfig *tls.Config,
	backoff *reconnect.Backoff,
) (resultErr error) {
	session, err := dialer.Dial(ctx, address, tlsConfig, transport.DefaultClientConfig())
	if err != nil {
		return err
	}
	defer func() {
		resultErr = errors.Join(resultErr, session.Close(sessionCloseCode, sessionCloseReason))
	}()
	control, hello, err := session.ClientHandshake(ctx, protocol.ClientHello{
		Version:    protocol.Version,
		Principal:  protocol.PrincipalOrigin,
		OriginSite: connector.site,
		SessionID:  uuid.New(),
	})
	if err != nil {
		return fmt.Errorf("origin tunnel handshake: %w", err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, control.Close())
	}()
	backoff.Reset()
	connector.connected.Add(1)
	defer connector.connected.Add(-1)
	connector.logger.Info("origin tunnel connected", "edge", address, "edge_id", hello.EdgeID, "transport", session.TransportName())
	return connector.acceptStreams(ctx, session)
}

func (connector *Connector) acceptStreams(ctx context.Context, session *transport.Session) error {
	for {
		stream, open, err := session.AcceptOriginStream(ctx)
		if err != nil {
			return err
		}
		select {
		case connector.streams <- struct{}{}:
			go connector.serveStream(ctx, stream, open)
		default:
			connector.reject(stream, protocol.StreamOpenStatusTargetCapacity)
		}
	}
}
