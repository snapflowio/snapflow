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
	"testing"
	"time"
)

func TestBackoffCapsAndResets(t *testing.T) {
	t.Parallel()
	backoff := Backoff{
		Minimum: time.Second,
		Maximum: 4 * time.Second,
		Factor:  2,
	}
	expected := []time.Duration{
		time.Second,
		2 * time.Second,
		4 * time.Second,
		4 * time.Second,
	}
	for index, want := range expected {
		if got := backoff.Next(); got != want {
			t.Fatalf("attempt %d: got %s want %s", index, got, want)
		}
	}
	backoff.Reset()
	if got := backoff.Next(); got != time.Second {
		t.Fatalf("after reset: got %s want 1s", got)
	}
}

func TestBackoffValidate(t *testing.T) {
	t.Parallel()
	valid := DefaultBackoff()
	if err := valid.Validate(); err != nil {
		t.Fatalf("default backoff is invalid: %v", err)
	}
	invalid := []Backoff{
		{Minimum: 0, Maximum: time.Second, Factor: 2},
		{Minimum: time.Second, Maximum: time.Millisecond, Factor: 2},
		{Minimum: time.Second, Maximum: time.Second, Factor: 0.5},
		{Minimum: time.Second, Maximum: time.Second, Factor: 2, Jitter: 2},
	}
	for index, backoff := range invalid {
		if err := backoff.Validate(); err == nil {
			t.Fatalf("case %d: invalid backoff accepted", index)
		}
	}
}
