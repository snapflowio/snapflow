// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package certs

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestClientCAErrorsIdentifyTrustDomain(t *testing.T) {
	t.Parallel()
	missingCA := filepath.Join(t.TempDir(), "missing.pem")
	_, tunnelErr := tunnelTLS(&tls.Config{}, missingCA)
	if tunnelErr == nil || !strings.Contains(tunnelErr.Error(), tunnelClientCADescription) {
		t.Fatalf("tunnel CA error = %v", tunnelErr)
	}
	_, originErr := originTLS(&tls.Config{}, missingCA)
	if originErr == nil || !strings.Contains(originErr.Error(), originClientCADescription) {
		t.Fatalf("origin CA error = %v", originErr)
	}
}

func TestReloaderRotatesAtomicallyAndRetainsLastKnownGoodCertificate(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	certificateFile := filepath.Join(directory, "certificate.pem")
	privateKeyFile := filepath.Join(directory, "private-key.pem")
	firstExpiry := time.Now().Add(time.Hour).UTC().Truncate(time.Second)
	writeTestIdentity(t, certificateFile, privateKeyFile, 1, firstExpiry)
	reloader, err := Open(Config{CertificateFile: certificateFile, PrivateKeyFile: privateKeyFile})
	if err != nil {
		t.Fatalf("open certificate reloader: %v", err)
	}
	assertReloadedSerial(t, reloader, 1)
	if !reloader.ExpiresAt().Equal(firstExpiry) {
		t.Fatalf("certificate expiry = %s, want %s", reloader.ExpiresAt(), firstExpiry)
	}

	secondExpiry := firstExpiry.Add(time.Hour)
	writeTestIdentity(t, certificateFile, privateKeyFile, 2, secondExpiry)
	changed, err := reloader.reload()
	if err != nil || !changed {
		t.Fatalf("reload rotated certificate: changed=%t error=%v", changed, err)
	}
	assertReloadedSerial(t, reloader, 2)
	if !reloader.ExpiresAt().Equal(secondExpiry) {
		t.Fatalf("rotated certificate expiry = %s, want %s", reloader.ExpiresAt(), secondExpiry)
	}

	if err := os.WriteFile(privateKeyFile, []byte("invalid private key"), 0o600); err != nil {
		t.Fatalf("write invalid private key: %v", err)
	}
	if changed, err := reloader.reload(); err == nil || changed {
		t.Fatalf("invalid rotation changed=%t error=%v", changed, err)
	}
	assertReloadedSerial(t, reloader, 2)
}

func TestReloaderPicksUpIdentityReplacedByRename(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	certificateFile := filepath.Join(directory, "fullchain.pem")
	privateKeyFile := filepath.Join(directory, "private-key.pem")
	expiry := time.Now().Add(time.Hour).UTC().Truncate(time.Second)
	writeTestIdentity(t, certificateFile, privateKeyFile, 1, expiry)
	reloader, err := Open(Config{CertificateFile: certificateFile, PrivateKeyFile: privateKeyFile})
	if err != nil {
		t.Fatalf("open certificate reloader: %v", err)
	}
	assertReloadedSerial(t, reloader, 1)

	renewedCertificateFile := filepath.Join(directory, "fullchain.pem.renewed")
	renewedPrivateKeyFile := filepath.Join(directory, "private-key.pem.renewed")
	writeTestIdentity(t, renewedCertificateFile, renewedPrivateKeyFile, 2, expiry.Add(time.Hour))
	if err := os.Rename(renewedCertificateFile, certificateFile); err != nil {
		t.Fatalf("rename renewed certificate: %v", err)
	}
	if changed, err := reloader.reload(); err == nil || changed {
		t.Fatalf("mismatched certificate and key changed=%t error=%v", changed, err)
	}
	assertReloadedSerial(t, reloader, 1)

	if err := os.Rename(renewedPrivateKeyFile, privateKeyFile); err != nil {
		t.Fatalf("rename renewed private key: %v", err)
	}
	changed, err := reloader.reload()
	if err != nil || !changed {
		t.Fatalf("reload renamed identity: changed=%t error=%v", changed, err)
	}
	assertReloadedSerial(t, reloader, 2)
}

func assertReloadedSerial(t *testing.T, reloader *Reloader, expected int64) {
	t.Helper()
	certificate, err := reloader.TLSConfig().GetCertificate(nil)
	if err != nil {
		t.Fatalf("get active certificate: %v", err)
	}
	if certificate.Leaf == nil || certificate.Leaf.SerialNumber.Int64() != expected {
		t.Fatalf("active certificate serial = %#v, want %d", certificate.Leaf, expected)
	}
}

func writeTestIdentity(
	t *testing.T,
	certificateFile string,
	privateKeyFile string,
	serial int64,
	expiresAt time.Time,
) {
	t.Helper()
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate certificate key: %v", err)
	}
	template := &x509.Certificate{
		SerialNumber: big.NewInt(serial),
		Subject:      pkix.Name{CommonName: "edge.snapflow.test"},
		DNSNames:     []string{"edge.snapflow.test"},
		NotBefore:    time.Now().Add(-time.Minute),
		NotAfter:     expiresAt,
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	certificateDER, err := x509.CreateCertificate(
		rand.Reader,
		template,
		template,
		publicKey,
		privateKey,
	)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}
	privateKeyDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		t.Fatalf("marshal private key: %v", err)
	}
	if err := os.WriteFile(
		certificateFile,
		pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certificateDER}),
		0o600,
	); err != nil {
		t.Fatalf("write certificate: %v", err)
	}
	if err := os.WriteFile(
		privateKeyFile,
		pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privateKeyDER}),
		0o600,
	); err != nil {
		t.Fatalf("write private key: %v", err)
	}
}
