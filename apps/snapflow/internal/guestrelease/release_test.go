// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package guestrelease

import (
	"bytes"
	"encoding/json"
	"slices"
	"testing"

	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/microvm-go/guest"
)

const (
	testReleaseDigest  = "sha256:1111111111111111111111111111111111111111111111111111111111111111"
	testCoreImage      = "registry:5000/snapflow/core@sha256:2222222222222222222222222222222222222222222222222222222222222222"
	testDesktopImage   = "registry:5000/snapflow/desktop@sha256:3333333333333333333333333333333333333333333333333333333333333333"
	testBenchmarkImage = "registry:5000/snapflowio/platform@sha256:5555555555555555555555555555555555555555555555555555555555555555"
)

func sandboxCore(t *testing.T, desktopImage string, capabilities ...guest.SandboxCapability) guest.Manifest {
	t.Helper()
	release, err := newRelease(releaseConfig{
		Version: "v1", Digest: testReleaseDigest, Platform: "linux/amd64",
		CoreImage: testCoreImage, DesktopImage: desktopImage, BenchmarkImage: testBenchmarkImage,
	})
	if err != nil {
		t.Fatalf("build guest release: %v", err)
	}
	selected, err := guest.SelectBundles(release.Bundles, capabilities)
	if err != nil {
		t.Fatalf("select guest bundles: %v", err)
	}
	for _, bundle := range selected {
		if bundle.Name == guestspec.CoreArtifactName {
			return bundle.Components[0]
		}
	}
	t.Fatal("core bundle was not selected")
	return guest.Manifest{}
}

func servicesByName(manifest guest.Manifest) map[string]guest.Service {
	services := make(map[string]guest.Service, len(manifest.Services))
	for _, service := range manifest.Services {
		services[service.Name] = service
	}
	return services
}

func assertDesktopDisabled(t *testing.T, core guest.Manifest) {
	t.Helper()
	if _, declared := servicesByName(core)[guestspec.DesktopService]; declared {
		t.Fatal("desktop service declared for a sandbox without the desktop capability")
	}
	if len(core.EnvSources) != 0 {
		t.Fatalf("desktop environment sources %v configured without the desktop capability", core.EnvSources)
	}
}

func TestGuestReleaseAuthenticatesTerminalAndDesktop(t *testing.T) {
	core := sandboxCore(t, testDesktopImage, guest.SandboxCapabilityDesktop)
	services := servicesByName(core)
	terminal, declared := services[guestspec.TerminalService]
	if !declared || terminal.AuthHeader != guestspec.AuthHeader || !terminal.Credential {
		t.Fatalf("terminal service = %+v, want the guest token header", terminal)
	}
	desktop, declared := services[guestspec.DesktopService]
	if !declared || desktop.AuthScheme != guest.ServiceAuthBasic || desktop.AuthHeader != desktopAuthorizationHeader ||
		!desktop.Credential {
		t.Fatalf("desktop service = %+v, want Basic auth with a delivered credential", desktop)
	}
	if core.EnvSources[desktopProjectEnvironment] != guest.EnvironmentSourceSandboxWorkdir {
		t.Fatalf("desktop project source = %q, want the sandbox workdir", core.EnvSources[desktopProjectEnvironment])
	}
}

func TestGuestReleaseGatesDesktopOnSandboxCapability(t *testing.T) {
	assertDesktopDisabled(t, sandboxCore(t, testDesktopImage, guest.SandboxCapabilityDeveloperTools))
}

func TestGuestReleaseOmitsDesktopWithoutDesktopArtifact(t *testing.T) {
	assertDesktopDisabled(t, sandboxCore(t, "", guest.SandboxCapabilityDeveloperTools))
}

func TestGuestReleaseInjectsOnlyTheDaemonBindAddress(t *testing.T) {
	core := sandboxCore(t, testDesktopImage, guest.SandboxCapabilityDesktop)
	want := map[string]string{guestspec.BindAddressEnvironment: guest.ServiceLoopbackAddress}
	if len(core.Env) != len(want) || core.Env[guestspec.BindAddressEnvironment] != guest.ServiceLoopbackAddress {
		t.Fatalf("core environment = %v, want %v", core.Env, want)
	}
}

