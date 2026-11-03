// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package telemetry

import (
	"reflect"
	"testing"
)

func TestDefaultRouteInterfaces(t *testing.T) {
	t.Parallel()
	ipv4 := []byte(
		"Iface Destination Gateway Flags RefCnt Use Metric Mask MTU Window IRTT\n" +
			"eth0 00000000 0100000A 0003 0 0 100 00000000 0 0 0\n" +
			"docker0 000011AC 00000000 0001 0 0 0 0000FFFF 0 0 0\n",
	)
	ipv6 := []byte(
		"00000000000000000000000000000000 00 " +
			"00000000000000000000000000000000 00 " +
			"00000000000000000000000000000000 00000064 00000000 " +
			"00000000 00000001 eth1\n",
	)
	got := defaultRouteInterfaces(ipv4, ipv6)
	want := []string{"eth0", "eth1"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("default route interfaces = %v, want %v", got, want)
	}
}

func TestParseNetworkCountersUsesOnlySelectedInterfaces(t *testing.T) {
	t.Parallel()
	data := []byte(
		"Inter-| Receive | Transmit\n" +
			" face |bytes packets errs drop fifo frame compressed multicast|" +
			"bytes packets errs drop fifo colls carrier compressed\n" +
			"eth0: 100 10 0 2 0 0 0 0 200 20 0 3 0 0 0 0\n" +
			"docker0: 1000 100 0 20 0 0 0 0 2000 200 0 30 0 0 0 0\n",
	)
	counters, err := parseNetworkCounters(
		data,
		map[string]struct{}{"eth0": {}},
	)
	if err != nil {
		t.Fatalf("parse network counters: %v", err)
	}
	want := networkCounters{bytesIn: 100, bytesOut: 200, packets: 30, drops: 5}
	if counters != want {
		t.Fatalf("network counters = %+v, want %+v", counters, want)
	}
}

func TestParseNetworkCountersReportsMissingInterfaces(t *testing.T) {
	t.Parallel()
	data := []byte("eth0: 100 10 0 2 0 0 0 0 200 20 0 3 0 0 0 0\n")
	if _, err := parseNetworkCounters(
		data,
		map[string]struct{}{"eth0": {}, "eth1": {}},
	); err == nil {
		t.Fatal("a configured interface missing from /proc/net/dev was accepted")
	}
}
