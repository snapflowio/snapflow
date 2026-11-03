// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package certs

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"os"
)

const (
	originClientCADescription = "origin client CA"
	tunnelClientCADescription = "tunnel client CA"
)

func originTLS(source *tls.Config, certificateAuthorityFile string) (*tls.Config, error) {
	return withClientCA(
		source,
		certificateAuthorityFile,
		originClientCADescription,
		tls.VerifyClientCertIfGiven,
	)
}

func tunnelTLS(source *tls.Config, certificateAuthorityFile string) (*tls.Config, error) {
	if certificateAuthorityFile == "" {
		return nil, errors.New("tunnel client CA is required")
	}
	return withClientCA(
		source,
		certificateAuthorityFile,
		tunnelClientCADescription,
		tls.RequireAndVerifyClientCert,
	)
}

func withClientCA(
	source *tls.Config,
	certificateAuthorityFile string,
	description string,
	authentication tls.ClientAuthType,
) (*tls.Config, error) {
	if source == nil {
		return nil, errors.New("source TLS configuration is required")
	}
	secured := source.Clone()
	if certificateAuthorityFile == "" {
		return secured, nil
	}
	payload, err := os.ReadFile(certificateAuthorityFile)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", description, err)
	}
	authorities := x509.NewCertPool()
	if !authorities.AppendCertsFromPEM(payload) {
		return nil, fmt.Errorf("%s contains no valid certificates", description)
	}
	secured.ClientAuth = authentication
	secured.ClientCAs = authorities
	return secured, nil
}

func (reloader *Reloader) OriginTLSConfig() (*tls.Config, error) {
	return originTLS(reloader.TLSConfig(), reloader.config.OriginClientCAFile)
}

func (reloader *Reloader) TunnelTLSConfig() (*tls.Config, error) {
	return tunnelTLS(reloader.TLSConfig(), reloader.config.TunnelClientCAFile)
}
