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
	"encoding/base64"
	"fmt"
	"net/url"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"
)

const ControlProtocolVersion = 1

const ServiceCredentialRoot = "/run/snapflow/credentials/services"

func ServiceCredentialPath(serviceName string) string {
	return filepath.Join(ServiceCredentialRoot, serviceName)
}

type ServiceAuthScheme string

const (
	ServiceAuthToken         ServiceAuthScheme = ""
	ServiceAuthBasic         ServiceAuthScheme = "basic"
	ServiceBasicAuthUsername                   = "snapflow"
	basicAuthPrefix                            = "Basic "
	basicAuthSeparator                         = ":"
)

const ServiceLoopbackAddress = "127.0.0.1"

const maximumServicePort = 65535

type LifecycleOperation string

const (
	LifecycleOperationIdentity LifecycleOperation = "identity"
	LifecycleOperationQuiesce  LifecycleOperation = "quiesce"
	LifecycleOperationResume   LifecycleOperation = "resume"
	LifecycleOperationWorkload LifecycleOperation = "workload"
)

func LifecycleOperationPath(operation LifecycleOperation) string {
	return fmt.Sprintf("/v%d/%s", ControlProtocolVersion, operation)
}

type Capability string

type ActivationPolicy string

type (
	SandboxCapability string
	EnvironmentSource string
)

const (
	CapabilityHealth       Capability = "health"
	CapabilitySecrets      Capability = "secrets"
	CapabilityTelemetry    Capability = "telemetry"
	CapabilitySnapshot     Capability = "snapshot_quiesce"
	CapabilityForkIdentity Capability = "fork_identity"
	CapabilityWorkloadInit Capability = "workload_initialization"

	ActivationRequired    ActivationPolicy = "required"
	ActivationWhenEnabled ActivationPolicy = "when_enabled"
	ActivationOnDemand    ActivationPolicy = "on_demand"

	SandboxCapabilityDeveloperTools SandboxCapability = "developer_tools"
	SandboxCapabilityDesktop        SandboxCapability = "desktop"

	EnvironmentSourceSandboxWorkdir EnvironmentSource = "sandbox_workdir"
	EnvironmentSourceSandboxOSUser  EnvironmentSource = "sandbox_os_user"
)

type Service struct {
	Name       string            `json:"name"`
	Port       uint32            `json:"port"`
	AuthHeader string            `json:"authHeader,omitempty"`
	AuthScheme ServiceAuthScheme `json:"authScheme,omitempty"`
	Credential bool              `json:"credential,omitempty"`
	HealthPath string            `json:"healthPath,omitempty"`
}

func (service Service) AuthorizationValue(credential string) string {
	if service.AuthScheme == ServiceAuthBasic {
		return basicAuthPrefix + base64.StdEncoding.EncodeToString([]byte(ServiceBasicAuthUsername+basicAuthSeparator+credential))
	}
	return credential
}

type Manifest struct {
	Name                   string                       `json:"name"`
	Version                string                       `json:"version"`
	GuestPath              string                       `json:"guestPath"`
	Args                   []string                     `json:"args,omitempty"`
	Env                    map[string]string            `json:"env,omitempty"`
	EnvSources             map[string]EnvironmentSource `json:"envSources,omitempty"`
	Services               []Service                    `json:"services,omitempty"`
	Activation             ActivationPolicy             `json:"activation"`
	SandboxCapability      SandboxCapability            `json:"sandboxCapability,omitempty"`
	LifecycleSocket        string                       `json:"lifecycleSocket,omitempty"`
	ControlProtocolVersion int                          `json:"controlProtocolVersion"`
	RequiredCapabilities   []Capability                 `json:"requiredCapabilities,omitempty"`
	Capabilities           []Capability                 `json:"capabilities,omitempty"`
	CapabilityExtensions   []CapabilityExtension        `json:"capabilityExtensions,omitempty"`
}

var (
	componentNamePattern   = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
	headerNamePattern      = regexp.MustCompile(`^[!#$%&'*+.^_` + "`" + `|~0-9A-Za-z-]+$`)
	environmentNamePattern = regexp.MustCompile(`^[A-Z_][A-Z0-9_]*$`)
)

func ValidateManifest(manifest Manifest) error {
	expanded, err := expandCapabilityExtensions(manifest)
	if err != nil {
		return fmt.Errorf("guest component %q: %w", manifest.Name, err)
	}
	return validateExpandedManifest(expanded)
}

func validateExpandedManifest(manifest Manifest) error {
	for _, validate := range []func(Manifest) error{
		validateManifestIdentity,
		validateManifestActivation,
		validateManifestLifecycle,
		validateManifestEnvironment,
		validateManifestCapabilities,
		validateManifestServices,
	} {
		if err := validate(manifest); err != nil {
			return err
		}
	}
	return nil
}

