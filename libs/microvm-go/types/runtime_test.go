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

import "testing"

func TestRuntimePortTargetValidation(t *testing.T) {
	t.Parallel()
	for _, target := range []RuntimePortTarget{
		{Protocol: RuntimePortTCP, Port: 8080},
		{Protocol: RuntimePortUDP, Port: 7777},
	} {
		if err := target.Validate(); err != nil {
			t.Fatalf("valid target %+v rejected: %v", target, err)
		}
	}
	for _, target := range []RuntimePortTarget{
		{Protocol: "sctp", Port: 8080},
		{Protocol: RuntimePortTCP, Port: 0},
	} {
		if err := target.Validate(); err == nil {
			t.Fatalf("invalid target %+v accepted", target)
		}
	}
}
