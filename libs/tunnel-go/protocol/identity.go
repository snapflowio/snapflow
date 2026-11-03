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

package protocol

import (
	"crypto/x509"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

const TunnelTrustDomain = "tunnel.snapflow.internal"

type MachineCertificateIdentity struct {
	MachineID                uuid.UUID
	EdgeID                   uuid.UUID
	MachineSessionGeneration uint32
	BindingID                uuid.UUID
	BindingRevision          uint64
}

func ParseMachineCertificate(certificate *x509.Certificate) (MachineCertificateIdentity, error) {
	if certificate == nil {
		return MachineCertificateIdentity{}, errors.New("machine tunnel certificate is required")
	}
	for _, identityURI := range certificate.URIs {
		identity, err := parseMachineIdentityURI(identityURI)
		if err == nil {
			return identity, nil
		}
	}
	return MachineCertificateIdentity{}, errors.New("certificate has no valid Machine tunnel identity")
}

func MachineIdentityURI(identity MachineCertificateIdentity) (*url.URL, error) {
	if err := identity.Validate(); err != nil {
		return nil, err
	}
	return url.Parse(fmt.Sprintf(
		"spiffe://%s/machine/%s/edge/%s/session/%d/binding/%s/revision/%d",
		TunnelTrustDomain,
		identity.MachineID,
		identity.EdgeID,
		identity.MachineSessionGeneration,
		identity.BindingID,
		identity.BindingRevision,
	))
}

func (identity MachineCertificateIdentity) Validate() error {
	if identity.MachineID == uuid.Nil || identity.EdgeID == uuid.Nil ||
		identity.MachineSessionGeneration == 0 || identity.BindingID == uuid.Nil ||
		identity.BindingRevision == 0 || identity.BindingRevision > MaxBindingRevision {
		return errors.New("complete Machine tunnel certificate identity is required")
	}
	return nil
}

func machineIdentityPathSegments(identityURI *url.URL) ([]string, error) {
	if identityURI == nil || identityURI.Scheme != "spiffe" ||
		identityURI.Host != TunnelTrustDomain || identityURI.RawQuery != "" ||
		identityURI.Fragment != "" {
		return nil, errors.New("invalid Machine tunnel identity URI")
	}
	parts := strings.Split(strings.Trim(identityURI.EscapedPath(), "/"), "/")
	if len(parts) != 10 || parts[0] != "machine" || parts[2] != "edge" ||
		parts[4] != "session" || parts[6] != "binding" || parts[8] != "revision" {
		return nil, errors.New("invalid Machine tunnel identity path")
	}
	return parts, nil
}

func parseMachineIdentityURI(identityURI *url.URL) (MachineCertificateIdentity, error) {
	parts, err := machineIdentityPathSegments(identityURI)
	if err != nil {
		return MachineCertificateIdentity{}, err
	}
	machineID, err := uuid.Parse(parts[1])
	if err != nil {
		return MachineCertificateIdentity{}, fmt.Errorf("invalid Machine ID: %w", err)
	}
	edgeID, err := uuid.Parse(parts[3])
	if err != nil {
		return MachineCertificateIdentity{}, fmt.Errorf("invalid Edge ID: %w", err)
	}
	sessionGeneration, err := strconv.ParseUint(parts[5], 10, 32)
	if err != nil {
		return MachineCertificateIdentity{}, fmt.Errorf("invalid Machine session generation: %w", err)
	}
	bindingID, err := uuid.Parse(parts[7])
	if err != nil {
		return MachineCertificateIdentity{}, fmt.Errorf("invalid binding ID: %w", err)
	}
	bindingRevision, err := strconv.ParseUint(parts[9], 10, 64)
	if err != nil {
		return MachineCertificateIdentity{}, fmt.Errorf("invalid binding revision: %w", err)
	}
	identity := MachineCertificateIdentity{
		MachineID: machineID, EdgeID: edgeID,
		MachineSessionGeneration: uint32(sessionGeneration),
		BindingID:                bindingID, BindingRevision: bindingRevision,
	}
	return identity, identity.Validate()
}
