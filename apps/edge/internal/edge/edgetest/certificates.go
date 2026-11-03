// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edgetest

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/snapflowio/edge/internal/certs"
)

const (
	certificateFilename     = "edge-server.pem"
	privateKeyFilename      = "edge-server-key.pem"
	authorityFilename       = "client-ca.pem"
	certificatePEMType      = "CERTIFICATE"
	privateKeyPEMType       = "PRIVATE KEY"
	certificateLifetime     = 24 * time.Hour
	certificateBackdate     = time.Minute
	certificateSerial       = 1
	certificateCommonName   = "edgetest"
	privateFileMode         = 0o600
	loopbackCertificateIPv4 = "127.0.0.1"
)

func writeCertificates(t *testing.T, directory string, hosts []string) certs.Config {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate edge test key: %v", err)
	}
	now := time.Now()
	template := &x509.Certificate{
		SerialNumber:          big.NewInt(certificateSerial),
		Subject:               pkix.Name{CommonName: certificateCommonName},
		DNSNames:              hosts,
		IPAddresses:           []net.IP{net.ParseIP(loopbackCertificateIPv4)},
		NotBefore:             now.Add(-certificateBackdate),
		NotAfter:              now.Add(certificateLifetime),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		BasicConstraintsValid: true,
		IsCA:                  true,
	}
	certificateDER, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create edge test certificate: %v", err)
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatalf("encode edge test key: %v", err)
	}
	config := certs.Config{
		CertificateFile:    filepath.Join(directory, certificateFilename),
		PrivateKeyFile:     filepath.Join(directory, privateKeyFilename),
		OriginClientCAFile: filepath.Join(directory, authorityFilename),
		TunnelClientCAFile: filepath.Join(directory, authorityFilename),
	}
	certificatePEM := pem.EncodeToMemory(&pem.Block{Type: certificatePEMType, Bytes: certificateDER})
	writeFile(t, config.CertificateFile, certificatePEM)
	writeFile(t, config.PrivateKeyFile, pem.EncodeToMemory(&pem.Block{Type: privateKeyPEMType, Bytes: keyDER}))
	writeFile(t, config.OriginClientCAFile, certificatePEM)
	return config
}

func writeFile(t *testing.T, path string, payload []byte) {
	t.Helper()
	if err := os.WriteFile(path, payload, privateFileMode); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}
