// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package traffic

import "testing"

func TestCounterHarvestResetsAndKeepsClosedState(t *testing.T) {
	t.Parallel()
	counter := new(Counter)
	counter.AddIngress(1, 1)
	counter.AddEgress(2, 1)
	counter.AddConnection()
	counter.AddFlow()
	counter.Close()
	want := Totals{BytesIn: 1, BytesOut: 2, PacketsIn: 1, PacketsOut: 1, Connections: 1, Flows: 1}
	if totals := counter.Harvest(); totals != want {
		t.Fatalf("harvest = %+v, want %+v", totals, want)
	}
	if totals := counter.Harvest(); !totals.Empty() || !counter.Closed() {
		t.Fatalf("second harvest = %+v (closed %v), want empty and closed", totals, counter.Closed())
	}
}
