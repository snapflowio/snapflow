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
	"slices"
	"testing"
)

const (
	testReleaseDigest      = "sha256:1111111111111111111111111111111111111111111111111111111111111111"
	testCoreImage          = "registry.example/core@sha256:2222222222222222222222222222222222222222222222222222222222222222"
	testDesktopImage       = "registry.example/desktop@sha256:3333333333333333333333333333333333333333333333333333333333333333"
	testCoreMountPath      = PlatformMountPath + "/core"
	testDesktopMountPath   = PlatformMountPath + "/desktop"
	testDesktopService     = "desktop"
	testDesktopServicePort = 6080
	testToolboxService     = "toolbox"
	testToolboxServicePort = 2280
	testPluginEnvironment  = "COMPUTER_USE_PLUGIN_PATH"
	testPluginPath         = testDesktopMountPath + "/components/desktop"
)

func testCoreManifest() Manifest {
	return Manifest{
		Name: "core", Version: "v1", GuestPath: testCoreMountPath + "/components/core",
		Activation: ActivationRequired, ControlProtocolVersion: ControlProtocolVersion,
		LifecycleSocket: "/run/snapflow/components/core.sock",
		Capabilities:    []Capability{CapabilityWorkloadInit},
		Env:             map[string]string{"PLATFORM_VERSION": "v1"},
		Services:        []Service{{Name: testToolboxService, Port: testToolboxServicePort}},
		CapabilityExtensions: []CapabilityExtension{{
			SandboxCapability: SandboxCapabilityDesktop,
			Env:               map[string]string{testPluginEnvironment: testPluginPath},
			EnvSources:        map[string]EnvironmentSource{"DESKTOP_PROJECT_DIR": EnvironmentSourceSandboxWorkdir},
			Services:          []Service{{Name: testDesktopService, Port: testDesktopServicePort}},
		}},
	}
}

func testBundles() []Bundle {
	return []Bundle{
		{
			Name: "core", Version: "v1", ReleaseDigest: testReleaseDigest, Image: testCoreImage,
			Required: true, Capabilities: []SandboxCapability{SandboxCapabilityDeveloperTools},
			MountPath: testCoreMountPath, Components: []Manifest{testCoreManifest()},
		},
		{
			Name: "desktop", Version: "v1", ReleaseDigest: testReleaseDigest, Image: testDesktopImage,
			Capabilities: []SandboxCapability{SandboxCapabilityDesktop, SandboxCapabilityDeveloperTools},
			MountPath:    testDesktopMountPath,
			Components: []Manifest{{
				Name: "desktop", Version: "v1", GuestPath: testPluginPath,
				Activation: ActivationOnDemand, SandboxCapability: SandboxCapabilityDesktop,
				ControlProtocolVersion: ControlProtocolVersion,
			}},
		},
	}
}

func selectedCore(t *testing.T, bundles []Bundle, capabilities ...SandboxCapability) Manifest {
	t.Helper()
	selected, err := SelectBundles(bundles, capabilities)
	if err != nil {
		t.Fatalf("select bundles: %v", err)
	}
	core := selected[0].Components[0]
	if len(core.CapabilityExtensions) != 0 {
		t.Fatalf("selected component kept unresolved extensions: %+v", core.CapabilityExtensions)
	}
	return core
}

func serviceNames(manifest Manifest) []string {
	names := make([]string, 0, len(manifest.Services))
	for _, service := range manifest.Services {
		names = append(names, service.Name)
	}
	return names
}

func TestSelectBundlesOmitsCapabilityExtensionsThatWereNotRequested(t *testing.T) {
	core := selectedCore(t, testBundles(), SandboxCapabilityDeveloperTools)
	if slices.Contains(serviceNames(core), testDesktopService) {
		t.Fatalf("desktop service declared without the desktop capability: %v", serviceNames(core))
	}
	if _, configured := core.Env[testPluginEnvironment]; configured {
		t.Fatal("desktop environment configured without the desktop capability")
	}
	if len(core.EnvSources) != 0 {
		t.Fatalf("desktop sourced environment configured without the desktop capability: %v", core.EnvSources)
	}
}

func TestSelectBundlesMergesRequestedCapabilityExtensions(t *testing.T) {
	bundles := testBundles()
	core := selectedCore(t, bundles, SandboxCapabilityDesktop)
	if !slices.Equal(serviceNames(core), []string{testToolboxService, testDesktopService}) {
		t.Fatalf("services = %v, want toolbox and desktop", serviceNames(core))
	}
	if core.Env[testPluginEnvironment] != testPluginPath || core.Env["PLATFORM_VERSION"] != "v1" {
		t.Fatalf("environment = %v, want base and desktop variables", core.Env)
	}
	if len(bundles[0].Components[0].Services) != 1 || bundles[0].Components[0].Env[testPluginEnvironment] != "" {
		t.Fatal("selecting bundles mutated the configured bundles")
	}
}

func TestValidateManifestChecksCapabilityExtensions(t *testing.T) {
	cases := map[string]func(*Manifest){
		"unknown capability": func(manifest *Manifest) {
			manifest.CapabilityExtensions[0].SandboxCapability = "gpu"
		},
		"repeated capability": func(manifest *Manifest) {
			manifest.CapabilityExtensions = append(manifest.CapabilityExtensions, CapabilityExtension{
				SandboxCapability: SandboxCapabilityDesktop,
			})
		},
		"environment conflicts with base": func(manifest *Manifest) {
			manifest.CapabilityExtensions[0].Env["PLATFORM_VERSION"] = "v2"
		},
		"sourced environment conflicts with static": func(manifest *Manifest) {
			manifest.Env["DESKTOP_PROJECT_DIR"] = "/workspace"
		},
		"service port conflicts with base": func(manifest *Manifest) {
			manifest.CapabilityExtensions[0].Services[0].Port = testToolboxServicePort
		},
	}
	if err := ValidateManifest(testCoreManifest()); err != nil {
		t.Fatalf("valid manifest rejected: %v", err)
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			manifest := testCoreManifest()
			mutate(&manifest)
			if err := ValidateManifest(manifest); err == nil {
				t.Fatal("expected the manifest to be rejected")
			}
		})
	}
}

func TestValidateBundlesChecksCapabilityExtensionServicesAcrossBundles(t *testing.T) {
	bundles := testBundles()
	bundles[1].Components[0].Services = []Service{{Name: testDesktopService, Port: testDesktopServicePort}}
	if err := ValidateBundles(bundles); err == nil {
		t.Fatal("expected a service repeated by a capability extension to be rejected")
	}
}
