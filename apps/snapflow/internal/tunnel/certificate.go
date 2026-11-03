// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/snapflow/internal/tunnel/plan"
	"github.com/snapflowio/tunnel-go/protocol"
)

type certificateIssuer struct {
	control    *ControlPlane
	generation uint32
	machineID  uuid.UUID
}

func newCertificateIssuer(
	control *ControlPlane,
	generation uint32,
	machineID uuid.UUID,
) (*certificateIssuer, error) {
	if control == nil {
		return nil, errors.New("tunnel control plane is required")
	}
	if generation == 0 || machineID == uuid.Nil {
		return nil, errors.New("machine tunnel identity is required")
	}
	return &certificateIssuer{
		control: control, generation: generation, machineID: machineID,
	}, nil
}

const (
	certificateRequestPEMType = "CERTIFICATE REQUEST"
	privateKeyPEMType         = "PRIVATE KEY"
)

func (issuer *certificateIssuer) TLSConfig(
	ctx context.Context,
	binding plan.Binding,
) (*tls.Config, time.Time, error) {
	identity := protocol.MachineCertificateIdentity{
		MachineID:                issuer.machineID,
		EdgeID:                   binding.EdgeID,
		MachineSessionGeneration: issuer.generation,
		BindingID:                binding.Identity.ID,
		BindingRevision:          binding.Identity.Revision,
	}
	request, err := newCertificateRequest(identity)
	if err != nil {
		return nil, time.Time{}, err
	}
	issued, err := issuer.control.IssueCertificate(ctx, binding, request.pem)
	if err != nil {
		return nil, time.Time{}, err
	}
	certificate, err := request.keyPair(issued.CertificateChain)
	if err != nil {
		return nil, time.Time{}, err
	}
	if err := request.verifyIdentity(issued.SpiffeId, certificate.Leaf); err != nil {
		return nil, time.Time{}, err
	}
	if err := verifyChain(certificate); err != nil {
		return nil, time.Time{}, err
	}
	if issued.ExpiresAt.IsZero() || issued.ExpiresAt.After(certificate.Leaf.NotAfter) ||
		!issued.ExpiresAt.After(time.Now()) {
		return nil, time.Time{}, errors.New("issued tunnel certificate has an invalid expiry")
	}
	serverRoots, err := x509.SystemCertPool()
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("load Edge server trust roots: %w", err)
	}
	return &tls.Config{
		MinVersion:   tls.VersionTLS13,
		ServerName:   binding.ServerName,
		RootCAs:      serverRoots,
		Certificates: []tls.Certificate{certificate},
	}, issued.ExpiresAt, nil
}

type certificateRequest struct {
	identity    protocol.MachineCertificateIdentity
	identityURI *url.URL
	publicKey   ed25519.PublicKey
	privateKey  ed25519.PrivateKey
	pem         string
}

func newCertificateRequest(identity protocol.MachineCertificateIdentity) (certificateRequest, error) {
	identityURI, err := protocol.MachineIdentityURI(identity)
	if err != nil {
		return certificateRequest{}, fmt.Errorf("create tunnel workload identity: %w", err)
	}
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return certificateRequest{}, fmt.Errorf("generate ephemeral tunnel identity: %w", err)
	}
	requestDER, err := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{
		SignatureAlgorithm: x509.PureEd25519,
		URIs:               []*url.URL{identityURI},
	}, privateKey)
	if err != nil {
		return certificateRequest{}, fmt.Errorf("create tunnel certificate request: %w", err)
	}
	return certificateRequest{
		identity: identity, identityURI: identityURI, publicKey: publicKey, privateKey: privateKey,
		pem: string(pem.EncodeToMemory(&pem.Block{Type: certificateRequestPEMType, Bytes: requestDER})),
	}, nil
}

func (request certificateRequest) keyPair(chain string) (tls.Certificate, error) {
	privateDER, err := x509.MarshalPKCS8PrivateKey(request.privateKey)
	if err != nil {
		return tls.Certificate{}, fmt.Errorf("encode ephemeral tunnel private key: %w", err)
	}
	privatePEM := pem.EncodeToMemory(&pem.Block{Type: privateKeyPEMType, Bytes: privateDER})
	certificate, err := tls.X509KeyPair([]byte(chain), privatePEM)
	if err != nil {
		return tls.Certificate{}, fmt.Errorf("parse issued tunnel certificate: %w", err)
	}
	if len(certificate.Certificate) == 0 {
		return tls.Certificate{}, errors.New("issued tunnel certificate chain is empty")
	}
	leaf, err := x509.ParseCertificate(certificate.Certificate[0])
	if err != nil {
		return tls.Certificate{}, fmt.Errorf("parse issued tunnel leaf certificate: %w", err)
	}
	certificate.Leaf = leaf
	return certificate, nil
}

func (request certificateRequest) verifyIdentity(spiffeID string, leaf *x509.Certificate) error {
	if request.identityURI.String() != spiffeID {
		return errors.New("issued tunnel certificate has the wrong workload identity")
	}
	parsedIdentity, err := protocol.ParseMachineCertificate(leaf)
	if err != nil || parsedIdentity != request.identity {
		return errors.New("issued tunnel certificate identity does not match its binding")
	}
	issuedPublicKey, ok := leaf.PublicKey.(ed25519.PublicKey)
	if !ok || !bytes.Equal(issuedPublicKey, request.publicKey) {
		return errors.New("issued tunnel certificate does not match the ephemeral key")
	}
	return nil
}

func verifyChain(certificate tls.Certificate) error {
	intermediates := x509.NewCertPool()
	roots := x509.NewCertPool()
	rootCount := 0
	for _, encoded := range certificate.Certificate[1:] {
		parsed, err := x509.ParseCertificate(encoded)
		if err != nil {
			return fmt.Errorf("parse tunnel certificate chain: %w", err)
		}
		if parsed.CheckSignatureFrom(parsed) == nil && bytes.Equal(parsed.RawIssuer, parsed.RawSubject) {
			roots.AddCert(parsed)
			rootCount++
			continue
		}
		intermediates.AddCert(parsed)
	}
	if rootCount == 0 {
		return errors.New("issued tunnel certificate chain has no self-signed trust anchor")
	}
	if _, err := certificate.Leaf.Verify(x509.VerifyOptions{
		Roots: roots, Intermediates: intermediates,
		KeyUsages:   []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
		CurrentTime: time.Now(),
	}); err != nil {
		return fmt.Errorf("verify issued tunnel certificate: %w", err)
	}
	return nil
}