func TestGuestReleaseDeliversTheWorkloadToTheDaemonLifecycleSocket(t *testing.T) {
	core := sandboxCore(t, testDesktopImage, guest.SandboxCapabilityDesktop)
	if core.LifecycleSocket != guestspec.LifecycleSocket {
		t.Fatalf("core lifecycle socket = %q, want %q", core.LifecycleSocket, guestspec.LifecycleSocket)
	}
	if !core.Activation.StartsAutomatically() {
		t.Fatalf("core activation = %q, want an automatically started daemon", core.Activation)
	}
	if operations := guest.LifecycleOperationsFor(core); !slices.Equal(operations, []guest.LifecycleOperation{guest.LifecycleOperationWorkload}) {
		t.Fatalf("core lifecycle operations = %v, want only workload delivery", operations)
	}
}

func TestGuestDaemonLifecycleMatchesTheGuestContract(t *testing.T) {
	if want := guest.LifecycleOperationPath(guest.LifecycleOperationWorkload); guestspec.LifecycleWorkloadPath != want {
		t.Fatalf("daemon workload path = %q, want %q", guestspec.LifecycleWorkloadPath, want)
	}
	encoded, err := json.Marshal(guest.Workload{Env: map[string]string{"APP_MODE": "test"}})
	if err != nil {
		t.Fatal(err)
	}
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.DisallowUnknownFields()
	var decoded guestspec.Workload
	if err := decoder.Decode(&decoded); err != nil {
		t.Fatalf("daemon cannot decode the guest workload payload: %v", err)
	}
	if decoded.Env["APP_MODE"] != "test" {
		t.Fatalf("daemon decoded workload %v, want the guest environment", decoded)
	}
}

func TestGuestDaemonCredentialFilesMatchTheGuestContract(t *testing.T) {
	if guestspec.CredentialRoot != guest.ServiceCredentialRoot {
		t.Fatalf("daemon credential root = %q, want %q", guestspec.CredentialRoot, guest.ServiceCredentialRoot)
	}
	for service, file := range map[string]string{
		guestspec.ToolboxService:  guestspec.ToolboxCredentialFile,
		guestspec.SSHService:      guestspec.SSHCredentialFile,
		guestspec.TerminalService: guestspec.TerminalCredentialFile,
		guestspec.DesktopService:  guestspec.DesktopCredentialFile,
	} {
		if want := guest.ServiceCredentialPath(service); file != want {
			t.Fatalf("%s credential file = %q, want %q", service, file, want)
		}
	}
}

func TestGuestDaemonDesktopUserMatchesTheRuntime(t *testing.T) {
	if guestspec.DesktopAuthUser != guest.ServiceBasicAuthUsername {
		t.Fatalf("daemon desktop user = %q, want %q", guestspec.DesktopAuthUser, guest.ServiceBasicAuthUsername)
	}
}

func TestGuestReleaseRequiresADigestPinnedBenchmarkImage(t *testing.T) {
	for _, benchmarkImage := range []string{"", "registry:5000/snapflowio/platform:benchmark"} {
		if _, err := newRelease(releaseConfig{
			Version: "v1", Digest: testReleaseDigest, Platform: "linux/amd64",
			CoreImage: testCoreImage, BenchmarkImage: benchmarkImage,
		}); err == nil {
			t.Fatalf("guest release accepted benchmark image %q", benchmarkImage)
		}
	}
	release, err := newRelease(releaseConfig{
		Version: "v1", Digest: testReleaseDigest, Platform: "linux/amd64",
		CoreImage: testCoreImage, BenchmarkImage: testBenchmarkImage,
	})
	if err != nil {
		t.Fatal(err)
	}
	if release.BenchmarkImage != testBenchmarkImage {
		t.Fatalf("benchmark image = %q, want %q", release.BenchmarkImage, testBenchmarkImage)
	}
}
