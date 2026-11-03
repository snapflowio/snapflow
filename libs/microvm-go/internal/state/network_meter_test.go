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
	"testing"
)

func TestNetworkMeterAccumulatesDeltasPerClass(t *testing.T) {
	var meter NetworkMeter
	if err := meter.Observe(NetworkCounters{InternetEgressBytes: 100, HostEgressBytes: 40, TapEgressBytes: 150}); err != nil {
		t.Fatal(err)
	}
	if err := meter.Observe(NetworkCounters{InternetEgressBytes: 250, HostEgressBytes: 40, TapEgressBytes: 310, InternetIngressBytes: 7}); err != nil {
		t.Fatal(err)
	}
	want := NetworkCounters{InternetEgressBytes: 250, HostEgressBytes: 40, TapEgressBytes: 310, InternetIngressBytes: 7}
	if meter.Totals != want {
		t.Fatalf("totals = %+v, want %+v", meter.Totals, want)
	}
}

func TestNetworkMeterTreatsAResetCounterAsFreshTraffic(t *testing.T) {
	meter := NetworkMeter{
		Totals: NetworkCounters{InternetEgressBytes: 1_000},
		Device: NetworkCounters{InternetEgressBytes: 900},
	}
	if err := meter.Observe(NetworkCounters{InternetEgressBytes: 30}); err != nil {
		t.Fatal(err)
	}
	if meter.Totals.InternetEgressBytes != 1_030 || meter.Device.InternetEgressBytes != 30 {
		t.Fatalf("meter = %+v", meter)
	}
}

func TestNetworkMeterRestartsFromZeroAfterRelease(t *testing.T) {
	var meter NetworkMeter
	if err := meter.Observe(NetworkCounters{InternetEgressBytes: 500}); err != nil {
		t.Fatal(err)
	}
	meter.ReleaseDevice()
	if err := meter.Observe(NetworkCounters{InternetEgressBytes: 600}); err != nil {
		t.Fatal(err)
	}
	if meter.Totals.InternetEgressBytes != 1_100 {
		t.Fatalf("totals after release = %d, want 1100", meter.Totals.InternetEgressBytes)
	}
}

func TestNetworkMeterRejectsOverflowWithoutPartialUpdates(t *testing.T) {
	meter := NetworkMeter{Totals: NetworkCounters{HostIngressBytes: math.MaxUint64, InternetEgressBytes: 1}}
	err := meter.Observe(NetworkCounters{InternetEgressBytes: 5, HostIngressBytes: 1})
	if !errors.Is(err, ErrNetworkMeterOverflow) || meter.Totals.InternetEgressBytes != 1 {
		t.Fatalf("Observe() = %v, totals %+v", err, meter.Totals)
	}
}
