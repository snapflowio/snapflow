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

package configdrive

import (
	"slices"
	"testing"

	"github.com/snapflowio/microvm-go/guest"
)

func TestBuildMergesRuntimeEnvAndNetwork(t *testing.T) {
	cfg := Build(BuildRequest{
		ImageEntrypoint: []string{"/bin/app"},
		ImageCmd:        []string{"serve"},
		ImageWorkingDir: "/app",
		ImageEnv:        map[string]string{"A": "image", "B": "image"},
		RuntimeEnv:      map[string]string{"B": "runtime"},
		Network: &Network{
			IP:      "172.31.0.2",
			Netmask: "255.255.0.0",
			Gateway: "172.31.0.1",
			DNS:     "1.1.1.1",
		},
	})

	if cfg.Workdir != "/app" || cfg.InitMode != "exec" {
		t.Fatalf("unexpected guest config: %#v", cfg)
	}
	if cfg.Env["A"] != "image" || cfg.Env["B"] != "runtime" {
		t.Fatalf("unexpected env merge: %#v", cfg.Env)
	}
	if cfg.NetworkMode != NetworkModeStatic || cfg.GuestCIDR != 16 || cfg.GuestIP != "172.31.0.2" {
		t.Fatalf("unexpected network config: %#v", cfg)
	}
	if cfg.GuestInit.ProjectDir != "/app" {
		t.Fatalf("expected guest init project dir to follow workdir, got %q", cfg.GuestInit.ProjectDir)
	}
}

func TestBuildPublishesComponentLifecycleHooks(t *testing.T) {
	request := BuildRequest{PlatformBundles: []PlatformBundle{{
		Components: []guest.Manifest{{
			Name: "example", Version: "v1", GuestPath: guest.PlatformMountPath + "/components/example", Activation: guest.ActivationWhenEnabled,
			SandboxCapability: guest.SandboxCapabilityDeveloperTools,
			LifecycleSocket:   "/run/snapflow/components/example.sock",
			Capabilities:      []guest.Capability{guest.CapabilitySnapshot, guest.CapabilityWorkloadInit},
		}},
	}}}
	cfg := Build(request)
	if len(cfg.GuestInit.ComponentHooks) != 1 || cfg.GuestInit.ComponentHooks[0].Name != "example" {
		t.Fatalf("unexpected component hooks: %#v", cfg.GuestInit.ComponentHooks)
	}
	hook := cfg.GuestInit.ComponentHooks[0]
	want := []guest.LifecycleOperation{guest.LifecycleOperationQuiesce, guest.LifecycleOperationResume, guest.LifecycleOperationWorkload}
	if !slices.Equal(hook.Operations, want) {
		t.Fatalf("hook operations = %v, want %v", hook.Operations, want)
	}
	if hook.Handles(guest.LifecycleOperationIdentity) {
		t.Fatal("a component without fork_identity would be notified of identity rotation")
	}
	request.PlatformBundles[0].Components[0].Name = "mutated"
	if cfg.PlatformBundles[0].Components[0].Name != "example" {
		t.Fatal("component manifest was not defensively copied")
	}
}

func TestBuildManagedWorkloadDoesNotRunImageDefaultCommand(t *testing.T) {
	cfg := Build(BuildRequest{
		ImageEntrypoint: []string{"/image-entrypoint"},
		ImageCmd:        []string{"image-command"},
		ManagedWorkload: true,
	})
	if len(cfg.Entrypoint) != 0 || len(cfg.Cmd) != 0 {
		t.Fatalf("managed sandbox inherited image command: %#v", cfg)
	}

	cfg = Build(BuildRequest{
		ImageEntrypoint: []string{"/image-entrypoint"},
		ImageCmd:        []string{"image-command"},
		Entrypoint:      []string{"/managed-workload", "serve"},
		ManagedWorkload: true,
	})
	if len(cfg.Entrypoint) != 2 || cfg.Entrypoint[0] != "/managed-workload" || len(cfg.Cmd) != 0 {
		t.Fatalf("managed sandbox command was not isolated from the image command: %#v", cfg)
	}
}

func TestBuildConfiguresGuestInitIdentity(t *testing.T) {
	const (
		hostname  = "snapflow-000000000000"
		machineID = "0123456789abcdef0123456789abcdef"
	)
	cfg := Build(BuildRequest{
		ImageWorkingDir: "/workspace",
		InstanceID:      "00000000-0000-4000-8000-000000000001",
		Hostname:        hostname,
		MachineID:       machineID,
	})

	if cfg.GuestInit.InstanceID == "" {
		t.Fatalf("expected bounded guest identity to pass through: %#v", cfg.GuestInit)
	}
	if cfg.Hostname != hostname || cfg.MachineID != machineID {
		t.Fatalf("host identity = %q, %q, want %q, %q", cfg.Hostname, cfg.MachineID, hostname, machineID)
	}
}
