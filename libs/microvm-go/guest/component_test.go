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
	"net"
	"net/http"
	"slices"
	"testing"
)

func TestServiceLoopbackAddressIsLoopback(t *testing.T) {
	address := net.ParseIP(ServiceLoopbackAddress)
	if address == nil || !address.IsLoopback() {
		t.Fatalf("service relay address %q must be a loopback IP", ServiceLoopbackAddress)
	}
}

func TestValidateManifestRejectsMissingActivationPolicy(t *testing.T) {
	manifest := Manifest{Name: "toolbox", Version: "v1", GuestPath: "/opt/toolbox"}
	if err := ValidateManifest(manifest); err == nil {
		t.Fatal("expected missing activation policy to be rejected")
	}
}

func TestValidateManifestRequiresWorkloadCapabilityForAutomaticComponents(t *testing.T) {
	for _, activation := range []ActivationPolicy{ActivationRequired, ActivationWhenEnabled} {
		manifest := Manifest{
			Name: "core", Version: "v1", GuestPath: "/opt/core",
			Activation: activation, ControlProtocolVersion: ControlProtocolVersion,
		}
		if activation == ActivationWhenEnabled {
			manifest.SandboxCapability = SandboxCapabilityDesktop
		}
		if err := ValidateManifest(manifest); err == nil {
			t.Fatalf("%s component without the workload capability was accepted", activation)
		}
		manifest.Capabilities = []Capability{CapabilityWorkloadInit}
		if err := ValidateManifest(manifest); err == nil {
			t.Fatalf("%s component with lifecycle capabilities but no socket was accepted", activation)
		}
		manifest.LifecycleSocket = "/run/snapflow/components/core.sock"
		if err := ValidateManifest(manifest); err != nil {
			t.Fatalf("%s component with the workload capability and a socket rejected: %v", activation, err)
		}
	}
	onDemand := Manifest{
		Name: "desktop", Version: "v1", GuestPath: "/opt/desktop",
		Activation: ActivationOnDemand, SandboxCapability: SandboxCapabilityDesktop,
		ControlProtocolVersion: ControlProtocolVersion,
	}
	if err := ValidateManifest(onDemand); err != nil {
		t.Fatalf("on-demand component without lifecycle capabilities rejected: %v", err)
	}
	onDemand.LifecycleSocket = "/run/snapflow/components/desktop.sock"
	if err := ValidateManifest(onDemand); err == nil {
		t.Fatal("component with a lifecycle socket but no lifecycle capability was accepted")
	}
}

func TestLifecycleOperationsFollowDeclaredCapabilities(t *testing.T) {
	manifest := Manifest{Capabilities: []Capability{CapabilityWorkloadInit}}
	if operations := LifecycleOperationsFor(manifest); !slices.Equal(operations, []LifecycleOperation{LifecycleOperationWorkload}) {
		t.Fatalf("workload-only operations = %v", operations)
	}
	manifest.Capabilities = []Capability{CapabilityForkIdentity, CapabilitySnapshot, CapabilityWorkloadInit}
	want := []LifecycleOperation{LifecycleOperationIdentity, LifecycleOperationQuiesce, LifecycleOperationResume, LifecycleOperationWorkload}
	if operations := LifecycleOperationsFor(manifest); !slices.Equal(operations, want) {
		t.Fatalf("operations = %v, want %v", operations, want)
	}
	hook := LifecycleHook{Name: "core", Operations: []LifecycleOperation{LifecycleOperationWorkload}}
	if !hook.Handles(LifecycleOperationWorkload) || hook.Handles(LifecycleOperationIdentity) {
		t.Fatalf("hook %v handles the wrong operations", hook)
	}
}

func TestValidateManifestRejectsConflictingEnvironmentSources(t *testing.T) {
	manifest := Manifest{
		Name: "toolbox", Version: "v1", GuestPath: "/opt/toolbox",
		Activation: ActivationRequired, ControlProtocolVersion: ControlProtocolVersion,
		LifecycleSocket: "/run/snapflow/components/core.sock",
		Capabilities:    []Capability{CapabilityWorkloadInit},
		Env:             map[string]string{"SANDBOX_WORKDIR": "/workspace"},
		EnvSources: map[string]EnvironmentSource{
			"SANDBOX_WORKDIR": EnvironmentSourceSandboxWorkdir,
		},
	}
	if err := ValidateManifest(manifest); err == nil {
		t.Fatal("expected duplicate static and sourced environment variable to be rejected")
	}
}

func TestServiceAuthorizationValuePresentsCredentialPerScheme(t *testing.T) {
	const credential = "guest-credential"
	token := Service{Name: "toolbox", AuthHeader: "X-Snapflow-Guest-Token"}
	if value := token.AuthorizationValue(credential); value != credential {
		t.Fatalf("token scheme value = %q, want the raw credential", value)
	}
	basic := Service{Name: "desktop", AuthHeader: "Authorization", AuthScheme: ServiceAuthBasic}
	request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, "http://desktop.guest.internal/", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	request.Header.Set(basic.AuthHeader, basic.AuthorizationValue(credential))
	user, password, ok := request.BasicAuth()
	if !ok || user != ServiceBasicAuthUsername || password != credential {
		t.Fatalf("basic scheme presented user %q password %q (parsed %v)", user, password, ok)
	}
}

func TestValidateManifestChecksServiceAuthScheme(t *testing.T) {
	manifest := func(service Service) Manifest {
		return Manifest{
			Name: "core", Version: "v1", GuestPath: "/opt/core",
			Activation: ActivationRequired, ControlProtocolVersion: ControlProtocolVersion,
			LifecycleSocket: "/run/snapflow/components/core.sock",
			Capabilities:    []Capability{CapabilityWorkloadInit},
			Services:        []Service{service},
		}
	}
	valid := Service{
		Name: "desktop", Port: 6080, AuthHeader: "Authorization",
		AuthScheme: ServiceAuthBasic, Credential: true,
	}
	if err := ValidateManifest(manifest(valid)); err != nil {
		t.Fatalf("valid basic auth service rejected: %v", err)
	}
	withoutCredential := valid
	withoutCredential.Credential = false
	if err := ValidateManifest(manifest(withoutCredential)); err == nil {
		t.Fatal("expected HTTP authentication without a credential to be rejected")
	}
	withoutHeader := valid
	withoutHeader.AuthHeader = ""
	if err := ValidateManifest(manifest(withoutHeader)); err == nil {
		t.Fatal("expected basic auth without a header to be rejected")
	}
	unknown := valid
	unknown.AuthScheme = "digest"
	if err := ValidateManifest(manifest(unknown)); err == nil {
		t.Fatal("expected an unknown auth scheme to be rejected")
	}
}
