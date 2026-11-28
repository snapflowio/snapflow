// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/snapflow/internal/network/tunnel/plan"
	"github.com/snapflowio/tunnel-go/certrequest"
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
	identityURI, err := protocol.MachineIdentityURI(identity)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("create tunnel workload identity: %w", err)
	}
	request, err := certrequest.New(identityURI)
	if err != nil {
		return nil, time.Time{}, err
	}
	issued, err := issuer.control.IssueCertificate(ctx, binding, request.PEM)
	if err != nil {
		return nil, time.Time{}, err
	}
	certificate, err := request.KeyPair(issued.CertificateChain)
	if err != nil {
		return nil, time.Time{}, err
	}
	if err := verifyMachineIdentity(request, identity, issued.SpiffeId, certificate); err != nil {
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

func verifyMachineIdentity(
	request certrequest.Request,
	identity protocol.MachineCertificateIdentity,
	spiffeID string,
	certificate tls.Certificate,
) error {
	if request.IdentityURI.String() != spiffeID {
		return errors.New("issued tunnel certificate has the wrong workload identity")
	}
	if err := request.VerifyIssued(certificate); err != nil {
		return err
	}
	parsedIdentity, err := protocol.ParseMachineCertificate(certificate.Leaf)
	if err != nil || parsedIdentity != identity {
		return errors.New("issued tunnel certificate identity does not match its binding")
	}
	return nil
}
