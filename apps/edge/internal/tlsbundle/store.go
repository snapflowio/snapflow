// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tlsbundle

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/snapflowio/edge/internal/certs"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	directoryMode  fs.FileMode = 0o700
	privateKeyMode fs.FileMode = 0o600
	publicFileMode fs.FileMode = 0o644
)

func Present(config certs.Config) bool {
	for _, path := range files(config) {
		if !regularFile(path) {
			return false
		}
	}
	return true
}

func regularFile(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}

func files(config certs.Config) []string {
	return []string{config.CertificateFile, config.PrivateKeyFile, config.TunnelClientCAFile, config.OriginClientCAFile}
}

func validate(bundle *apiclient.EdgeTlsBundle) error {
	if bundle == nil || bundle.Digest == "" {
		return errors.New("the control plane returned an empty TLS bundle")
	}
	pair, err := tls.X509KeyPair([]byte(bundle.CertificateChain), []byte(bundle.PrivateKey))
	if err != nil {
		return fmt.Errorf("TLS bundle certificate and key do not match: %w", err)
	}
	if len(pair.Certificate) == 0 {
		return errors.New("TLS bundle holds no certificate")
	}
	for name, authority := range map[string]string{
		"tunnel client CA": bundle.TunnelClientCa,
		"origin client CA": bundle.OriginClientCa,
	} {
		if !x509.NewCertPool().AppendCertsFromPEM([]byte(authority)) {
			return fmt.Errorf("TLS bundle %s holds no certificate", name)
		}
	}
	return nil
}

func anchorsChanged(config certs.Config, bundle *apiclient.EdgeTlsBundle) bool {
	return Present(config) && (!sameFile(config.TunnelClientCAFile, bundle.TunnelClientCa) ||
		!sameFile(config.OriginClientCAFile, bundle.OriginClientCa))
}

func write(config certs.Config, bundle *apiclient.EdgeTlsBundle) error {
	if err := validate(bundle); err != nil {
		return err
	}
	directory := filepath.Dir(config.CertificateFile)
	if err := os.MkdirAll(directory, directoryMode); err != nil {
		return fmt.Errorf("create the TLS directory: %w", err)
	}
	for _, entry := range []struct {
		path    string
		content string
		mode    fs.FileMode
	}{
		{config.PrivateKeyFile, bundle.PrivateKey, privateKeyMode},
		{config.CertificateFile, bundle.CertificateChain, publicFileMode},
		{config.TunnelClientCAFile, bundle.TunnelClientCa, publicFileMode},
		{config.OriginClientCAFile, bundle.OriginClientCa, publicFileMode},
	} {
		if err := atomicfile.WriteFile(entry.path, []byte(entry.content), entry.mode); err != nil {
			return fmt.Errorf("write %s: %w", filepath.Base(entry.path), err)
		}
	}
	return nil
}

func sameFile(path, content string) bool {
	current, err := os.ReadFile(path)
	return err == nil && bytes.Equal(current, []byte(content))
}
