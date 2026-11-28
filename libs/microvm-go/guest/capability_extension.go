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

package guest

import (
	"fmt"
	"maps"
)

type CapabilityExtension struct {
	SandboxCapability SandboxCapability            `json:"sandboxCapability"`
	Env               map[string]string            `json:"env,omitempty"`
	EnvSources        map[string]EnvironmentSource `json:"envSources,omitempty"`
	Services          []Service                    `json:"services,omitempty"`
}

func resolveManifest(manifest Manifest, requested map[SandboxCapability]struct{}) (Manifest, error) {
	resolved := cloneManifest(manifest)
	resolved.CapabilityExtensions = nil
	for _, extension := range manifest.CapabilityExtensions {
		if _, wanted := requested[extension.SandboxCapability]; !wanted {
			continue
		}
		if err := mergeCapabilityExtension(&resolved, extension); err != nil {
			return Manifest{}, fmt.Errorf("guest component %q: %w", manifest.Name, err)
		}
	}
	return resolved, nil
}

func expandCapabilityExtensions(manifest Manifest) (Manifest, error) {
	seen := make(map[SandboxCapability]struct{}, len(manifest.CapabilityExtensions))
	for _, extension := range manifest.CapabilityExtensions {
		if !extension.SandboxCapability.Valid() {
			return Manifest{}, fmt.Errorf("capability extension has unknown sandbox capability %q", extension.SandboxCapability)
		}
		if _, exists := seen[extension.SandboxCapability]; exists {
			return Manifest{}, fmt.Errorf("capability extension for %q is repeated", extension.SandboxCapability)
		}
		seen[extension.SandboxCapability] = struct{}{}
	}
	return resolveManifest(manifest, seen)
}

func mergeCapabilityExtension(manifest *Manifest, extension CapabilityExtension) error {
	if len(extension.Env) > 0 && manifest.Env == nil {
		manifest.Env = make(map[string]string, len(extension.Env))
	}
	for name, value := range extension.Env {
		if _, exists := manifest.Env[name]; exists {
			return fmt.Errorf("capability %q configures environment variable %q twice", extension.SandboxCapability, name)
		}
		manifest.Env[name] = value
	}
	if len(extension.EnvSources) > 0 && manifest.EnvSources == nil {
		manifest.EnvSources = make(map[string]EnvironmentSource, len(extension.EnvSources))
	}
	for name, source := range extension.EnvSources {
		if _, exists := manifest.EnvSources[name]; exists {
			return fmt.Errorf("capability %q configures sourced environment variable %q twice", extension.SandboxCapability, name)
		}
		manifest.EnvSources[name] = source
	}
	manifest.Services = append(manifest.Services, extension.Services...)
	return nil
}

func declaredServices(manifest Manifest) []Service {
	services := append([]Service(nil), manifest.Services...)
	for _, extension := range manifest.CapabilityExtensions {
		services = append(services, extension.Services...)
	}
	return services
}

func cloneCapabilityExtensions(source []CapabilityExtension) []CapabilityExtension {
	if source == nil {
		return nil
	}
	result := make([]CapabilityExtension, len(source))
	for index, extension := range source {
		result[index] = CapabilityExtension{
			SandboxCapability: extension.SandboxCapability,
			Env:               maps.Clone(extension.Env),
			EnvSources:        maps.Clone(extension.EnvSources),
			Services:          append([]Service(nil), extension.Services...),
		}
	}
	return result
}
