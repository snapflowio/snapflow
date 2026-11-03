// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package plan

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/protocol"
)

func Decode(payload []byte) (*apiclient.MachineTunnelPlanDto, error) {
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	var document apiclient.MachineTunnelPlanDto
	if err := decoder.Decode(&document); err != nil {
		return nil, fmt.Errorf("decode machine tunnel plan: %w", err)
	}
	if decoder.More() {
		return nil, errors.New("machine tunnel plan contains trailing data")
	}
	return &document, nil
}

func Parse(
	input *apiclient.MachineTunnelPlanDto,
	expectedMachineID uuid.UUID,
	expectedSessionGeneration uint32,
	now time.Time,
) (Plan, error) {
	if input == nil {
		return Plan{}, errors.New("machine tunnel plan is empty")
	}
	plan, err := parsePlanHeader(input, expectedMachineID, expectedSessionGeneration, now)
	if err != nil {
		return Plan{}, err
	}
	digest, err := DocumentDigest(input)
	if err != nil {
		return Plan{}, err
	}
	if digest != input.Digest {
		return Plan{}, errors.New("machine tunnel plan digest does not match its content")
	}
	if err := plan.addBindings(input.Bindings); err != nil {
		return Plan{}, err
	}
	return plan, nil
}

func parsePlanHeader(
	input *apiclient.MachineTunnelPlanDto,
	expectedMachineID uuid.UUID,
	expectedSessionGeneration uint32,
	now time.Time,
) (Plan, error) {
	machineID := input.MachineId
	if machineID != expectedMachineID {
		return Plan{}, errors.New("machine tunnel plan has the wrong machine identity")
	}
	if input.MachineSessionGeneration < 1 ||
		uint32(input.MachineSessionGeneration) != expectedSessionGeneration {
		return Plan{}, errors.New("machine tunnel plan has the wrong session generation")
	}
	version, err := parsePlanVersion(input)
	if err != nil {
		return Plan{}, err
	}
	if !validSHA256(input.Digest) {
		return Plan{}, errors.New("machine tunnel plan digest is invalid")
	}
	generatedAt := input.GeneratedAt.UTC()
	expiresAt := input.ExpiresAt.UTC()
	if !validPlanWindow(generatedAt, expiresAt, now.UTC()) {
		return Plan{}, errors.New("machine tunnel plan validity window is invalid")
	}
	return Plan{
		MachineID: machineID, MachineSessionGeneration: expectedSessionGeneration,
		Version: version, Digest: input.Digest, GeneratedAt: generatedAt,
		ExpiresAt: expiresAt, Bindings: make(map[uuid.UUID]Binding, len(input.Bindings)),
	}, nil
}

func parsePlanVersion(input *apiclient.MachineTunnelPlanDto) (uint64, error) {
	version, err := strconv.ParseUint(input.Version, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parse machine tunnel plan version: %w", err)
	}
	if len(input.Bindings) > maximumTunnelBindings {
		return 0, fmt.Errorf("machine tunnel plan exceeds %d bindings", maximumTunnelBindings)
	}
	if len(input.Bindings) != 0 && version == 0 {
		return 0, errors.New("non-empty machine tunnel plan must have a positive version")
	}
	return version, nil
}

func validPlanWindow(generatedAt, expiresAt, now time.Time) bool {
	return !generatedAt.IsZero() && !expiresAt.IsZero() && expiresAt.After(generatedAt) &&
		expiresAt.Sub(generatedAt) <= maximumPlanLifetime &&
		!generatedAt.After(now.Add(protocol.MaximumControlDocumentClockSkew)) && expiresAt.After(now)
}

