// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"crypto/subtle"
	"errors"
	"fmt"
	"time"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/canonicaljson"
)

const javaScriptISOTime = "2006-01-02T15:04:05.000Z"

type routeSnapshotDigestDocument struct {
	EdgeID                string                 `json:"edgeId"`
	EdgeSessionGeneration int                    `json:"edgeSessionGeneration"`
	Version               string                 `json:"version"`
	GeneratedAt           string                 `json:"generatedAt"`
	ExpiresAt             string                 `json:"expiresAt"`
	TrustedHTTPProxyCIDRs []string               `json:"trustedHttpProxyCidrs"`
	MachineBindings       []machineBindingDigest `json:"machineBindings"`
	HTTPRoutes            []httpRouteDigest      `json:"httpRoutes"`
	TCPRoutes             []tcpRouteDigest       `json:"tcpRoutes"`
	UDPRoutes             []udpRouteDigest       `json:"udpRoutes"`
}

type machineBindingDigest struct {
	MachineID                string `json:"machineId"`
	MachineSessionGeneration int    `json:"machineSessionGeneration"`
	BindingID                string `json:"bindingId"`
	BindingRevision          int    `json:"bindingRevision"`
	BindingDigest            string `json:"bindingDigest"`
	LeaseExpiresAt           string `json:"leaseExpiresAt"`
}

type baseRouteDigest struct {
	BackendID            string                         `json:"backendId"`
	State                apiclient.ExposureBackendState `json:"state"`
	MachineID            string                         `json:"machineId"`
	OwnerID              string                         `json:"ownerId"`
	BindingID            string                         `json:"bindingId"`
	Interactive          bool                           `json:"interactive"`
	AssignmentGeneration int                            `json:"assignmentGeneration"`
	ExposureGeneration   int                            `json:"exposureGeneration"`
	SandboxID            string                         `json:"sandboxId"`
	ExposureID           string                         `json:"exposureId"`
	ExposureName         string                         `json:"exposureName"`
	PublicHost           string                         `json:"publicHost"`
	TargetHost           string                         `json:"targetHost"`
	TargetPort           int                            `json:"targetPort"`
	LeaseExpiresAt       string                         `json:"leaseExpiresAt"`
}

type httpRouteDigest struct {
	baseRouteDigest
	Protocol      string           `json:"protocol"`
	TrafficWeight int              `json:"trafficWeight"`
	Hostnames     []string         `json:"hostnames"`
	Policy        httpPolicyDigest `json:"policy"`
}

type httpPolicyDigest struct {
	Visibility          apiclient.ExposureVisibility   `json:"visibility"`
	Path                string                         `json:"path"`
	StripPath           bool                           `json:"stripPath"`
	ForceHTTPS          bool                           `json:"forceHttps"`
	RequireTrustedProxy bool                           `json:"requireTrustedProxy"`
	MaxBodyBytes        int64                          `json:"maxBodyBytes"`
	ReadTimeoutSeconds  int                            `json:"readTimeoutSeconds"`
	SendTimeoutSeconds  int                            `json:"sendTimeoutSeconds"`
	Retries             int                            `json:"retries"`
	Streaming           bool                           `json:"streaming"`
	UpstreamProtocol    apiclient.HttpUpstreamProtocol `json:"upstreamProtocol"`
	AllowedOrigins      []string                       `json:"allowedOrigins"`
	AllowCredentials    bool                           `json:"allowCredentials"`
	ShowBrowserWarning  bool                           `json:"showBrowserWarning"`
}

type tcpRouteDigest struct {
	baseRouteDigest
	Protocol   string          `json:"protocol"`
	PublicPort int             `json:"publicPort"`
	Policy     tcpPolicyDigest `json:"policy"`
}

type tcpPolicyDigest struct {
	ProxyProtocol      apiclient.ProxyProtocol `json:"proxyProtocol"`
	IdleTimeoutSeconds int                     `json:"idleTimeoutSeconds"`
	ConnectionLimit    int                     `json:"connectionLimit"`
}

type udpRouteDigest struct {
	baseRouteDigest
	Protocol   string          `json:"protocol"`
	PublicPort int             `json:"publicPort"`
	Policy     udpPolicyDigest `json:"policy"`
}

type udpPolicyDigest struct {
	IdleTimeoutSeconds          int `json:"idleTimeoutSeconds"`
	FlowLimit                   int `json:"flowLimit"`
	PacketsPerSecond            int `json:"packetsPerSecond"`
	MaximumDatagramPayloadBytes int `json:"maximumDatagramPayloadBytes"`
}

func validateRouteSnapshotDigest(input *apiclient.EdgeRouteSnapshotDto) error {
	digest, err := SnapshotDigest(input)
	if err != nil {
		return fmt.Errorf("calculate Edge route snapshot digest: %w", err)
	}
	if subtle.ConstantTimeCompare([]byte(digest), []byte(input.Digest)) != 1 {
		return errors.New("edge route snapshot digest does not match its content")
	}
	return nil
}

