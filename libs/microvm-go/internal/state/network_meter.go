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

package state

import (
	"errors"
	"math"
)

var ErrNetworkMeterOverflow = errors.New("instance network meter overflow")

type NetworkCounters struct {
	InternetEgressBytes  uint64 `json:"internetEgressBytes"`
	InternetIngressBytes uint64 `json:"internetIngressBytes"`
	HostEgressBytes      uint64 `json:"hostEgressBytes"`
	HostIngressBytes     uint64 `json:"hostIngressBytes"`
	TapEgressBytes       uint64 `json:"tapEgressBytes"`
	TapIngressBytes      uint64 `json:"tapIngressBytes"`
}

type NetworkMeter struct {
	Totals NetworkCounters `json:"totals"`
	Device NetworkCounters `json:"device"`
}

func (meter *NetworkMeter) Observe(device NetworkCounters) error {
	next := meter.Totals
	pairs := []struct {
		total    *uint64
		baseline uint64
		reading  uint64
	}{
		{&next.InternetEgressBytes, meter.Device.InternetEgressBytes, device.InternetEgressBytes},
		{&next.InternetIngressBytes, meter.Device.InternetIngressBytes, device.InternetIngressBytes},
		{&next.HostEgressBytes, meter.Device.HostEgressBytes, device.HostEgressBytes},
		{&next.HostIngressBytes, meter.Device.HostIngressBytes, device.HostIngressBytes},
		{&next.TapEgressBytes, meter.Device.TapEgressBytes, device.TapEgressBytes},
		{&next.TapIngressBytes, meter.Device.TapIngressBytes, device.TapIngressBytes},
	}
	for _, pair := range pairs {
		delta := pair.reading
		if pair.reading >= pair.baseline {
			delta = pair.reading - pair.baseline
		}
		if delta > math.MaxUint64-*pair.total {
			return ErrNetworkMeterOverflow
		}
		*pair.total += delta
	}
	meter.Totals = next
	meter.Device = device
	return nil
}

func (meter *NetworkMeter) ReleaseDevice() {
	meter.Device = NetworkCounters{}
}
