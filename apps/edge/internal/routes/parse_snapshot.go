// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/netip"
	"sort"
	"strconv"
	"time"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	maximumSnapshotRoutes          = 10_000
	maximumSnapshotHTTPHostnames   = 100_000
	maximumSnapshotMachineBindings = 20_000
	maximumTrustedHTTPProxyCIDRs   = 64
	maximumSnapshotLifetime        = 60 * time.Second
	snapshotVersionBase            = 10
	snapshotVersionBits            = 63
	leadingZero                    = '0'
)

var (
	ErrEdgeRecipientMismatch = errors.New(
		"edge route snapshot recipient does not match this Edge",
	)
	ErrPreviousSession = errors.New(
		"edge route snapshot belongs to a previous Edge session",
	)
	ErrSessionRecipientMismatch = errors.New(
		"edge route snapshot recipient does not match this Edge session",
	)
)

func DecodeSnapshot(payload []byte) (*apiclient.EdgeRouteSnapshotDto, error) {
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	var snapshot apiclient.EdgeRouteSnapshotDto
	if err := decoder.Decode(&snapshot); err != nil {
		return nil, fmt.Errorf("decode Edge route snapshot: %w", err)
	}
	if decoder.More() {
		return nil, errors.New("edge route snapshot contains trailing data")
	}
	return &snapshot, nil
}

func Parse(
	input *apiclient.EdgeRouteSnapshotDto,
	expectedEdgeID string,
	expectedSessionGeneration int32,
) (*Snapshot, error) {
	if err := validateSnapshotEnvelope(input, expectedEdgeID, expectedSessionGeneration); err != nil {
		return nil, err
	}
	result := emptySnapshot()
	result.version = input.Version
	result.digest = input.Digest
	result.generatedAt = input.GeneratedAt
	result.expiresAt = input.ExpiresAt
	prefixes, err := parseTrustedHTTPProxies(input.TrustedHttpProxyCidrs)
	if err != nil {
		return nil, err
	}
	result.trustedHTTPProxyPrefixes = prefixes
	if err := result.addMachineBindings(input.MachineBindings); err != nil {
		return nil, err
	}
	result.addHTTPRoutes(input.HttpRoutes)
	for index := range input.TcpRoutes {
		if err := result.addTCPRoute(&input.TcpRoutes[index]); err != nil {
			result.reject(protocol.ProtocolTCP, input.TcpRoutes[index].BackendId.String(), err)
		}
	}
	for index := range input.UdpRoutes {
		if err := result.addUDPRoute(&input.UdpRoutes[index]); err != nil {
			result.reject(protocol.ProtocolUDP, input.UdpRoutes[index].BackendId.String(), err)
		}
	}
	return result, nil
}

func validateSnapshotEnvelope(
	input *apiclient.EdgeRouteSnapshotDto,
	expectedEdgeID string,
	expectedSessionGeneration int32,
) error {
	if input == nil {
		return errors.New("edge route table is required")
	}
	if err := validateSnapshotRecipient(input, expectedEdgeID, expectedSessionGeneration); err != nil {
		return err
	}
	if _, err := parseSnapshotVersion(input.Version); err != nil {
		return err
	}
	if err := validateRouteSnapshotDigest(input); err != nil {
		return err
	}
	if err := validateSnapshotLifetime(input.GeneratedAt, input.ExpiresAt, time.Now()); err != nil {
		return err
	}
	routeCount := len(input.HttpRoutes) + len(input.TcpRoutes) + len(input.UdpRoutes)
	if routeCount > maximumSnapshotRoutes {
		return fmt.Errorf(
			"edge route table contains %d routes, maximum is %d",
			routeCount,
			maximumSnapshotRoutes,
		)
	}
	if len(input.MachineBindings) > maximumSnapshotMachineBindings {
		return fmt.Errorf(
			"edge route snapshot contains %d Machine bindings, maximum is %d",
			len(input.MachineBindings),
			maximumSnapshotMachineBindings,
		)
	}
	return nil
}

func validateSnapshotRecipient(
	input *apiclient.EdgeRouteSnapshotDto,
	expectedEdgeID string,
	expectedSessionGeneration int32,
) error {
	if input.EdgeId.String() != expectedEdgeID {
		return ErrEdgeRecipientMismatch
	}
	sessionGeneration := input.EdgeSessionGeneration
	if sessionGeneration == int(expectedSessionGeneration) {
		return nil
	}
	if sessionGeneration > 0 && sessionGeneration < int(expectedSessionGeneration) {
		return ErrPreviousSession
	}
	return ErrSessionRecipientMismatch
}

