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

package network

import (
	"errors"
	"fmt"
)

type TrafficPolicy struct {
	UploadBPS               uint64
	DownloadBPS             uint64
	HostUploadBPS           uint64
	BurstBytes              uint64
	PacketsPerSecond        uint32
	NewConnectionsPerSecond uint32
	MaxConnections          uint32
	Enforce                 bool
}

type shapedLink struct {
	bps        uint64
	burstBytes uint64
}

type sandboxTraffic struct {
	upload                  shapedLink
	download                shapedLink
	packetsPerSecond        uint32
	newConnectionsPerSecond uint32
	maxConnections          uint32
	enforce                 bool
}

func (policy TrafficPolicy) Validate() error {
	var failures []error
	for name, value := range map[string]uint64{
		"upload": policy.UploadBPS, "download": policy.DownloadBPS, "household upload": policy.HostUploadBPS,
	} {
		if value != 0 && (value < MinimumBandwidthBPS || value > MaximumBandwidthBPS) {
			failures = append(failures, fmt.Errorf("the %s bandwidth limit %d bps must be between %d and %d",
				name, value, MinimumBandwidthBPS, MaximumBandwidthBPS))
		}
	}
	return errors.Join(failures...)
}

func (policy TrafficPolicy) forSandbox(egress EgressPolicy) sandboxTraffic {
	if egress.TrafficExempt {
		return sandboxTraffic{
			upload:                  shapedLink{bps: egress.EgressBandwidthBPS},
			download:                shapedLink{bps: egress.IngressBandwidthBPS},
			newConnectionsPerSecond: egress.NewConnectionsPerSecond,
			enforce:                 true,
		}
	}
	return sandboxTraffic{
		upload:                  capped(policy.UploadBPS, egress.EgressBandwidthBPS, policy.BurstBytes),
		download:                capped(policy.DownloadBPS, egress.IngressBandwidthBPS, policy.BurstBytes),
		packetsPerSecond:        policy.PacketsPerSecond,
		newConnectionsPerSecond: tightest(policy.NewConnectionsPerSecond, egress.NewConnectionsPerSecond),
		maxConnections:          policy.MaxConnections,
		enforce:                 policy.Enforce || egress.NewConnectionsPerSecond > 0,
	}
}

func capped(defaultBPS, overrideBPS, burstBytes uint64) shapedLink {
	rate := tightest(defaultBPS, overrideBPS)
	if rate != defaultBPS {
		return shapedLink{bps: rate}
	}
	return shapedLink{bps: rate, burstBytes: burstBytes}
}

func tightest[T uint32 | uint64](limits ...T) T {
	var result T
	for _, limit := range limits {
		if limit != 0 && (result == 0 || limit < result) {
			result = limit
		}
	}
	return result
}
