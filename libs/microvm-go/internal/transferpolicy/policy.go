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

package transferpolicy

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
)

const (
	schemeHTTP      = "http"
	schemeHTTPS     = "https"
	originSeparator = "://"
)

var (
	ErrInvalidAuthority  = errors.New("URL must have a host and no credentials")
	ErrInsecureTransport = errors.New("URL must use HTTPS unless its origin is trusted")
)

type Policy struct {
	trustedOrigins map[string]struct{}
}

func New(origins []string) (Policy, error) {
	trustedOrigins := make(map[string]struct{}, len(origins))
	for _, value := range origins {
		origin, err := parseOrigin(value)
		if err != nil {
			return Policy{}, fmt.Errorf("trusted transfer origin %q: %w", value, err)
		}
		trustedOrigins[origin] = struct{}{}
	}
	return Policy{trustedOrigins: trustedOrigins}, nil
}

func (policy Policy) Parse(rawURL string) (*url.URL, error) {
	target, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return nil, fmt.Errorf("parse transfer URL: %w", err)
	}
	if err := policy.Validate(target); err != nil {
		return nil, err
	}
	return target, nil
}

func (policy Policy) Validate(target *url.URL) error {
	if target == nil || target.Hostname() == "" || target.User != nil {
		return ErrInvalidAuthority
	}
	if target.Scheme == schemeHTTPS || policy.Trusts(target) {
		return nil
	}
	return ErrInsecureTransport
}

func (policy Policy) Trusts(target *url.URL) bool {
	if target == nil {
		return false
	}
	_, trusted := policy.trustedOrigins[origin(target)]
	return trusted
}

func parseOrigin(value string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return "", fmt.Errorf("parse origin: %w", err)
	}
	if parsed.Scheme != schemeHTTP && parsed.Scheme != schemeHTTPS {
		return "", errors.New("origin must use HTTP or HTTPS")
	}
	if parsed.Host == "" || parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("origin must contain only a scheme and authority")
	}
	return origin(parsed), nil
}

func origin(target *url.URL) string {
	return strings.ToLower(target.Scheme + originSeparator + target.Host)
}
