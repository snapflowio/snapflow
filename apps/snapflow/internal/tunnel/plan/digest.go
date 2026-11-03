// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package plan

import (
	"fmt"
	"slices"
	"strings"
	"time"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/canonicaljson"
	"github.com/snapflowio/tunnel-go/protocol"
)

type planDigestDocument struct {
	MachineID                string              `json:"machineId"`
	MachineSessionGeneration int32               `json:"machineSessionGeneration"`
	Version                  string              `json:"version"`
	GeneratedAt              string              `json:"generatedAt"`
	ExpiresAt                string              `json:"expiresAt"`
	Bindings                 []planDigestBinding `json:"bindings"`
}

type planDigestBinding struct {
	EdgeID          string                                   `json:"edgeId"`
	EdgeHost        string                                   `json:"edgeHost"`
	EdgePort        int32                                    `json:"edgePort"`
	BindingID       string                                   `json:"bindingId"`
	BindingRevision int32                                    `json:"bindingRevision"`
	BindingDigest   string                                   `json:"bindingDigest"`
	TargetRevision  int32                                    `json:"targetRevision"`
	TargetDigest    string                                   `json:"targetDigest"`
	DesiredState    apiclient.MachineEdgeBindingDesiredState `json:"desiredState"`
	LeaseExpiresAt  string                                   `json:"leaseExpiresAt"`
	Targets         []planDigestTarget                       `json:"targets"`
}

type planDigestTarget struct {
	BackendID                 string                         `json:"backendId"`
	ExposureID                string                         `json:"exposureId"`
	ExposureGeneration        int32                          `json:"exposureGeneration"`
	SandboxID                 string                         `json:"sandboxId"`
	AssignmentGeneration      int32                          `json:"assignmentGeneration"`
	PlacementFencingTokenHash string                         `json:"placementFencingTokenHash"`
	Protocol                  apiclient.NetworkProtocol      `json:"protocol"`
	TargetHost                string                         `json:"targetHost"`
	TargetReference           string                         `json:"targetReference,omitempty"`
	GuestService              string                         `json:"guestService,omitempty"`
	TargetPort                int32                          `json:"targetPort"`
	State                     apiclient.ExposureBackendState `json:"state"`
	LeaseExpiresAt            string                         `json:"leaseExpiresAt"`
}

func DocumentDigest(input *apiclient.MachineTunnelPlanDto) (string, error) {
	document := planDigestDocument{
		MachineID: input.MachineId.String(), MachineSessionGeneration: input.MachineSessionGeneration,
		Version: input.Version, GeneratedAt: isoTime(input.GeneratedAt),
		ExpiresAt: isoTime(input.ExpiresAt),
		Bindings:  make([]planDigestBinding, len(input.Bindings)),
	}
	for bindingIndex, binding := range input.Bindings {
		digestBinding := planDigestBinding{
			EdgeID: binding.EdgeId.String(), EdgeHost: binding.EdgeHost, EdgePort: binding.EdgePort,
			BindingID: binding.BindingId.String(), BindingRevision: binding.BindingRevision,
			BindingDigest: binding.BindingDigest, DesiredState: binding.DesiredState,
			TargetRevision: binding.TargetRevision, TargetDigest: binding.TargetDigest,
			LeaseExpiresAt: isoTime(binding.LeaseExpiresAt),
			Targets:        make([]planDigestTarget, len(binding.Targets)),
		}
		for targetIndex, target := range binding.Targets {
			digestBinding.Targets[targetIndex] = planDigestTarget{
				BackendID: target.BackendId.String(), ExposureID: target.ExposureId.String(),
				ExposureGeneration: target.ExposureGeneration, SandboxID: target.SandboxId,
				AssignmentGeneration:      target.AssignmentGeneration,
				PlacementFencingTokenHash: target.PlacementFencingTokenHash,
				Protocol:                  target.Protocol, TargetHost: target.TargetHost,
				TargetReference: optionalText(target.TargetReference),
				GuestService:    optionalText(target.GuestService),
				TargetPort:      target.TargetPort, State: target.State,
				LeaseExpiresAt: isoTime(target.LeaseExpiresAt),
			}
		}
		document.Bindings[bindingIndex] = digestBinding
	}
	digest, err := canonicaljson.SHA256(document)
	if err != nil {
		return "", fmt.Errorf("canonicalize machine tunnel plan: %w", err)
	}
	return digest, nil
}

type targetPlanDigestDocument struct {
	BindingID       string                   `json:"bindingId"`
	BindingRevision uint64                   `json:"bindingRevision"`
	TargetRevision  uint64                   `json:"targetRevision"`
	Targets         []targetPlanDigestTarget `json:"targets"`
}

type targetPlanDigestTarget struct {
	BackendID                 string            `json:"backendId"`
	ExposureID                string            `json:"exposureId"`
	ExposureGeneration        uint32            `json:"exposureGeneration"`
	SandboxID                 string            `json:"sandboxId"`
	AssignmentGeneration      uint32            `json:"assignmentGeneration"`
	PlacementFencingTokenHash string            `json:"placementFencingTokenHash"`
	Protocol                  protocol.Protocol `json:"protocol"`
	TargetHost                string            `json:"targetHost"`
	TargetReference           string            `json:"targetReference,omitempty"`
	GuestService              string            `json:"guestService,omitempty"`
	TargetPort                uint16            `json:"targetPort"`
}

func bindingTargetDigest(binding Binding) (string, error) {
	targets := make([]targetPlanDigestTarget, 0, len(binding.Targets))
	for _, target := range binding.Targets {
		targets = append(targets, targetPlanDigestTarget{
			BackendID: target.BackendID.String(), ExposureID: target.ExposureID.String(),
			ExposureGeneration: target.ExposureGeneration, SandboxID: target.SandboxID,
			AssignmentGeneration:      target.AssignmentGeneration,
			PlacementFencingTokenHash: target.PlacementFencingTokenHash,
			Protocol:                  target.Protocol, TargetHost: target.Host,
			TargetReference: target.Reference, GuestService: target.GuestService,
			TargetPort: target.Port,
		})
	}
	slices.SortFunc(targets, func(left, right targetPlanDigestTarget) int {
		return strings.Compare(left.BackendID, right.BackendID)
	})
	digest, err := canonicaljson.SHA256(targetPlanDigestDocument{
		BindingID: binding.Identity.ID.String(), BindingRevision: binding.Identity.Revision,
		TargetRevision: binding.TargetRevision, Targets: targets,
	})
	if err != nil {
		return "", fmt.Errorf("canonicalize machine target plan: %w", err)
	}
	return digest, nil
}

func optionalText(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func isoTime(value time.Time) string {
	return value.UTC().Format(javaScriptISOTime)
}