func SnapshotDigest(
	input *apiclient.EdgeRouteSnapshotDto,
) (string, error) {
	document, err := routeSnapshotDigestDocumentFor(input)
	if err != nil {
		return "", err
	}
	return canonicaljson.SHA256(document)
}

func routeSnapshotDigestDocumentFor(
	input *apiclient.EdgeRouteSnapshotDto,
) (routeSnapshotDigestDocument, error) {
	if input == nil {
		return routeSnapshotDigestDocument{}, errors.New("edge route snapshot is required")
	}
	document := routeSnapshotDigestDocument{
		EdgeID: input.EdgeId.String(), EdgeSessionGeneration: input.EdgeSessionGeneration,
		Version: input.Version, GeneratedAt: isoTime(input.GeneratedAt),
		ExpiresAt:             isoTime(input.ExpiresAt),
		TrustedHTTPProxyCIDRs: input.TrustedHttpProxyCidrs,
		MachineBindings:       make([]machineBindingDigest, len(input.MachineBindings)),
		HTTPRoutes:            make([]httpRouteDigest, len(input.HttpRoutes)),
		TCPRoutes:             make([]tcpRouteDigest, len(input.TcpRoutes)),
		UDPRoutes:             make([]udpRouteDigest, len(input.UdpRoutes)),
	}
	for index, binding := range input.MachineBindings {
		document.MachineBindings[index] = machineBindingDigest{
			MachineID: binding.MachineId.String(), MachineSessionGeneration: binding.MachineSessionGeneration,
			BindingID: binding.BindingId.String(), BindingRevision: binding.BindingRevision,
			BindingDigest: binding.BindingDigest, LeaseExpiresAt: isoTime(binding.LeaseExpiresAt),
		}
	}
	for index := range input.HttpRoutes {
		route := &input.HttpRoutes[index]
		document.HTTPRoutes[index] = httpRouteDigest{
			baseRouteDigest: baseDigest(httpRouteInput(route)), Protocol: string(route.Protocol),
			TrafficWeight: route.TrafficWeight, Hostnames: route.Hostnames,
			Policy: httpPolicyDigest{
				Visibility: route.Policy.Visibility, Path: route.Policy.Path,
				StripPath: route.Policy.StripPath, ForceHTTPS: route.Policy.ForceHttps,
				RequireTrustedProxy: route.Policy.RequireTrustedProxy,
				MaxBodyBytes:        route.Policy.MaxBodyBytes,
				ReadTimeoutSeconds:  route.Policy.ReadTimeoutSeconds,
				SendTimeoutSeconds:  route.Policy.SendTimeoutSeconds,
				Retries:             route.Policy.Retries, Streaming: route.Policy.Streaming,
				UpstreamProtocol:   route.Policy.UpstreamProtocol,
				AllowedOrigins:     route.Policy.AllowedOrigins,
				AllowCredentials:   route.Policy.AllowCredentials,
				ShowBrowserWarning: route.Policy.ShowBrowserWarning,
			},
		}
	}
	for index := range input.TcpRoutes {
		route := &input.TcpRoutes[index]
		document.TCPRoutes[index] = tcpRouteDigest{
			baseRouteDigest: baseDigest(tcpRouteInput(route)), Protocol: string(route.Protocol),
			PublicPort: route.PublicPort,
			Policy: tcpPolicyDigest{
				ProxyProtocol:      route.Policy.ProxyProtocol,
				IdleTimeoutSeconds: route.Policy.IdleTimeoutSeconds,
				ConnectionLimit:    route.Policy.ConnectionLimit,
			},
		}
	}
	for index := range input.UdpRoutes {
		route := &input.UdpRoutes[index]
		document.UDPRoutes[index] = udpRouteDigest{
			baseRouteDigest: baseDigest(udpRouteInput(route)), Protocol: string(route.Protocol),
			PublicPort: route.PublicPort,
			Policy: udpPolicyDigest{
				IdleTimeoutSeconds:          route.Policy.IdleTimeoutSeconds,
				FlowLimit:                   route.Policy.FlowLimit,
				PacketsPerSecond:            route.Policy.PacketsPerSecond,
				MaximumDatagramPayloadBytes: route.Policy.MaximumDatagramPayloadBytes,
			},
		}
	}
	return document, nil
}

func baseDigest(route routeInput) baseRouteDigest {
	return baseRouteDigest{
		BackendID: route.BackendID.String(), State: route.State, MachineID: route.MachineID.String(),
		OwnerID: route.OwnerID.String(), BindingID: route.BindingID.String(),
		Interactive: route.Interactive, AssignmentGeneration: route.AssignmentGeneration,
		ExposureGeneration: route.ExposureGeneration, SandboxID: route.SandboxID,
		ExposureID: route.ExposureID.String(), ExposureName: route.ExposureName,
		PublicHost: route.PublicHost, TargetHost: route.TargetHost,
		TargetPort: route.TargetPort, LeaseExpiresAt: isoTime(route.LeaseExpiresAt),
	}
}

func isoTime(value time.Time) string {
	return value.UTC().Format(javaScriptISOTime)
}
