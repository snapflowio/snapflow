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
	"fmt"
	"strings"
	"time"
)

const (
	defaultBackoff     = 5 * time.Second
	defaultStableAfter = 10 * time.Minute
)

type Mode string

const (
	ModeNever     Mode = "never"
	ModeAlways    Mode = "always"
	ModeOnFailure Mode = "on_failure"
)

type Reason string

const (
	ReasonUnexpectedExit    Reason = "unexpected_exit"
	ReasonHealthCheckFailed Reason = "health_check_failed"
)

type BlockedReason string

const (
	BlockedReasonManualStop          BlockedReason = "manual_stop"
	BlockedReasonMaxAttemptsExceeded BlockedReason = "max_attempts_exceeded"
)

type Policy struct {
	Mode        Mode   `json:"mode"`
	Backoff     string `json:"backoff,omitempty"`
	MaxAttempts int    `json:"maxAttempts,omitempty"`
	StableAfter string `json:"stableAfter,omitempty"`
}

type Status struct {
	Attempts      int           `json:"attempts,omitempty"`
	LastAttemptAt *time.Time    `json:"lastAttemptAt,omitempty"`
	NextAttemptAt *time.Time    `json:"nextAttemptAt,omitempty"`
	BlockedReason BlockedReason `json:"blockedReason,omitempty"`
	LastReason    Reason        `json:"lastReason,omitempty"`
}

func Normalize(policy *Policy) (*Policy, error) {
	if policy == nil || policy.Mode == "" || policy.Mode == ModeNever {
		return nil, nil
	}
	if policy.Mode != ModeAlways && policy.Mode != ModeOnFailure {
		return nil, fmt.Errorf("restart policy mode must be never, always, or on_failure")
	}
	backoff, err := parsePositive(policy.Backoff, defaultBackoff, "restart backoff")
	if err != nil {
		return nil, err
	}
	stableAfter, err := parsePositive(policy.StableAfter, defaultStableAfter, "restart stable period")
	if err != nil {
		return nil, err
	}
	if policy.MaxAttempts < 0 {
		return nil, fmt.Errorf("restart max attempts must not be negative")
	}
	return &Policy{Mode: policy.Mode, Backoff: backoff.String(), MaxAttempts: policy.MaxAttempts, StableAfter: stableAfter.String()}, nil
}

func Backoff(policy *Policy) time.Duration {
	if policy == nil {
		return defaultBackoff
	}
	value, err := parsePositive(policy.Backoff, defaultBackoff, "restart backoff")
	if err != nil {
		return defaultBackoff
	}
	return value
}

func StableAfter(policy *Policy) time.Duration {
	if policy == nil {
		return defaultStableAfter
	}
	value, err := parsePositive(policy.StableAfter, defaultStableAfter, "restart stable period")
	if err != nil {
		return defaultStableAfter
	}
	return value
}

func ShouldRestart(policy *Policy, exitCode *int) bool {
	if policy == nil {
		return false
	}
	switch policy.Mode {
	case ModeAlways:
		return true
	case ModeOnFailure:
		return exitCode == nil || *exitCode != 0
	default:
		return false
	}
}

func PrepareAttempt(policy *Policy, status Status, now time.Time) (Status, bool) {
	now = now.UTC()
	if policy == nil || status.BlockedReason != "" {
		return status, false
	}
	if status.NextAttemptAt != nil && now.Before(status.NextAttemptAt.UTC()) {
		return status, false
	}
	if status.LastAttemptAt != nil {
		next := status.LastAttemptAt.UTC().Add(Backoff(policy))
		if now.Before(next) {
			status.NextAttemptAt = &next
			return status, false
		}
	}
	if policy.MaxAttempts > 0 && status.Attempts >= policy.MaxAttempts {
		status.BlockedReason = BlockedReasonMaxAttemptsExceeded
		status.NextAttemptAt = nil
		return status, false
	}
	status.Attempts++
	status.LastAttemptAt = &now
	status.NextAttemptAt = nil
	return status, true
}

func FailedAttempt(policy *Policy, status Status, now time.Time) Status {
	if policy == nil {
		status.BlockedReason = BlockedReasonMaxAttemptsExceeded
		status.NextAttemptAt = nil
		return status
	}
	if policy.MaxAttempts > 0 && status.Attempts >= policy.MaxAttempts {
		status.BlockedReason = BlockedReasonMaxAttemptsExceeded
		status.NextAttemptAt = nil
		return status
	}
	next := now.UTC().Add(Backoff(policy))
	status.NextAttemptAt = &next
	return status
}

func ManualStopStatus() Status {
	return Status{BlockedReason: BlockedReasonManualStop}
}

func parsePositive(raw string, fallback time.Duration, name string) (time.Duration, error) {
	if strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	value, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("%s is invalid: %w", name, err)
	}
	if value <= 0 {
		return 0, fmt.Errorf("%s must be positive", name)
	}
	return value, nil
}
