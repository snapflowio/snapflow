// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/control"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

func (assembled *assembly) Ready() bool {
	return assembled.routes.Ready()
}

func (assembled *assembly) servingReady() bool {
	return assembled.Ready() && !assembled.admission.IsDraining()
}

func (assembled *assembly) SessionCount() int32 {
	return assembled.tunnels.SessionCount()
}

func (assembled *assembly) BindingAcknowledgements() []apiclient.EdgeBindingAcknowledgementDto {
	acknowledgements := assembled.tunnels.BindingAcknowledgements()
	result := make([]apiclient.EdgeBindingAcknowledgementDto, 0, len(acknowledgements))
	for _, acknowledgement := range acknowledgements {
		result = append(result, apiclient.EdgeBindingAcknowledgementDto{
			MachineId:       acknowledgement.MachineID,
			BindingId:       acknowledgement.Binding.ID,
			ConnectionId:    acknowledgement.ConnectionID,
			BindingRevision: int(acknowledgement.Binding.Revision),
			BindingDigest:   acknowledgement.Binding.Digest,
		})
	}
	return result
}

func (assembled *assembly) BindingAcknowledgementChanges() <-chan struct{} {
	return assembled.tunnels.BindingAcknowledgementChanges()
}

func (assembled *assembly) TCPConnectionCount() int32 {
	return assembled.tcp.ConnectionCount()
}

func (assembled *assembly) FlowCount() int32 {
	return assembled.udp.FlowCount()
}

func (assembled *assembly) ReportAccessSessions() []uuid.UUID {
	return assembled.sessions.Report()
}

func (assembled *assembly) ConfirmAccessSession(sessionID uuid.UUID, expiresAt time.Time) {
	assembled.sessions.Confirm(sessionID, expiresAt)
}

func (assembled *assembly) RevokeAccessSessions(sessionIDs []uuid.UUID) {
	assembled.sessions.Revoke(sessionIDs)
}

func (assembled *assembly) ListenerStatuses() []apiclient.EdgeRouteListenerStatusDto {
	statuses := assembled.ports.ListenerStatuses()
	result := make([]apiclient.EdgeRouteListenerStatusDto, 0, len(statuses))
	for _, listenerStatus := range statuses {
		converted := apiclient.EdgeRouteListenerStatusDto{
			BackendId:  listenerStatus.BackendID,
			Protocol:   apiclient.NetworkProtocol(listenerStatus.Protocol),
			PublicPort: int(listenerStatus.PublicPort),
			Listening:  listenerStatus.Listening,
		}
		if listenerStatus.FailureReason != "" {
			failureReason := listenerStatus.FailureReason
			converted.FailureReason = &failureReason
		}
		result = append(result, converted)
	}
	return result
}

func (assembled *assembly) OperationalMetrics() control.OperationalMetrics {
	admissionCounters := assembled.admission.Snapshot()
	datagramCounters := assembled.tunnels.DatagramCounters()
	return control.OperationalMetrics{
		RouteCount:                  assembled.routes.Load().BackendCount(),
		TunnelHeadroom:              int(assembled.tunnels.SessionHeadroom()),
		HTTPRequests:                int32(admissionCounters.HTTPRequestActive),
		HTTPRequestHeadroom:         int(admissionCounters.HTTPRequestHeadroom),
		HTTPConnections:             int32(admissionCounters.HTTPConnectionActive),
		HTTPConnectionHeadroom:      int(admissionCounters.HTTPConnectionHeadroom),
		HTTPStreams:                 int32(admissionCounters.HTTPStreamActive),
		HTTPStreamHeadroom:          int(admissionCounters.HTTPStreamHeadroom),
		TCPConnectionHeadroom:       int(admissionCounters.TCPHeadroom),
		UDPFlowHeadroom:             int(admissionCounters.UDPFlowHeadroom),
		AdmissionRateRejections:     admissionCounters.RateRejected,
		AdmissionCapacityRejections: admissionCounters.CapacityRejected,
		AdmissionDrainRejections:    admissionCounters.DrainRejected,
		SourceAdmissionEntries:      int(admissionCounters.SourceEntries),
		SourceAdmissionEvictions:    admissionCounters.SourceEvictions,
		DatagramsDelivered:          datagramCounters.Delivered,
		DatagramsDropped:            datagramCounters.Dropped,
		DatagramsFailed:             datagramCounters.Failed,
	}
}
