// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package certs

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"
)

const reloadInterval = time.Minute

type Config struct {
	CertificateFile    string
	PrivateKeyFile     string
	OriginClientCAFile string
	TunnelClientCAFile string
}

type Reloader struct {
	config    Config
	logger    *slog.Logger
	current   atomic.Pointer[tls.Certificate]
	expiresAt atomic.Int64
	reloadMu  sync.Mutex
}

func Open(config Config, opts ...Option) (*Reloader, error) {
	if config.CertificateFile == "" || config.PrivateKeyFile == "" {
		return nil, errors.New(
			"TLS certificate and private-key files are required",
		)
	}
	reloader := &Reloader{
		config: config,
		logger: newOptions(opts).logger,
	}
	if _, err := reloader.reload(); err != nil {
		return nil, err
	}
	return reloader, nil
}

func (reloader *Reloader) TLSConfig() *tls.Config {
	return &tls.Config{
		MinVersion: tls.VersionTLS13,
		GetCertificate: func(*tls.ClientHelloInfo) (*tls.Certificate, error) {
			certificate := reloader.current.Load()
			if certificate == nil {
				return nil, errors.New("edge TLS certificate is unavailable")
			}
			return certificate, nil
		},
	}
}

func (reloader *Reloader) Run(ctx context.Context) error {
	ticker := time.NewTicker(reloadInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			changed, err := reloader.reload()
			if err != nil {
				reloader.logger.Warn(
					"could not reload edge TLS certificate; retained last-known-good certificate",
					"error",
					err,
				)
				continue
			}
			if changed {
				reloader.logger.Info("reloaded edge TLS certificate")
			}
		}
	}
}

func (reloader *Reloader) ExpiresAt() time.Time {
	return time.Unix(reloader.expiresAt.Load(), 0)
}

func (reloader *Reloader) reload() (bool, error) {
	reloader.reloadMu.Lock()
	defer reloader.reloadMu.Unlock()
	certificate, err := tls.LoadX509KeyPair(
		reloader.config.CertificateFile,
		reloader.config.PrivateKeyFile,
	)
	if err != nil {
		return false, fmt.Errorf("load edge TLS identity: %w", err)
	}
	leaf, err := x509.ParseCertificate(certificate.Certificate[0])
	if err != nil {
		return false, fmt.Errorf("parse edge TLS leaf certificate: %w", err)
	}
	certificate.Leaf = leaf
	current := reloader.current.Load()
	if sameCertificateChain(current, &certificate) {
		return false, nil
	}
	reloader.current.Store(&certificate)
	reloader.expiresAt.Store(leaf.NotAfter.Unix())
	return true, nil
}

func sameCertificateChain(left, right *tls.Certificate) bool {
	if left == nil ||
		right == nil ||
		len(left.Certificate) != len(right.Certificate) {
		return false
	}
	for index := range left.Certificate {
		if !bytes.Equal(left.Certificate[index], right.Certificate[index]) {
			return false
		}
	}
	return len(left.Certificate) > 0
}
