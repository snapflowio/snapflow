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
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"strings"

	"github.com/moby/buildkit/client"
	"github.com/pelletier/go-toml/v2"
	"github.com/snapflowio/microvm-go/types"
)

const (
	buildCacheTag     = "cache"
	registryCacheType = "registry"
	ociWorker         = "oci"

	cacheReferenceAttribute     = "ref"
	cacheModeAttribute          = "mode"
	cacheModeMax                = "max"
	cacheIgnoreErrorAttribute   = "ignore-error"
	cacheImageManifestAttribute = "image-manifest"
	buildCacheKeyBytes          = 16
	dockerHubRegistry           = "docker.io"
	dockerHubMirrorPath         = "/mirror/docker.io"
	loopbackHostname            = "localhost"
	insecureRegistryHTTP        = "http"
)

type cacheRegistry struct {
	host       string
	insecure   bool
	username   string
	password   string
	repository string
}

type buildkitRegistryConfig struct {
	Mirrors []string `toml:"mirrors,omitempty"`
	HTTP    bool     `toml:"http,omitempty"`
}

type buildkitWorkerConfig struct {
	GC           bool   `toml:"gc"`
	MaxUsedSpace string `toml:"maxUsedSpace"`
}

type buildkitConfig struct {
	Worker   map[string]buildkitWorkerConfig   `toml:"worker"`
	Registry map[string]buildkitRegistryConfig `toml:"registry"`
}

func resolveCacheRegistry(registry *types.Registry, hostGateway string) (cacheRegistry, error) {
	if registry == nil {
		return cacheRegistry{}, errors.New("build cache registry is required")
	}
	if registry.Project == nil || strings.Trim(*registry.Project, "/") == "" {
		return cacheRegistry{}, errors.New("build cache registry project is required")
	}
	if registry.Username == "" || registry.Password == "" {
		return cacheRegistry{}, errors.New("build cache registry credential is required")
	}
	host, err := registryHost(registry.URL)
	if err != nil {
		return cacheRegistry{}, err
	}
	endpoint, err := url.Parse(strings.TrimSpace(registry.URL))
	if err != nil {
		return cacheRegistry{}, fmt.Errorf("parse build cache registry URL: %w", err)
	}
	guestHost, err := guestReachableHost(host, hostGateway)
	if err != nil {
		return cacheRegistry{}, err
	}
	return cacheRegistry{
		host:       guestHost,
		insecure:   endpoint.Scheme == insecureRegistryHTTP,
		username:   registry.Username,
		password:   registry.Password,
		repository: strings.Trim(*registry.Project, "/"),
	}, nil
}

func guestReachableHost(host, hostGateway string) (string, error) {
	hostname, port, err := net.SplitHostPort(host)
	if err != nil {
		hostname, port = host, ""
	}
	if !isLoopbackHost(hostname) {
		return host, nil
	}
	if strings.TrimSpace(hostGateway) == "" {
		return "", fmt.Errorf("build cache registry %s is on the host loopback but no guest gateway is configured", host)
	}
	if port == "" {
		return hostGateway, nil
	}
	return net.JoinHostPort(hostGateway, port), nil
}

func isLoopbackHost(hostname string) bool {
	if strings.EqualFold(hostname, loopbackHostname) {
		return true
	}
	address, err := netip.ParseAddr(hostname)
	return err == nil && address.IsLoopback()
}

func (registry cacheRegistry) reference(dockerfile string) string {
	digest := sha256.Sum256([]byte(dockerfile))
	return registry.host + "/" + registry.repository + "/" + hex.EncodeToString(digest[:buildCacheKeyBytes]) + ":" + buildCacheTag
}

func (registry cacheRegistry) cacheImports(dockerfile string) []client.CacheOptionsEntry {
	return []client.CacheOptionsEntry{{
		Type:  registryCacheType,
		Attrs: map[string]string{cacheReferenceAttribute: registry.reference(dockerfile)},
	}}
}

func (registry cacheRegistry) cacheExports(dockerfile string) []client.CacheOptionsEntry {
	return []client.CacheOptionsEntry{{
		Type: registryCacheType,
		Attrs: map[string]string{
			cacheReferenceAttribute:     registry.reference(dockerfile),
			cacheModeAttribute:          cacheModeMax,
			cacheIgnoreErrorAttribute:   enabledAttribute,
			cacheImageManifestAttribute: enabledAttribute,
			ociMediaTypesAttribute:      enabledAttribute,
		},
	}}
}

func (registry cacheRegistry) daemonConfig() ([]byte, error) {
	config := buildkitConfig{
		Worker: map[string]buildkitWorkerConfig{
			ociWorker: {GC: true, MaxUsedSpace: builderMaxUsedSpace},
		},
		Registry: map[string]buildkitRegistryConfig{
			dockerHubRegistry: {Mirrors: []string{registry.host + dockerHubMirrorPath}},
		},
	}
	if registry.insecure {
		config.Registry[registry.host] = buildkitRegistryConfig{HTTP: true}
	}
	data, err := toml.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("encode BuildKit configuration: %w", err)
	}
	return data, nil
}
