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

package imagecache

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/google/go-containerregistry/pkg/name"
	"github.com/snapflowio/microvm-go/types"
)

const dockerHubRegistryAPIHost = "registry-1.docker.io"

func parseRegistryReference(imageRef string, registry *types.Registry) (name.Reference, error) {
	options := []name.Option{name.StrictValidation}
	var registryHost string
	if registry != nil {
		endpoint, err := url.Parse(strings.TrimSpace(registry.URL))
		if err != nil {
			return nil, fmt.Errorf("parse registry URL: %w", err)
		}
		if endpoint.Host == "" {
			return nil, fmt.Errorf("registry URL must include a host")
		}
		switch endpoint.Scheme {
		case "http":
			options = append(options, name.Insecure)
		case "https":
		default:
			return nil, fmt.Errorf("registry URL must use http or https")
		}
		registryHost, err = canonicalRegistryHost(endpoint.Host, options...)
		if err != nil {
			return nil, fmt.Errorf("parse registry URL host: %w", err)
		}
	}

	reference, err := name.ParseReference(imageRef, options...)
	if err != nil {
		return nil, err
	}
	if registryHost != "" && !strings.EqualFold(reference.Context().RegistryStr(), registryHost) {
		return nil, fmt.Errorf(
			"registry URL host %s does not match image registry %s",
			registryHost,
			reference.Context().RegistryStr(),
		)
	}
	return reference, nil
}

func canonicalRegistryHost(host string, options ...name.Option) (string, error) {
	host = strings.ToLower(strings.TrimSpace(host))
	if host == dockerHubRegistryAPIHost {
		host = name.DefaultRegistry
	}
	registry, err := name.NewRegistry(host, options...)
	if err != nil {
		return "", err
	}
	return registry.RegistryStr(), nil
}
