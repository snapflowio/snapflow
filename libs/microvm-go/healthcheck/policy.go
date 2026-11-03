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
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	defaultInterval         = 10 * time.Second
	defaultTimeout          = 2 * time.Second
	defaultStartPeriod      = 30 * time.Second
	defaultFailureThreshold = 3
	defaultSuccessThreshold = 1
	defaultHTTPPath         = "/"
	schemeHTTP              = "http"
	schemeHTTPS             = "https"
	minimumHTTPStatus       = 100
	maximumHTTPStatus       = 599
)

func Enabled(policy *Policy) bool {
	return policy != nil && policy.Type != "" && policy.Type != TypeNone
}

func Normalize(policy *Policy) (*Policy, error) {
	if policy == nil {
		return nil, nil
	}
	normalized := clonePolicy(policy)
	if normalized.Type == "" {
		typeValue, err := inferType(normalized)
		if err != nil {
			return nil, err
		}
		normalized.Type = typeValue
	}
	if normalized.Type == "" || normalized.Type == TypeNone {
		return nil, nil
	}
	applyTimingDefaults(normalized)
	if err := validateTiming(normalized); err != nil {
		return nil, err
	}
	if err := normalizeProbe(normalized); err != nil {
		return nil, err
	}
	return normalized, nil
}

func applyTimingDefaults(policy *Policy) {
	if policy.Interval == "" {
		policy.Interval = defaultInterval.String()
	}
	if policy.Timeout == "" {
		policy.Timeout = defaultTimeout.String()
	}
	if policy.StartPeriod == "" {
		policy.StartPeriod = defaultStartPeriod.String()
	}
	if policy.FailureThreshold == 0 {
		policy.FailureThreshold = defaultFailureThreshold
	}
	if policy.SuccessThreshold == 0 {
		policy.SuccessThreshold = defaultSuccessThreshold
	}
}

func validateTiming(policy *Policy) error {
	timing, err := ParseTiming(policy)
	if err != nil {
		return err
	}
	if timing.Timeout > timing.Interval {
		return errors.New("health check timeout must not exceed interval")
	}
	if policy.FailureThreshold < 1 || policy.SuccessThreshold < 1 {
		return errors.New("health check thresholds must be at least 1")
	}
	return nil
}

func normalizeProbe(policy *Policy) error {
	switch policy.Type {
	case TypeHTTP:
		if policy.HTTP == nil || policy.TCP != nil || policy.Exec != nil {
			return errors.New("http health check requires only the http configuration")
		}
		return normalizeHTTPCheck(policy.HTTP)
	case TypeTCP:
		if policy.TCP == nil || policy.HTTP != nil || policy.Exec != nil || policy.TCP.Port == 0 {
			return errors.New("tcp health check requires only a non-zero tcp port")
		}
		return nil
	case TypeExec:
		if policy.Exec == nil || policy.HTTP != nil || policy.TCP != nil || strings.TrimSpace(policy.Exec.Command) == "" {
			return errors.New("exec health check requires only a command")
		}
		return nil
	default:
		return errors.New("health check type must be one of none, http, tcp, or exec")
	}
}

func normalizeHTTPCheck(check *HTTPCheck) error {
	if check.Port == 0 {
		return errors.New("http health check port is required")
	}
	if check.Path == "" {
		check.Path = defaultHTTPPath
	}
	if !strings.HasPrefix(check.Path, defaultHTTPPath) {
		return errors.New("http health check path must start with /")
	}
	if check.Scheme == "" {
		check.Scheme = schemeHTTP
	}
	if check.Scheme != schemeHTTP && check.Scheme != schemeHTTPS {
		return errors.New("http health check scheme must be http or https")
	}
	if check.ExpectedStatus == 0 {
		check.ExpectedStatus = http.StatusOK
	}
	if check.ExpectedStatus < minimumHTTPStatus || check.ExpectedStatus > maximumHTTPStatus {
		return fmt.Errorf("http health check expected status must be between %d and %d", minimumHTTPStatus, maximumHTTPStatus)
	}
	return nil
}

type Timing struct {
	Interval    time.Duration
	Timeout     time.Duration
	StartPeriod time.Duration
}

func ParseTiming(policy *Policy) (Timing, error) {
	if policy == nil {
		return Timing{
			Interval:    defaultInterval,
			Timeout:     defaultTimeout,
			StartPeriod: defaultStartPeriod,
		}, nil
	}
	interval, err := positiveDuration("health check interval", policy.Interval, defaultInterval)
	if err != nil {
		return Timing{}, err
	}
	timeout, err := positiveDuration("health check timeout", policy.Timeout, defaultTimeout)
	if err != nil {
		return Timing{}, err
	}
	startPeriod, err := nonNegativeDuration("health check start period", policy.StartPeriod, defaultStartPeriod)
	if err != nil {
		return Timing{}, err
	}
	return Timing{
		Interval:    interval,
		Timeout:     timeout,
		StartPeriod: startPeriod,
	}, nil
}

func clonePolicy(policy *Policy) *Policy {
	clone := *policy
	if policy.HTTP != nil {
		value := *policy.HTTP
		clone.HTTP = &value
	}
	if policy.TCP != nil {
		value := *policy.TCP
		clone.TCP = &value
	}
	if policy.Exec != nil {
		value := *policy.Exec
		clone.Exec = &value
	}
	return &clone
}

func inferType(policy *Policy) (Type, error) {
	var values []Type
	if policy.HTTP != nil {
		values = append(values, TypeHTTP)
	}
	if policy.TCP != nil {
		values = append(values, TypeTCP)
	}
	if policy.Exec != nil {
		values = append(values, TypeExec)
	}
	if len(values) > 1 {
		return "", fmt.Errorf("health check must configure exactly one probe type")
	}
	if len(values) == 0 {
		return TypeNone, nil
	}
	return values[0], nil
}

func positiveDuration(name, raw string, fallback time.Duration) (time.Duration, error) {
	value, err := duration(raw, fallback)
	if err != nil {
		return 0, fmt.Errorf("%s is invalid: %w", name, err)
	}
	if value <= 0 {
		return 0, fmt.Errorf("%s must be positive", name)
	}
	return value, nil
}

func nonNegativeDuration(name, raw string, fallback time.Duration) (time.Duration, error) {
	value, err := duration(raw, fallback)
	if err != nil {
		return 0, fmt.Errorf("%s is invalid: %w", name, err)
	}
	if value < 0 {
		return 0, fmt.Errorf("%s must not be negative", name)
	}
	return value, nil
}

func duration(raw string, fallback time.Duration) (time.Duration, error) {
	if strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	return time.ParseDuration(raw)
}
