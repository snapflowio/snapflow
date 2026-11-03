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

package restartpolicy

import (
	"testing"
	"time"
)

func TestNormalizeAndRetryBackoff(t *testing.T) {
	policy, err := Normalize(&Policy{Mode: ModeOnFailure, Backoff: "3s", MaxAttempts: 2, StableAfter: "1m"})
	if err != nil {
		t.Fatalf("normalize policy: %v", err)
	}
	now := time.Date(2026, 7, 14, 12, 0, 0, 0, time.UTC)
	status, allowed := PrepareAttempt(policy, Status{LastReason: ReasonUnexpectedExit}, now)
	if !allowed || status.Attempts != 1 {
		t.Fatalf("expected first attempt, got allowed=%v status=%+v", allowed, status)
	}
	status = FailedAttempt(policy, status, now)
	if status.NextAttemptAt == nil || !status.NextAttemptAt.Equal(now.Add(3*time.Second)) {
		t.Fatalf("unexpected retry time: %+v", status)
	}
	if _, allowed = PrepareAttempt(policy, status, now.Add(2*time.Second)); allowed {
		t.Fatal("expected retry to wait for backoff")
	}
	status, allowed = PrepareAttempt(policy, status, now.Add(3*time.Second))
	if !allowed || status.Attempts != 2 {
		t.Fatalf("expected second attempt, got allowed=%v status=%+v", allowed, status)
	}
	status = FailedAttempt(policy, status, now.Add(3*time.Second))
	if status.BlockedReason != BlockedReasonMaxAttemptsExceeded || status.NextAttemptAt != nil {
		t.Fatalf("expected attempts to be exhausted: %+v", status)
	}
}

func TestNilPolicyHelpersUseSafeDefaults(t *testing.T) {
	if Backoff(nil) != defaultBackoff || StableAfter(nil) != defaultStableAfter {
		t.Fatal("nil policy helpers did not return defaults")
	}
	status := FailedAttempt(nil, Status{Attempts: 1}, time.Now())
	if status.BlockedReason != BlockedReasonMaxAttemptsExceeded {
		t.Fatal("nil policy must block further restart attempts")
	}
}

func TestPrepareAttemptBacksOffFromPreviousAttempt(t *testing.T) {
	policy, err := Normalize(&Policy{Mode: ModeAlways, Backoff: "5s"})
	if err != nil {
		t.Fatalf("normalize policy: %v", err)
	}
	now := time.Date(2026, 7, 14, 12, 0, 0, 0, time.UTC)
	status := Status{Attempts: 1, LastAttemptAt: &now}
	status, allowed := PrepareAttempt(policy, status, now.Add(time.Second))
	if allowed || status.NextAttemptAt == nil || !status.NextAttemptAt.Equal(now.Add(5*time.Second)) {
		t.Fatalf("expected last-attempt backoff, got allowed=%v status=%+v", allowed, status)
	}
}

func TestShouldRestartUsesExitCode(t *testing.T) {
	zero, failed := 0, 1
	if ShouldRestart(&Policy{Mode: ModeOnFailure}, &zero) {
		t.Fatal("on_failure must not restart a successful workload")
	}
	if !ShouldRestart(&Policy{Mode: ModeOnFailure}, &failed) || !ShouldRestart(&Policy{Mode: ModeOnFailure}, nil) {
		t.Fatal("on_failure must restart failed and unknown exits")
	}
	if !ShouldRestart(&Policy{Mode: ModeAlways}, &zero) {
		t.Fatal("always must restart a successful workload")
	}
}
