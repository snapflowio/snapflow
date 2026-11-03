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

package runtime

import (
	"testing"

	"github.com/snapflowio/microvm-go/internal/state"
)

func TestControlPlaneManagedExcludesRuntimeInternalInstances(t *testing.T) {
	cases := []struct {
		name     string
		metadata state.InstanceMetadata
		want     bool
	}{
		{name: "sandbox", metadata: state.InstanceMetadata{}, want: true},
		{name: "template seed", metadata: state.InstanceMetadata{TemplateSeed: true}, want: false},
		{
			name:     "isolated builder",
			metadata: state.InstanceMetadata{Labels: map[string]string{internalBuilderLabel: internalBuilderLabelValue}},
			want:     false,
		},
	}
	for _, current := range cases {
		t.Run(current.name, func(t *testing.T) {
			if got := controlPlaneManaged(current.metadata); got != current.want {
				t.Fatalf("controlPlaneManaged() = %t, want %t", got, current.want)
			}
		})
	}
}
