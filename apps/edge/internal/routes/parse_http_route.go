// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"errors"
	"fmt"
	"strings"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	maximumHTTPBodyBytes           = 1 << 30
	maximumHTTPHostnamesPerRoute   = 24
	maximumHTTPRouteTrafficWeight  = 100
	maximumHTTPRoutePathLength     = 2048
	maximumHTTPRetries             = 5
	invalidHTTPRoutePathCharacters = "\\?#%\r\n\x00"
	protocolRelativePathPrefix     = "//"
)

func parseHTTPRoute(input *apiclient.EdgeHttpRouteDto) (HTTP, error) {
	base, err := parseBase(httpRouteInput(input))
	if err != nil {
		return HTTP{}, err
	}
	if string(input.Protocol) != string(protocol.ProtocolHTTP) {
		return HTTP{}, fmt.Errorf("invalid HTTP route protocol %q", input.Protocol)
	}
	if input.TrafficWeight < 0 || input.TrafficWeight > maximumHTTPRouteTrafficWeight {
		return HTTP{}, errors.New("machine HTTP route traffic weight is invalid")
	}
	policy, err := parseHTTPPolicy(input.Policy, base.TargetPort)
	if err != nil {
		return HTTP{}, err
	}
	hostnames, err := parseHTTPHostnames(input.Hostnames, base.PublicHost)
	if err != nil {
		return HTTP{}, err
	}
	return HTTP{
		Base:          base,
		Hostnames:     hostnames,
		TrafficWeight: uint16(input.TrafficWeight),
		Policy:        policy,
	}, nil
}

func parseHTTPPolicy(policy apiclient.EdgeHttpRoutePolicyDto, targetPort uint16) (HTTPPolicy, error) {
	visibility := HTTPVisibility(policy.Visibility)
	if visibility != HTTPVisibilityPublic && visibility != HTTPVisibilityProtected {
		return HTTPPolicy{}, fmt.Errorf("invalid HTTP visibility %q", visibility)
	}
	if visibility == HTTPVisibilityPublic && RequiresProtectedHTTP(targetPort) {
		return HTTPPolicy{}, errors.New(
			"sandbox management service ports require protected HTTP access",
		)
	}
	if !isCanonicalText(policy.Path) || !validHTTPRoutePath(policy.Path) ||
		len(policy.Path) > maximumHTTPRoutePathLength {
		return HTTPPolicy{}, errors.New("machine HTTP route path is invalid")
	}
	if err := validateHTTPPolicyLimits(policy); err != nil {
		return HTTPPolicy{}, err
	}
	upstream := HTTPUpstreamProtocol(policy.UpstreamProtocol)
	if upstream != HTTPUpstreamHTTP1 && upstream != HTTPUpstreamH2C {
		return HTTPPolicy{}, fmt.Errorf("invalid HTTP upstream protocol %q", upstream)
	}
	return HTTPPolicy{
		Visibility:          visibility,
		Path:                policy.Path,
		StripPath:           policy.StripPath,
		ForceHTTPS:          policy.ForceHttps,
		RequireTrustedProxy: policy.RequireTrustedProxy,
		MaxBodyBytes:        policy.MaxBodyBytes,
		ReadTimeout:         seconds(policy.ReadTimeoutSeconds),
		SendTimeout:         seconds(policy.SendTimeoutSeconds),
		Retries:             int(policy.Retries),
		Streaming:           policy.Streaming,
		UpstreamProtocol:    upstream,
		AllowedOrigins:      append([]string(nil), policy.AllowedOrigins...),
		AllowCredentials:    policy.AllowCredentials,
		ShowBrowserWarning:  policy.ShowBrowserWarning,
	}, nil
}

func validateHTTPPolicyLimits(policy apiclient.EdgeHttpRoutePolicyDto) error {
	if policy.MaxBodyBytes < 0 || policy.MaxBodyBytes > maximumHTTPBodyBytes {
		return errors.New("machine HTTP maximum body size is invalid")
	}
	if err := validateSeconds(policy.ReadTimeoutSeconds, true); err != nil {
		return fmt.Errorf("machine HTTP read timeout: %w", err)
	}
	if err := validateSeconds(policy.SendTimeoutSeconds, true); err != nil {
		return fmt.Errorf("machine HTTP send timeout: %w", err)
	}
	if policy.Retries < 0 || policy.Retries > maximumHTTPRetries {
		return errors.New("machine HTTP retry count is invalid")
	}
	return nil
}

func parseHTTPHostnames(values []string, publicHost string) ([]string, error) {
	if len(values) < 1 || len(values) > maximumHTTPHostnamesPerRoute {
		return nil, fmt.Errorf(
			"HTTP route must have between 1 and %d hostnames",
			maximumHTTPHostnamesPerRoute,
		)
	}
	hostnames := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if !IsValidHostname(value) {
			return nil, errors.New("machine HTTP route hostname is invalid")
		}
		hostname := NormalizeHost(value)
		if _, exists := seen[hostname]; exists {
			return nil, fmt.Errorf("duplicate HTTP route hostname %q", hostname)
		}
		seen[hostname] = struct{}{}
		hostnames = append(hostnames, hostname)
	}
	if _, found := seen[publicHost]; !found {
		return nil, errors.New("HTTP route hostnames must include its canonical public host")
	}
	return hostnames, nil
}

func validHTTPRoutePath(value string) bool {
	return strings.HasPrefix(value, rootPath) &&
		!strings.HasPrefix(value, protocolRelativePathPrefix) &&
		!strings.ContainsAny(value, invalidHTTPRoutePathCharacters)
}
