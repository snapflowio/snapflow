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

package healthcheck

import (
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

func TestNormalizeHTTPPolicyAppliesDefaults(t *testing.T) {
	policy, err := Normalize(&Policy{HTTP: &HTTPCheck{Port: 8080}})
	if err != nil {
		t.Fatalf("normalize policy: %v", err)
	}
	if policy.Type != TypeHTTP || policy.HTTP.Path != "/" || policy.HTTP.Scheme != "http" || policy.HTTP.ExpectedStatus != 200 {
		t.Fatalf("unexpected normalized HTTP policy: %+v", policy)
	}
	if policy.FailureThreshold != defaultFailureThreshold || policy.SuccessThreshold != defaultSuccessThreshold {
		t.Fatalf("unexpected normalized thresholds: %+v", policy)
	}
}

func TestNormalizeRejectsAmbiguousProbe(t *testing.T) {
	_, err := Normalize(&Policy{HTTP: &HTTPCheck{Port: 8080}, TCP: &TCPCheck{Port: 8080}})
	if err == nil {
		t.Fatal("expected ambiguous health check to fail")
	}
}

func TestApplyHonorsStartPeriodAndThresholds(t *testing.T) {
	policy, err := Normalize(&Policy{
		Type:             TypeTCP,
		StartPeriod:      "30s",
		FailureThreshold: 2,
		SuccessThreshold: 2,
		TCP:              &TCPCheck{Port: 8080},
	})
	if err != nil {
		t.Fatalf("normalize policy: %v", err)
	}
	startedAt := time.Date(2026, 7, 14, 12, 0, 0, 0, time.UTC)
	status := Apply(policy, nil, startedAt, startedAt.Add(5*time.Second), ProbeResult{Error: "starting"})
	if status.Status != StatusStarting {
		t.Fatalf("expected starting during grace period, got %s", status.Status)
	}
	status = Apply(policy, status, startedAt, startedAt.Add(31*time.Second), ProbeResult{Error: "failed once"})
	status = Apply(policy, status, startedAt, startedAt.Add(41*time.Second), ProbeResult{Error: "failed twice"})
	if status.Status != StatusUnhealthy {
		t.Fatalf("expected unhealthy after threshold, got %s", status.Status)
	}
	status = Apply(policy, status, startedAt, startedAt.Add(51*time.Second), ProbeResult{Success: true})
	if status.Status != StatusUnhealthy {
		t.Fatalf("expected success threshold to retain unhealthy status, got %s", status.Status)
	}
	status = Apply(policy, status, startedAt, startedAt.Add(61*time.Second), ProbeResult{Success: true})
	if status.Status != StatusHealthy {
		t.Fatalf("expected healthy after success threshold, got %s", status.Status)
	}
}

func TestLastErrorIsBoundedWithoutBreakingUTF8(t *testing.T) {
	policy, err := Normalize(&Policy{Type: TypeExec, StartPeriod: "0s", FailureThreshold: 1, Exec: &ExecCheck{Command: "false"}})
	if err != nil {
		t.Fatalf("normalize policy: %v", err)
	}
	startedAt := time.Now().UTC().Add(-time.Minute)
	status := Apply(policy, nil, startedAt, time.Now().UTC(), ProbeResult{Error: strings.Repeat("é", 600)})
	if len(status.LastError) > maxLastErrorLength {
		t.Fatalf("last error exceeded %d bytes", maxLastErrorLength)
	}
	if !utf8.ValidString(status.LastError) {
		t.Fatal("last error is not valid UTF-8")
	}
}