func validateManifestIdentity(manifest Manifest) error {
	if !componentNamePattern.MatchString(manifest.Name) {
		return fmt.Errorf("guest component name %q must match %s", manifest.Name, componentNamePattern)
	}
	if strings.TrimSpace(manifest.Version) == "" {
		return fmt.Errorf("guest component %q version is required", manifest.Name)
	}
	if !cleanAbsolutePath(manifest.GuestPath) {
		return fmt.Errorf("guest component %q path must be a clean absolute path", manifest.Name)
	}
	if manifest.ControlProtocolVersion != ControlProtocolVersion {
		return fmt.Errorf("guest component %q requires unsupported control protocol %d", manifest.Name, manifest.ControlProtocolVersion)
	}
	return nil
}

func validateManifestActivation(manifest Manifest) error {
	if !manifest.Activation.Valid() {
		return fmt.Errorf("guest component %q has invalid activation policy %q", manifest.Name, manifest.Activation)
	}
	if manifest.Activation != ActivationRequired && !manifest.SandboxCapability.Valid() {
		return fmt.Errorf("guest component %q requires a sandbox capability", manifest.Name)
	}
	if manifest.Activation == ActivationRequired && manifest.SandboxCapability != "" {
		return fmt.Errorf("required guest component %q cannot be capability-gated", manifest.Name)
	}
	if manifest.Activation.StartsAutomatically() && !slices.Contains(manifest.Capabilities, CapabilityWorkloadInit) {
		return fmt.Errorf("automatically started guest component %q must declare %s to receive its workload", manifest.Name, CapabilityWorkloadInit)
	}
	return nil
}

func validateManifestLifecycle(manifest Manifest) error {
	if manifest.LifecycleSocket != "" && !cleanAbsolutePath(manifest.LifecycleSocket) {
		return fmt.Errorf("guest component %q lifecycle socket must be a clean absolute path", manifest.Name)
	}
	operations := LifecycleOperationsFor(manifest)
	if len(operations) > 0 && manifest.LifecycleSocket == "" {
		return fmt.Errorf("guest component %q declares lifecycle capabilities without a lifecycle socket", manifest.Name)
	}
	if len(operations) == 0 && manifest.LifecycleSocket != "" {
		return fmt.Errorf("guest component %q has a lifecycle socket but declares no lifecycle capability", manifest.Name)
	}
	return nil
}

func validateManifestEnvironment(manifest Manifest) error {
	for name, source := range manifest.EnvSources {
		if !environmentNamePattern.MatchString(name) {
			return fmt.Errorf("guest component %q has invalid sourced environment variable %q", manifest.Name, name)
		}
		if _, exists := manifest.Env[name]; exists {
			return fmt.Errorf("guest component %q configures environment variable %q twice", manifest.Name, name)
		}
		if !source.Valid() {
			return fmt.Errorf("guest component %q has invalid environment source %q", manifest.Name, source)
		}
	}
	return nil
}

func validateManifestCapabilities(manifest Manifest) error {
	for _, capability := range slices.Concat(manifest.RequiredCapabilities, manifest.Capabilities) {
		if !capability.known() {
			return fmt.Errorf("guest component %q declares unknown capability %q", manifest.Name, capability)
		}
	}
	return nil
}

func (capability Capability) known() bool {
	switch capability {
	case CapabilityHealth, CapabilitySecrets, CapabilityTelemetry, CapabilitySnapshot, CapabilityForkIdentity, CapabilityWorkloadInit:
		return true
	default:
		return false
	}
}

func validateManifestServices(manifest Manifest) error {
	services := make(map[string]struct{}, len(manifest.Services))
	ports := make(map[uint32]struct{}, len(manifest.Services))
	for _, service := range manifest.Services {
		if err := validateService(manifest.Name, service); err != nil {
			return err
		}
		if _, exists := services[service.Name]; exists {
			return fmt.Errorf("guest component %q repeats service %q", manifest.Name, service.Name)
		}
		if _, exists := ports[service.Port]; exists {
			return fmt.Errorf("guest component %q repeats port %d", manifest.Name, service.Port)
		}
		services[service.Name], ports[service.Port] = struct{}{}, struct{}{}
	}
	return nil
}

