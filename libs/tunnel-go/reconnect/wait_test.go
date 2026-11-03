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

package reconnect

import (
	"context"
	"testing"
	"time"
)

func TestWait(t *testing.T) {
	cases := []struct {
		name      string
		cancelled bool
		delay     time.Duration
		want      bool
	}{
		{name: "zero delay live", delay: 0, want: true},
		{name: "zero delay cancelled", cancelled: true, delay: 0, want: false},
		{name: "elapsed", delay: time.Millisecond, want: true},
		{name: "cancelled", cancelled: true, delay: time.Hour, want: false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			if testCase.cancelled {
				cancel()
			}
			if got := Wait(ctx, testCase.delay); got != testCase.want {
				t.Fatalf("Wait() = %v, want %v", got, testCase.want)
			}
		})
	}
}
