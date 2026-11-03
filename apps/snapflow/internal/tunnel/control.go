// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/tunnel/plan"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/transport"
)

type tunnelControl interface {
	FetchPlan(context.Context, string) (*apiclient.MachineTunnelPlanDto, bool, error)
	AcknowledgeBinding(context.Context, plan.Binding, uuid.UUID, *transport.Session) error
	AcknowledgeTargetPlan(context.Context, plan.Binding) error
}

const (
	fetchPlanOperation          = "fetch machine tunnel plan"
	issueCertificateOperation   = "issue machine tunnel certificate"
	acknowledgeBindingOperation = "acknowledge machine tunnel binding"
	acknowledgeTargetOperation  = "acknowledge machine tunnel target plan"
	entityTagQuote              = `"`
)

type ControlPlane struct {
	client *control.Client
}

func NewControlPlane(client *control.Client) (*ControlPlane, error) {
	if client == nil {
		return nil, errors.New("machine tunnel control-plane client is required")
	}
	return &ControlPlane{client: client}, nil
}

func (api *ControlPlane) FetchPlan(
	ctx context.Context,
	digest string,
) (*apiclient.MachineTunnelPlanDto, bool, error) {
	waitSeconds := int(tunnelPlanWait / time.Second)
	params := &apiclient.GetMachineTunnelPlanParams{WaitSeconds: &waitSeconds}
	if digest != "" {
		entityTag := entityTagQuote + digest + entityTagQuote
		params.IfNoneMatch = &entityTag
	}
	response, err := api.client.GetMachineTunnelPlanWithResponse(ctx, params)
	if err == nil && response.StatusCode() == http.StatusNotModified {
		return nil, false, nil
	}
	if err := apierror.CheckResponse(fetchPlanOperation, response, err); err != nil {
		return nil, false, err
	}
	document, err := plan.Decode(response.Body)
	if err != nil {
		return nil, false, fmt.Errorf("%s: %w", fetchPlanOperation, err)
	}
	return document, true, nil
}

func (api *ControlPlane) IssueCertificate(
	ctx context.Context,
	binding plan.Binding,
	csr string,
) (*apiclient.MachineTunnelCertificateDto, error) {
	response, err := api.client.IssueMachineTunnelCertificateWithResponse(ctx, apiclient.IssueMachineTunnelCertificateDto{
		EdgeId:          binding.EdgeID,
		BindingId:       binding.Identity.ID,
		BindingRevision: int32(binding.Identity.Revision),
		BindingDigest:   binding.Identity.Digest,
		Csr:             csr,
	})
	return apierror.Decode(
		issueCertificateOperation, response, err, (*apiclient.IssueMachineTunnelCertificateResult).GetJSON201,
	)
}

func (api *ControlPlane) AcknowledgeBinding(
	ctx context.Context,
	binding plan.Binding,
	connectionID uuid.UUID,
	tunnelSession *transport.Session,
) error {
	if tunnelSession == nil || connectionID == uuid.Nil {
		return errors.New("established tunnel session and connection ID are required")
	}
	metrics := tunnelSession.Metrics()
	lossRatio := float32(0)
	if metrics.PacketsSent != 0 {
		lossRatio = float32(metrics.PacketsLost) / float32(metrics.PacketsSent)
	}
	carrier, err := tunnelCarrier(tunnelSession.TransportName())
	if err != nil {
		return err
	}
	response, err := api.client.AcknowledgeMachineTunnelBindingWithResponse(ctx, apiclient.MachineTunnelBindingAcknowledgementDto{
		BindingId:               binding.Identity.ID,
		BindingRevision:         int32(binding.Identity.Revision),
		BindingDigest:           binding.Identity.Digest,
		ConnectionId:            connectionID,
		Carrier:                 carrier,
		SmoothedRttMilliseconds: float32(metrics.SmoothedRTT / time.Millisecond),
		LossRatio:               lossRatio,
	})
	accepted, err := apierror.Decode(
		acknowledgeBindingOperation, response, err, (*apiclient.AcknowledgeMachineTunnelBindingResult).GetJSON200,
	)
	if err != nil {
		return err
	}
	if accepted.BindingId != binding.Identity.ID || accepted.ConnectionId != connectionID {
		return errors.New("machine tunnel acknowledgement response has the wrong fence")
	}
	return nil
}

func (api *ControlPlane) AcknowledgeTargetPlan(
	ctx context.Context,
	binding plan.Binding,
) error {
	response, err := api.client.AcknowledgeMachineTunnelTargetPlanWithResponse(
		ctx,
		apiclient.MachineTunnelTargetPlanAcknowledgementDto{
			BindingId:       binding.Identity.ID,
			BindingRevision: int32(binding.Identity.Revision),
			BindingDigest:   binding.Identity.Digest,
			TargetRevision:  int32(binding.TargetRevision),
			TargetDigest:    binding.TargetDigest,
		},
	)
	accepted, err := apierror.Decode(
		acknowledgeTargetOperation, response, err, (*apiclient.AcknowledgeMachineTunnelTargetPlanResult).GetJSON200,
	)
	if err != nil {
		return err
	}
	if accepted.BindingId != binding.Identity.ID || accepted.TargetRevision != int32(binding.TargetRevision) {
		return errors.New("machine target-plan acknowledgement response has the wrong fence")
	}
	return nil
}

func tunnelCarrier(name string) (apiclient.TunnelCarrier, error) {
	switch name {
	case transport.TransportNameQUIC:
		return apiclient.TunnelCarrierQuic, nil
	case transport.TransportNameHTTP2:
		return apiclient.TunnelCarrierHttp2, nil
	default:
		return "", fmt.Errorf("unsupported tunnel carrier %q", name)
	}
}

func fencedControlError(err error) bool {
	return apierror.HasStatus(err, http.StatusConflict)
}

func permanentControlError(err error) bool {
	return apierror.IsPermanent(err) || apierror.HasStatus(err, http.StatusRequestTimeout)
}
