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
package builds

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"

	clitypes "github.com/docker/cli/cli/config/types"
	"github.com/moby/buildkit/session"
	"github.com/moby/buildkit/session/auth/authprovider"
	"github.com/snapflowio/microvm-go/types"
)

type registryCredentials map[string]clitypes.AuthConfig

func newRegistryCredentials(sourceRegistries []types.Registry, cache cacheRegistry) (registryCredentials, error) {
	credentials := make(registryCredentials, len(sourceRegistries)+1)
	for _, current := range sourceRegistries {
		if current.Username == "" && current.Password == "" {
			continue
		}
		host, err := registryHost(current.URL)
		if err != nil {
			return nil, err
		}
		credentials[host] = clitypes.AuthConfig{Username: current.Username, Password: current.Password, ServerAddress: host}
	}
	if _, exists := credentials[cache.host]; !exists {
		credentials[cache.host] = clitypes.AuthConfig{Username: cache.username, Password: cache.password, ServerAddress: cache.host}
	}
	return credentials, nil
}

func (credentials registryCredentials) lookup(
	ctx context.Context,
	host string,
	scope []string,
	cacheCheck authprovider.ExpireCachedAuthCheck,
) (clitypes.AuthConfig, error) {
	return credentials[host], nil
}

func (credentials registryCredentials) attachable() session.Attachable {
	return authprovider.NewDockerAuthProvider(authprovider.DockerAuthProviderConfig{AuthConfigProvider: credentials.lookup})
}

func registryHost(value string) (string, error) {
	endpoint, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return "", fmt.Errorf("parse builder registry URL: %w", err)
	}
	if endpoint.Host == "" || (endpoint.Scheme != "http" && endpoint.Scheme != "https") {
		return "", errors.New("builder registry URL must use HTTP or HTTPS and include a host")
	}
	if endpoint.User != nil || strings.Trim(endpoint.Path, "/") != "" || endpoint.RawQuery != "" || endpoint.Fragment != "" {
		return "", errors.New("builder registry URL must contain only a scheme and host")
	}
	return endpoint.Host, nil
}
