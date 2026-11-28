// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package certrequest

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"net/url"
	"time"
)

const (
	certificateRequestPEMType = "CERTIFICATE REQUEST"
	privateKeyPEMType         = "PRIVATE KEY"
)

type Request struct {
	IdentityURI *url.URL
	PEM         string
	publicKey   ed25519.PublicKey
	privateKey  ed25519.PrivateKey
}

func New(identityURI *url.URL) (Request, error) {
	if identityURI == nil {
		return Request{}, errors.New("tunnel workload identity is required")
	}
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return Request{}, fmt.Errorf("generate ephemeral tunnel identity: %w", err)
	}
	requestDER, err := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{
		SignatureAlgorithm: x509.PureEd25519,
		URIs:               []*url.URL{identityURI},
	}, privateKey)
	if err != nil {
		return Request{}, fmt.Errorf("create tunnel certificate request: %w", err)
	}
	return Request{
		IdentityURI: identityURI,
		PEM:         string(pem.EncodeToMemory(&pem.Block{Type: certificateRequestPEMType, Bytes: requestDER})),
		publicKey:   publicKey,
		privateKey:  privateKey,
	}, nil
}

func (request Request) KeyPair(chain string) (tls.Certificate, error) {
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

func (request Request) VerifyIssued(certificate tls.Certificate) error {
	leaf := certificate.Leaf
	if leaf == nil || len(leaf.URIs) != 1 || leaf.URIs[0].String() != request.IdentityURI.String() {
		return errors.New("issued tunnel certificate has the wrong workload identity")
	}
	issuedPublicKey, ok := leaf.PublicKey.(ed25519.PublicKey)
	if !ok || !bytes.Equal(issuedPublicKey, request.publicKey) {
		return errors.New("issued tunnel certificate does not match the ephemeral key")
	}
	return verifyChain(certificate)
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