func validateService(componentName string, service Service) error {
	if !componentNamePattern.MatchString(service.Name) || service.Port == 0 || service.Port > maximumServicePort {
		return fmt.Errorf("guest component %q has invalid service %q:%d", componentName, service.Name, service.Port)
	}
	if service.AuthHeader != "" && !headerNamePattern.MatchString(service.AuthHeader) {
		return fmt.Errorf("guest component %q service %q has invalid auth header", componentName, service.Name)
	}
	if service.AuthHeader != "" && !service.Credential {
		return fmt.Errorf("guest component %q service %q with HTTP authentication must declare a credential", componentName, service.Name)
	}
	if err := validateServiceAuthScheme(service); err != nil {
		return fmt.Errorf("guest component %q service %q: %w", componentName, service.Name, err)
	}
	if err := validateServiceHealthPath(service.HealthPath); err != nil {
		return fmt.Errorf("guest component %q service %q: %w", componentName, service.Name, err)
	}
	return nil
}

func cleanAbsolutePath(value string) bool {
	return filepath.IsAbs(value) && filepath.Clean(value) == value
}

func (policy ActivationPolicy) Valid() bool {
	switch policy {
	case ActivationRequired, ActivationWhenEnabled, ActivationOnDemand:
		return true
	default:
		return false
	}
}

func (policy ActivationPolicy) StartsAutomatically() bool {
	return policy == ActivationRequired || policy == ActivationWhenEnabled
}

func (capability SandboxCapability) Valid() bool {
	switch capability {
	case SandboxCapabilityDeveloperTools, SandboxCapabilityDesktop:
		return true
	default:
		return false
	}
}

func (source EnvironmentSource) Valid() bool {
	switch source {
	case EnvironmentSourceSandboxWorkdir, EnvironmentSourceSandboxOSUser:
		return true
	default:
		return false
	}
}

func ValidateSandboxCapabilities(capabilities []SandboxCapability) error {
	seen := make(map[SandboxCapability]struct{}, len(capabilities))
	for _, capability := range capabilities {
		if !capability.Valid() {
			return fmt.Errorf("unknown sandbox capability %q", capability)
		}
		if _, exists := seen[capability]; exists {
			return fmt.Errorf("duplicate sandbox capability %q", capability)
		}
		seen[capability] = struct{}{}
	}
	return nil
}

func validateServiceHealthPath(value string) error {
	if value == "" {
		return nil
	}
	parsed, err := url.ParseRequestURI(value)
	if err != nil || !strings.HasPrefix(value, "/") || parsed.IsAbs() || parsed.Host != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return fmt.Errorf("health path %q must be an absolute path without a host, query, or fragment", value)
	}
	return nil
}

type LifecycleHook struct {
	Name       string               `json:"name" toml:"name"`
	SocketPath string               `json:"socketPath" toml:"socket_path"`
	Operations []LifecycleOperation `json:"operations" toml:"operations"`
}

func (hook LifecycleHook) Handles(operation LifecycleOperation) bool {
	return slices.Contains(hook.Operations, operation)
}

func LifecycleOperationsFor(manifest Manifest) []LifecycleOperation {
	var operations []LifecycleOperation
	if slices.Contains(manifest.Capabilities, CapabilityForkIdentity) {
		operations = append(operations, LifecycleOperationIdentity)
	}
	if slices.Contains(manifest.Capabilities, CapabilitySnapshot) {
		operations = append(operations, LifecycleOperationQuiesce, LifecycleOperationResume)
	}
	if slices.Contains(manifest.Capabilities, CapabilityWorkloadInit) {
		operations = append(operations, LifecycleOperationWorkload)
	}
	return operations
}

type Identity struct {
	InstanceID string `json:"instanceId"`
}

type Workload struct {
	Env map[string]string `json:"env"`
}

func cloneManifest(source Manifest) Manifest {
	result := source
	result.Args = append([]string(nil), source.Args...)
	result.Services = append([]Service(nil), source.Services...)
	result.RequiredCapabilities = append([]Capability(nil), source.RequiredCapabilities...)
	result.Capabilities = append([]Capability(nil), source.Capabilities...)
	result.CapabilityExtensions = cloneCapabilityExtensions(source.CapabilityExtensions)
	if source.Env != nil {
		result.Env = make(map[string]string, len(source.Env))
		keys := make([]string, 0, len(source.Env))
		for key := range source.Env {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			result.Env[key] = source.Env[key]
		}
	}
	if source.EnvSources != nil {
		result.EnvSources = make(map[string]EnvironmentSource, len(source.EnvSources))
		for name, value := range source.EnvSources {
			result.EnvSources[name] = value
		}
	}
	return result
}

func validateServiceAuthScheme(service Service) error {
	switch service.AuthScheme {
	case ServiceAuthToken:
		return nil
	case ServiceAuthBasic:
		if service.AuthHeader == "" {
			return fmt.Errorf("basic authentication requires an auth header")
		}
		return nil
	default:
		return fmt.Errorf("unsupported auth scheme %q", service.AuthScheme)
	}
}