func (plan *Plan) addBindings(inputs []apiclient.MachineTunnelBindingDto) error {
	edges := make(map[uuid.UUID]struct{}, len(inputs))
	targetCount := 0
	for index := range inputs {
		if len(inputs[index].Targets) > maximumTunnelTargets-targetCount {
			return fmt.Errorf("machine tunnel plan exceeds %d targets", maximumTunnelTargets)
		}
		targetCount += len(inputs[index].Targets)
		binding, err := parseBinding(inputs[index], plan.ExpiresAt)
		if err != nil {
			return fmt.Errorf("parse machine tunnel binding %d: %w", index, err)
		}
		if _, exists := plan.Bindings[binding.Identity.ID]; exists {
			return fmt.Errorf("duplicate machine tunnel binding %s", binding.Identity.ID)
		}
		if _, exists := edges[binding.EdgeID]; exists {
			return fmt.Errorf("duplicate machine tunnel Edge %s", binding.EdgeID)
		}
		plan.Bindings[binding.Identity.ID] = binding
		edges[binding.EdgeID] = struct{}{}
	}
	return nil
}

func parseBinding(input apiclient.MachineTunnelBindingDto, planExpiry time.Time) (Binding, error) {
	if err := validateBindingFences(input); err != nil {
		return Binding{}, err
	}
	state := BindingState(input.DesiredState)
	if state != BindingActive && state != BindingDraining {
		return Binding{}, fmt.Errorf("unsupported binding desired state %q", input.DesiredState)
	}
	leaseExpiry := input.LeaseExpiresAt.UTC()
	if leaseExpiry.Before(planExpiry) {
		return Binding{}, errors.New("binding lease expires before the plan")
	}
	targets, err := parseTargets(input.Targets, planExpiry)
	if err != nil {
		return Binding{}, err
	}
	binding := Binding{
		EdgeID:     input.EdgeId,
		Address:    net.JoinHostPort(input.EdgeHost, strconv.Itoa(int(input.EdgePort))),
		ServerName: input.EdgeHost,
		Identity: protocol.Binding{
			ID: input.BindingId, Revision: uint64(input.BindingRevision), Digest: input.BindingDigest,
		},
		TargetRevision: uint64(input.TargetRevision), TargetDigest: input.TargetDigest,
		DesiredState: state, LeaseExpiresAt: leaseExpiry, Targets: targets,
	}
	targetDigest, err := bindingTargetDigest(binding)
	if err != nil {
		return Binding{}, err
	}
	if targetDigest != binding.TargetDigest {
		return Binding{}, fmt.Errorf(
			"binding target-plan digest does not match its content: calculated %s, received %s",
			targetDigest,
			binding.TargetDigest,
		)
	}
	return binding, nil
}

func validateBindingFences(input apiclient.MachineTunnelBindingDto) error {
	if input.BindingRevision < 1 || !validSHA256(input.BindingDigest) {
		return errors.New("binding fence is invalid")
	}
	if input.TargetRevision < 1 || !validSHA256(input.TargetDigest) {
		return errors.New("binding target-plan fence is invalid")
	}
	if !validPort(int64(input.EdgePort)) || !validTunnelHost(input.EdgeHost) {
		return errors.New("edge tunnel address is invalid")
	}
	return nil
}

func parseTargets(inputs []apiclient.MachineTunnelTargetDto, planExpiry time.Time) (map[uuid.UUID]Target, error) {
	targets := make(map[uuid.UUID]Target, len(inputs))
	for index := range inputs {
		target, err := parseTarget(inputs[index], planExpiry)
		if err != nil {
			return nil, fmt.Errorf("parse target %d: %w", index, err)
		}
		if _, exists := targets[target.BackendID]; exists {
			return nil, fmt.Errorf("duplicate backend %s", target.BackendID)
		}
		targets[target.BackendID] = target
	}
	return targets, nil
}

func targetProtocols() map[apiclient.NetworkProtocol]protocol.Protocol {
	return map[apiclient.NetworkProtocol]protocol.Protocol{
		apiclient.NetworkProtocolHttp: protocol.ProtocolHTTP,
		apiclient.NetworkProtocolTcp:  protocol.ProtocolTCP,
		apiclient.NetworkProtocolUdp:  protocol.ProtocolUDP,
	}
}

