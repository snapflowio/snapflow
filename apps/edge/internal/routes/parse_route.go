// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	maximumTimeoutSeconds     = 3600
	maximumSandboxIDLength    = 128
	maximumExposureNameLength = 64
	maximumTargetHostLength   = 253
	minimumPort               = 1
	maximumPort               = 65_535
)

type routeInput struct {
	BackendID            uuid.UUID
	State                apiclient.ExposureBackendState
	MachineID            uuid.UUID
	OwnerID              uuid.UUID
	BindingID            uuid.UUID
	Interactive          bool
	AssignmentGeneration int
	ExposureGeneration   int
	SandboxID            string
	ExposureID           uuid.UUID
	ExposureName         string
	PublicHost           string
	TargetHost           string
	TargetPort           int
	LeaseExpiresAt       time.Time
}

func httpRouteInput(route *apiclient.EdgeHttpRouteDto) routeInput {
	return routeInput{
		BackendID: route.BackendId, State: route.State, MachineID: route.MachineId,
		OwnerID: route.OwnerId, BindingID: route.BindingId,
		Interactive: route.Interactive, AssignmentGeneration: route.AssignmentGeneration,
		ExposureGeneration: route.ExposureGeneration, SandboxID: route.SandboxId,
		ExposureID: route.ExposureId, ExposureName: route.ExposureName,
		PublicHost: route.PublicHost, TargetHost: route.TargetHost,
		TargetPort: route.TargetPort, LeaseExpiresAt: route.LeaseExpiresAt,
	}
}

func tcpRouteInput(route *apiclient.EdgeTcpRouteDto) routeInput {
	return routeInput{
		BackendID: route.BackendId, State: route.State, MachineID: route.MachineId,
		OwnerID: route.OwnerId, BindingID: route.BindingId,
		Interactive: route.Interactive, AssignmentGeneration: route.AssignmentGeneration,
		ExposureGeneration: route.ExposureGeneration, SandboxID: route.SandboxId,
		ExposureID: route.ExposureId, ExposureName: route.ExposureName,
		PublicHost: route.PublicHost, TargetHost: route.TargetHost,
		TargetPort: route.TargetPort, LeaseExpiresAt: route.LeaseExpiresAt,
	}
}

func udpRouteInput(route *apiclient.EdgeUdpRouteDto) routeInput {
	return routeInput{
		BackendID: route.BackendId, State: route.State, MachineID: route.MachineId,
		OwnerID: route.OwnerId, BindingID: route.BindingId,
		Interactive: route.Interactive, AssignmentGeneration: route.AssignmentGeneration,
		ExposureGeneration: route.ExposureGeneration, SandboxID: route.SandboxId,
		ExposureID: route.ExposureId, ExposureName: route.ExposureName,
		PublicHost: route.PublicHost, TargetHost: route.TargetHost,
		TargetPort: route.TargetPort, LeaseExpiresAt: route.LeaseExpiresAt,
	}
}

func parseBase(input routeInput) (Base, error) {
	route := Base{
		BackendID:  input.BackendID,
		MachineID:  input.MachineID,
		OwnerID:    input.OwnerID,
		BindingID:  input.BindingID,
		ExposureID: input.ExposureID,
	}
	if err := parseRouteAssignment(input, &route); err != nil {
		return Base{}, err
	}
	if err := parseRouteTarget(input, &route); err != nil {
		return Base{}, err
	}
	return route, nil
}

func parseRouteAssignment(input routeInput, route *Base) error {
	assignmentGeneration := input.AssignmentGeneration
	if assignmentGeneration < 1 || assignmentGeneration > math.MaxUint32 {
		return errors.New("sandbox assignment generation is invalid")
	}
	exposureGeneration := input.ExposureGeneration
	if exposureGeneration < 1 || exposureGeneration > math.MaxUint32 {
		return errors.New("exposure generation is invalid")
	}
	sandboxID := input.SandboxID
	if !isCanonicalText(sandboxID) || len(sandboxID) > maximumSandboxIDLength {
		return errors.New("sandbox ID is invalid")
	}
	state := BackendState(input.State)
	if state != BackendPending && state != BackendActive && state != BackendDraining {
		return fmt.Errorf("invalid backend state %q", state)
	}
	leaseExpiresAt := input.LeaseExpiresAt
	if leaseExpiresAt.IsZero() {
		return errors.New("lease expiry is required")
	}
	route.Interactive = input.Interactive
	route.AssignmentGeneration = uint32(assignmentGeneration)
	route.ExposureGeneration = uint32(exposureGeneration)
	route.SandboxID = sandboxID
	route.State = state
	route.LeaseExpiresAt = leaseExpiresAt
	return nil
}

func parseRouteTarget(input routeInput, route *Base) error {
	targetPort, err := parsePort(input.TargetPort)
	if err != nil {
		return fmt.Errorf("target port: %w", err)
	}
	publicHost := input.PublicHost
	if !IsValidHostname(publicHost) {
		return errors.New("public host is invalid")
	}
	exposureName := input.ExposureName
	if !isCanonicalText(exposureName) || len(exposureName) > maximumExposureNameLength {
		return errors.New("exposure name is invalid")
	}
	targetHost := input.TargetHost
	if !isCanonicalText(targetHost) || len(targetHost) > maximumTargetHostLength {
		return errors.New("target host is invalid")
	}
	route.TargetPort = targetPort
	route.PublicHost = NormalizeHost(publicHost)
	route.ExposureName = exposureName
	route.TargetHost = targetHost
	return nil
}

func isCanonicalText(value string) bool {
	return value != "" && strings.TrimSpace(value) == value
}

func parsePort(value int) (uint16, error) {
	if value < minimumPort || value > maximumPort {
		return 0, fmt.Errorf("port %d is outside %d-%d", value, minimumPort, maximumPort)
	}
	return uint16(value), nil
}

func parseProxyProtocol(value apiclient.ProxyProtocol) (ProxyProtocol, error) {
	mode := ProxyProtocol(value)
	if mode != ProxyProtocolDisabled && mode != ProxyProtocolV2 {
		return "", fmt.Errorf("invalid PROXY protocol mode %q", value)
	}
	return mode, nil
}

func validateSeconds(value int, allowZero bool) error {
	minimum := 1
	if allowZero {
		minimum = 0
	}
	if value < minimum || value > maximumTimeoutSeconds {
		return fmt.Errorf(
			"seconds %d are outside %d-%d",
			value,
			minimum,
			maximumTimeoutSeconds,
		)
	}
	return nil
}

func seconds(value int) time.Duration {
	return time.Duration(value) * time.Second
}
