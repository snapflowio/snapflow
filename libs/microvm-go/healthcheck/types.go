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

import "time"

type Type string

const (
	TypeNone Type = "none"
	TypeHTTP Type = "http"
	TypeTCP  Type = "tcp"
	TypeExec Type = "exec"
)

type Status string

const (
	StatusDisabled  Status = "disabled"
	StatusStarting  Status = "starting"
	StatusHealthy   Status = "healthy"
	StatusUnhealthy Status = "unhealthy"
	StatusUnknown   Status = "unknown"
)

type Policy struct {
	Type             Type       `json:"type,omitempty"`
	Interval         string     `json:"interval,omitempty"`
	Timeout          string     `json:"timeout,omitempty"`
	StartPeriod      string     `json:"startPeriod,omitempty"`
	FailureThreshold int        `json:"failureThreshold,omitempty"`
	SuccessThreshold int        `json:"successThreshold,omitempty"`
	HTTP             *HTTPCheck `json:"http,omitempty"`
	TCP              *TCPCheck  `json:"tcp,omitempty"`
	Exec             *ExecCheck `json:"exec,omitempty"`
}

type HTTPCheck struct {
	Port           uint16 `json:"port"`
	Path           string `json:"path,omitempty"`
	Scheme         string `json:"scheme,omitempty"`
	ExpectedStatus int    `json:"expectedStatus,omitempty"`
}

type TCPCheck struct {
	Port uint16 `json:"port"`
}

type ExecCheck struct {
	Command    string `json:"command"`
	WorkingDir string `json:"workingDir,omitempty"`
}

type Runtime struct {
	Status               Status     `json:"status,omitempty"`
	StartedAt            *time.Time `json:"startedAt,omitempty"`
	ConsecutiveSuccesses int        `json:"consecutiveSuccesses,omitempty"`
	ConsecutiveFailures  int        `json:"consecutiveFailures,omitempty"`
	LastCheckedAt        *time.Time `json:"lastCheckedAt,omitempty"`
	LastSuccessAt        *time.Time `json:"lastSuccessAt,omitempty"`
	LastFailureAt        *time.Time `json:"lastFailureAt,omitempty"`
	LastError            string     `json:"lastError,omitempty"`
}

type ProbeResult struct {
	Success bool
	Error   string
}