func validateSnapshotLifetime(generatedAt, expiresAt, now time.Time) error {
	if generatedAt.IsZero() || expiresAt.IsZero() ||
		!expiresAt.After(generatedAt) ||
		expiresAt.Sub(generatedAt) > maximumSnapshotLifetime ||
		generatedAt.After(now.Add(protocol.MaximumControlDocumentClockSkew)) ||
		!expiresAt.After(now) {
		return errors.New("edge route snapshot lifetime is invalid")
	}
	return nil
}

func parseTrustedHTTPProxies(values []string) ([]netip.Prefix, error) {
	if len(values) > maximumTrustedHTTPProxyCIDRs {
		return nil, fmt.Errorf(
			"edge route table contains %d trusted HTTP proxy networks, maximum is %d",
			len(values),
			maximumTrustedHTTPProxyCIDRs,
		)
	}
	result := make([]netip.Prefix, 0, len(values))
	seen := make(map[netip.Prefix]struct{}, len(values))
	for index, value := range values {
		prefix, err := netip.ParsePrefix(value)
		if err != nil {
			return nil, fmt.Errorf("parse trusted HTTP proxy network %d: %w", index, err)
		}
		prefix = prefix.Masked()
		if _, exists := seen[prefix]; exists {
			return nil, fmt.Errorf("duplicate trusted HTTP proxy network %s", prefix)
		}
		seen[prefix] = struct{}{}
		result = append(result, prefix)
	}
	return result, nil
}

func (snapshot *Snapshot) addMachineBindings(inputs []apiclient.EdgeMachineBindingDto) error {
	for index := range inputs {
		binding, err := parseMachineBinding(&inputs[index])
		if err != nil {
			return fmt.Errorf("parse Machine binding %d: %w", index, err)
		}
		if _, exists := snapshot.machineBindings[binding.MachineID]; exists {
			return fmt.Errorf("duplicate Machine binding %s", binding.MachineID)
		}
		snapshot.machineBindings[binding.MachineID] = binding
	}
	return nil
}

func (snapshot *Snapshot) addHTTPRoutes(inputs []apiclient.EdgeHttpRouteDto) {
	hostnameCount := 0
	for index := range inputs {
		if err := snapshot.addHTTPRoute(&inputs[index], &hostnameCount); err != nil {
			snapshot.reject(protocol.ProtocolHTTP, inputs[index].BackendId.String(), err)
		}
	}
	for host, routes := range snapshot.httpByHost {
		sort.Slice(routes, func(left, right int) bool {
			return len(routes[left].Policy.Path) > len(routes[right].Policy.Path)
		})
		snapshot.httpByHost[host] = routes
	}
}

func (snapshot *Snapshot) addHTTPRoute(
	input *apiclient.EdgeHttpRouteDto,
	hostnameCount *int,
) error {
	route, err := parseHTTPRoute(input)
	if err != nil {
		return err
	}
	if *hostnameCount+len(route.Hostnames) > maximumSnapshotHTTPHostnames {
		return fmt.Errorf("edge route table exceeds %d HTTP hostnames", maximumSnapshotHTTPHostnames)
	}
	if err := snapshot.addBase(route.Base, protocol.ProtocolHTTP); err != nil {
		return err
	}
	*hostnameCount += len(route.Hostnames)
	for _, host := range route.Hostnames {
		snapshot.httpByHost[host] = append(snapshot.httpByHost[host], route)
	}
	return nil
}

func (snapshot *Snapshot) addTCPRoute(input *apiclient.EdgeTcpRouteDto) error {
	route, err := parseTCPRoute(input)
	if err != nil {
		return err
	}
	if _, exists := snapshot.tcpByPort[route.PublicPort]; exists {
		return fmt.Errorf("duplicate TCP public port %d", route.PublicPort)
	}
	if err := snapshot.addBase(route.Base, protocol.ProtocolTCP); err != nil {
		return err
	}
	snapshot.tcpByPort[route.PublicPort] = route
	return nil
}

func (snapshot *Snapshot) addUDPRoute(input *apiclient.EdgeUdpRouteDto) error {
	route, err := parseUDPRoute(input)
	if err != nil {
		return err
	}
	if _, exists := snapshot.udpByPort[route.PublicPort]; exists {
		return fmt.Errorf("duplicate UDP public port %d", route.PublicPort)
	}
	if err := snapshot.addBase(route.Base, protocol.ProtocolUDP); err != nil {
		return err
	}
	snapshot.udpByPort[route.PublicPort] = route
	return nil
}

func parseSnapshotVersion(value string) (uint64, error) {
	if value == "" || len(value) > 1 && value[0] == leadingZero {
		return 0, errors.New("edge route snapshot version format is invalid")
	}
	version, err := strconv.ParseUint(value, snapshotVersionBase, snapshotVersionBits)
	if err != nil || version == 0 {
		return 0, errors.New("edge route snapshot version is invalid")
	}
	return version, nil
}
