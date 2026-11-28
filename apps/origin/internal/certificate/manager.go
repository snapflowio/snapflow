// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package certificate

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/snapflowio/tunnel-go/certrequest"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	certificateTTL         = 10 * time.Minute
	renewalLifetimeDivisor = 2
)

var errNoCertificate = errors.New("no origin tunnel certificate has been issued yet")

type Signer interface {
	Sign(ctx context.Context, csr, identityURI string, ttl time.Duration) (string, error)
}

type Manager struct {
	identity  protocol.OriginCertificateIdentity
	signer    Signer
	logger    *slog.Logger
	current   atomic.Pointer[tls.Certificate]
	ready     chan struct{}
	readyOnce sync.Once
}

func New(site string, signer Signer, logger *slog.Logger) (*Manager, error) {
	identity := protocol.OriginCertificateIdentity{Site: site}
	if err := identity.Validate(); err != nil {
		return nil, err
	}
	if signer == nil || logger == nil {
		return nil, errors.New("origin certificate manager requires a signer and a logger")
	}
	return &Manager{identity: identity, signer: signer, logger: logger, ready: make(chan struct{})}, nil
}

func (manager *Manager) Ready() <-chan struct{} {
	return manager.ready
}

func (manager *Manager) GetClientCertificate(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
	certificate := manager.current.Load()
	if certificate == nil {
		return nil, errNoCertificate
	}
	return certificate, nil
}

func (manager *Manager) Run(ctx context.Context) error {
	backoff := reconnect.DefaultBackoff()
	for {
		certificate, err := manager.issue(ctx)
		if err != nil {
			delay := backoff.Next()
			manager.logger.Warn("could not issue the origin tunnel certificate", "retry_in", delay, "error", err)
			if !reconnect.Wait(ctx, delay) {
				return nil
			}
			continue
		}
		backoff.Reset()
		manager.current.Store(&certificate)
		manager.readyOnce.Do(func() { close(manager.ready) })
		leaf := certificate.Leaf
		renewAt := leaf.NotBefore.Add(leaf.NotAfter.Sub(leaf.NotBefore) / renewalLifetimeDivisor)
		if !reconnect.Wait(ctx, time.Until(renewAt)) {
			return nil
		}
	}
}

func (manager *Manager) issue(ctx context.Context) (tls.Certificate, error) {
	identityURI, err := protocol.OriginIdentityURI(manager.identity)
	if err != nil {
		return tls.Certificate{}, err
	}
	request, err := certrequest.New(identityURI)
	if err != nil {
		return tls.Certificate{}, err
	}
	chain, err := manager.signer.Sign(ctx, request.PEM, identityURI.String(), certificateTTL)
	if err != nil {
		return tls.Certificate{}, err
	}
	certificate, err := request.KeyPair(chain)
	if err != nil {
		return tls.Certificate{}, err
	}
	if err := request.VerifyIssued(certificate); err != nil {
		return tls.Certificate{}, err
	}
	issued, err := protocol.ParseOriginCertificate(certificate.Leaf)
	if err != nil || issued != manager.identity {
		return tls.Certificate{}, fmt.Errorf("issued certificate does not name origin site %q", manager.identity.Site)
	}
	return certificate, nil
}
