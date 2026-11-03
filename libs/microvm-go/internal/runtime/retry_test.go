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
	"context"
	"errors"
	"testing"
	"time"
)

func TestRetryGuestOperationPreservesCancellationAndOperationError(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	operationError := errors.New("guest is not ready")
	attempts := 0

	err := retryGuestOperation(ctx, func() error {
		attempts++
		return operationError
	}, retryEveryError)
	if attempts != 1 {
		t.Fatalf("operation attempts = %d, want 1", attempts)
	}
	if !errors.Is(err, context.Canceled) || !errors.Is(err, operationError) {
		t.Fatalf("retry error = %v, want cancellation and operation causes", err)
	}
}

func TestRetryGuestOperationNoticesAReachableGuestWithinMilliseconds(t *testing.T) {
	reachableAt := time.Now().Add(75 * time.Millisecond)
	attempts := 0
	started := time.Now()

	err := retryGuestOperation(context.Background(), func() error {
		attempts++
		if time.Now().Before(reachableAt) {
			return errors.New("guest is not listening yet")
		}
		return nil
	}, retryEveryError)
	if err != nil {
		t.Fatalf("retryGuestOperation() error = %v", err)
	}
	if lag := time.Since(started) - 75*time.Millisecond; lag > 30*time.Millisecond {
		t.Fatalf("guest became reachable at 75ms but was noticed %v later", lag)
	}
	if attempts < 10 {
		t.Fatalf("attempts = %d, want fast polling during the first second", attempts)
	}
}

func TestGuestPollScheduleSlowsDownAfterTheFastWindow(t *testing.T) {
	schedule := newGuestPollSchedule()
	if interval := schedule.NextBackOff(); interval != guestPollFastInterval {
		t.Fatalf("first interval = %v, want %v", interval, guestPollFastInterval)
	}
	schedule.startedAt = time.Now().Add(-guestPollFastWindow)
	if interval := schedule.NextBackOff(); interval != guestPollSlowInterval {
		t.Fatalf("interval after the fast window = %v, want %v", interval, guestPollSlowInterval)
	}
	schedule.Reset()
	if interval := schedule.NextBackOff(); interval != guestPollFastInterval {
		t.Fatalf("interval after reset = %v, want %v", interval, guestPollFastInterval)
	}
}

func TestRetryGuestOperationStopsOnPermanentError(t *testing.T) {
	operationError := errors.New("invalid guest request")
	attempts := 0

	err := retryGuestOperation(context.Background(), func() error {
		attempts++
		return operationError
	}, func(error) bool {
		return false
	})
	if attempts != 1 {
		t.Fatalf("operation attempts = %d, want 1", attempts)
	}
	if !errors.Is(err, operationError) {
		t.Fatalf("retry error = %v, want %v", err, operationError)
	}
}
