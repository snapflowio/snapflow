// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package traffic

import "sync/atomic"

type Counter struct {
	bytesIn     atomic.Uint64
	bytesOut    atomic.Uint64
	packetsIn   atomic.Uint64
	packetsOut  atomic.Uint64
	connections atomic.Uint64
	flows       atomic.Uint64
	closed      atomic.Bool
}

type Totals struct {
	BytesIn     uint64
	BytesOut    uint64
	PacketsIn   uint64
	PacketsOut  uint64
	Connections uint64
	Flows       uint64
}

func (totals Totals) Empty() bool {
	return totals == Totals{}
}

func (counter *Counter) AddIngress(bytes, packets uint64) {
	addNonZero(&counter.bytesIn, bytes)
	addNonZero(&counter.packetsIn, packets)
}

func (counter *Counter) AddEgress(bytes, packets uint64) {
	addNonZero(&counter.bytesOut, bytes)
	addNonZero(&counter.packetsOut, packets)
}

func (counter *Counter) AddConnection() {
	counter.connections.Add(1)
}

func (counter *Counter) AddFlow() {
	counter.flows.Add(1)
}

func (counter *Counter) Close() {
	counter.closed.Store(true)
}

func (counter *Counter) Closed() bool {
	return counter.closed.Load()
}

func (counter *Counter) Harvest() Totals {
	return Totals{
		BytesIn:     counter.bytesIn.Swap(0),
		BytesOut:    counter.bytesOut.Swap(0),
		PacketsIn:   counter.packetsIn.Swap(0),
		PacketsOut:  counter.packetsOut.Swap(0),
		Connections: counter.connections.Swap(0),
		Flows:       counter.flows.Swap(0),
	}
}

func addNonZero(value *atomic.Uint64, increment uint64) {
	if increment > 0 {
		value.Add(increment)
	}
}
