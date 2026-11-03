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

package types

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"
)

type ImageInfo struct {
	Reference  string
	Repository string
	Digest     string
	Platform   string
	Entrypoint []string
	Command    []string
	SizeBytes  int64
}

type AllocatedResources struct {
	CPUVCPUs  int64
	MemoryGiB int64
	DiskGiB   int64
	GPUCount  int64
}

type RuntimeObservation struct {
	ID                  string                  `json:"id"`
	Identity            RuntimeArtifactIdentity `json:"identity"`
	GenerationID        string                  `json:"generationId"`
	Image               string                  `json:"image,omitempty"`
	Info                RuntimeInfo             `json:"info"`
	ControlPlaneManaged bool                    `json:"controlPlaneManaged"`
	InspectionComplete  bool                    `json:"inspectionComplete"`
}

type RuntimeUsageSample struct {
	Sequence              uint64
	InternetEgressBytes   uint64
	InternetIngressBytes  uint64
	HostEgressBytes       uint64
	HostIngressBytes      uint64
	TapEgressBytes        uint64
	TapIngressBytes       uint64
	SampledAt             time.Time
	GenerationID          string
	State                 string
	RunningMillis         uint64
	CPUVCPUs              int64
	MemoryGiB             int64
	StorageGiB            int64
	GPUCount              int64
	TelemetryMeasurement  string
	TelemetryBootID       string
	CPUTotalTicks         uint64
	CPUBusyTicks          uint64
	MemoryTotalBytes      uint64
	MemoryUsedBytes       uint64
	StorageTotalBytes     uint64
	StorageUsedBytes      uint64
	NetworkReceiveBytes   uint64
	NetworkTransmitBytes  uint64
	GPUUtilizationPercent *float64
	GPUMemoryUsedBytes    *uint64
	GPUMemoryTotalBytes   *uint64
}

type ProxyTarget struct {
	URL             *url.URL
	Transport       http.RoundTripper
	DialContext     func(ctx context.Context, network, address string) (net.Conn, error)
	Headers         http.Header
	Credential      string
	ObserveResponse func(context.Context, int) error
}

type RuntimePortProtocol string

const (
	RuntimePortTCP RuntimePortProtocol = "tcp"
	RuntimePortUDP RuntimePortProtocol = "udp"
)

type RuntimePortTarget struct {
	Protocol RuntimePortProtocol
	Port     uint16
}

func (t RuntimePortTarget) Validate() error {
	if t.Protocol != RuntimePortTCP && t.Protocol != RuntimePortUDP {
		return fmt.Errorf("runtime port protocol must be %q or %q", RuntimePortTCP, RuntimePortUDP)
	}
	if t.Port == 0 {
		return errors.New("runtime port must be between 1 and 65535")
	}
	return nil
}

func (t ProxyTarget) ApplyHeaders(destination http.Header) {
	for name, values := range t.Headers {
		destination.Del(name)
		for _, value := range values {
			destination.Add(name, value)
		}
	}
}