func parseTarget(input apiclient.MachineTunnelTargetDto, planExpiry time.Time) (Target, error) {
	target, err := parseTargetIdentity(input)
	if err != nil {
		return Target{}, err
	}
	routeProtocol, supported := targetProtocols()[input.Protocol]
	if !supported {
		return Target{}, fmt.Errorf("unsupported target protocol %q", input.Protocol)
	}
	targetReference, err := canonicalOptionalText(input.TargetReference, "target reference")
	if err != nil {
		return Target{}, err
	}
	guestService, err := canonicalOptionalText(input.GuestService, "guest service")
	if err != nil {
		return Target{}, err
	}
	if err := validateTargetHost(input.TargetHost, routeProtocol, targetReference, guestService); err != nil {
		return Target{}, err
	}
	state := TargetState(input.State)
	if state != TargetPending && state != TargetActive && state != TargetDraining {
		return Target{}, fmt.Errorf("unsupported target state %q", input.State)
	}
	leaseExpiry := input.LeaseExpiresAt.UTC()
	if leaseExpiry.Before(planExpiry) {
		return Target{}, errors.New("target lease expires before the plan")
	}
	target.Protocol, target.Host = routeProtocol, input.TargetHost
	target.Reference, target.GuestService = targetReference, guestService
	target.State, target.LeaseExpiresAt = state, leaseExpiry
	return target, nil
}

func parseTargetIdentity(input apiclient.MachineTunnelTargetDto) (Target, error) {
	if input.ExposureGeneration < 1 || input.AssignmentGeneration < 1 ||
		!validPort(int64(input.TargetPort)) ||
		strings.TrimSpace(input.SandboxId) == "" ||
		!validSHA256(input.PlacementFencingTokenHash) {
		return Target{}, errors.New("runtime target is invalid")
	}
	return Target{
		BackendID: input.BackendId, ExposureID: input.ExposureId,
		ExposureGeneration: uint32(input.ExposureGeneration), SandboxID: input.SandboxId,
		AssignmentGeneration:      uint32(input.AssignmentGeneration),
		PlacementFencingTokenHash: input.PlacementFencingTokenHash,
		Port:                      uint16(input.TargetPort),
	}, nil
}

func validateTargetHost(host string, routeProtocol protocol.Protocol, reference, guestService string) error {
	switch host {
	case RuntimeTargetHost:
		if reference != "" {
			return errors.New("runtime target contains a service reference")
		}
		if guestService != "" &&
			(routeProtocol != protocol.ProtocolHTTP || !isRelayedGuestService(guestService)) {
			return errors.New("runtime guest service target is invalid")
		}
	case BuildLogsTargetHost:
		if routeProtocol != protocol.ProtocolHTTP || reference == "" ||
			len(reference) > maximumTargetReferenceLength || guestService != "" {
			return errors.New("build log target is invalid")
		}
	case SSHGatewayTargetHost:
		if routeProtocol != protocol.ProtocolTCP || reference != "" || guestService != "" {
			return errors.New("machine SSH gateway target is invalid")
		}
	default:
		return fmt.Errorf("unsupported target host %q", host)
	}
	return nil
}

func validPort(port int64) bool {
	return port >= minimumPort && port <= maximumPort
}

func canonicalOptionalText(value *string, name string) (string, error) {
	if value == nil {
		return "", nil
	}
	if *value == "" || strings.TrimSpace(*value) != *value {
		return "", fmt.Errorf("%s must be non-empty and trimmed", name)
	}
	return *value, nil
}

func validTunnelHost(value string) bool {
	return value != "" && len(value) <= maximumHostnameLength &&
		!strings.ContainsAny(value, "/\\") &&
		strings.IndexFunc(value, unicode.IsSpace) < 0
}

func validSHA256(value string) bool {
	if len(value) != sha256.Size*2 {
		return false
	}
	decoded, err := hex.DecodeString(value)
	return err == nil && hex.EncodeToString(decoded) == value
}

func isRelayedGuestService(name string) bool {
	_, relayed := relayedGuestServices()[name]
	return relayed
}
