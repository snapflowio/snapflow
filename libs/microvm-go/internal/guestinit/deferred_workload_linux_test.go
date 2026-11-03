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

//go:build linux

package guestinit

import (
	"maps"
	"slices"
	"testing"

	guestconfig "github.com/snapflowio/microvm-go/guest/config"
	"github.com/snapflowio/microvm-go/internal/guest/control"
)

func TestApplyDeferredWorkloadConfigurationUsesRestoredGuestIdentity(t *testing.T) {
	cfg := &Config{
		Env:        map[string]string{"SEED": "1", "SHARED": "seed"},
		Entrypoint: []string{"/seed"},
		Cmd:        []string{"seed-cmd"},
		GuestInit: guestconfig.Config{
			InstanceID:         "seed-instance",
			GenerationID:       "seed-generation",
			ControlAuthToken:   "seed-control-token-0000000000000000",
			GuestServiceTokens: map[string]string{"toolbox": "seed-toolbox-token-000000000000000"},
		},
	}
	restoredGuest := guestconfig.Config{
		InstanceID:         "target-instance",
		GenerationID:       "target-generation",
		ControlAuthToken:   "target-control-token-00000000000000",
		GuestServiceTokens: map[string]string{"toolbox": "target-toolbox-token-0000000000000"},
	}
	initialization := control.InitializeWorkloadRequest{
		InstanceID:   "target-instance",
		GenerationID: "target-generation",
		OSUser:       "snapflow",
		Env:          map[string]string{"SHARED": "target", "TARGET": "1"},
		Entrypoint:   []string{"/bin/sh", "-c", "sleep infinity"},
	}

	applyDeferredWorkloadConfiguration(cfg, initialization, restoredGuest)

	if !maps.Equal(cfg.GuestInit.GuestServiceTokens, restoredGuest.GuestServiceTokens) {
		t.Fatalf("guest service tokens = %v, want the restored identity tokens", cfg.GuestInit.GuestServiceTokens)
	}
	if cfg.GuestInit.ControlAuthToken != restoredGuest.ControlAuthToken {
		t.Fatal("control token was not taken from the restored identity")
	}
	if cfg.GuestInit.InstanceID != "target-instance" || cfg.GuestInit.GenerationID != "target-generation" {
		t.Fatalf("guest identity = %s/%s, want target-instance/target-generation", cfg.GuestInit.InstanceID, cfg.GuestInit.GenerationID)
	}
	if want := map[string]string{"SEED": "1", "SHARED": "target", "TARGET": "1"}; !maps.Equal(cfg.Env, want) {
		t.Fatalf("environment = %v, want %v", cfg.Env, want)
	}
	if !slices.Equal(cfg.Entrypoint, initialization.Entrypoint) || cfg.Cmd != nil {
		t.Fatalf("entrypoint = %v cmd = %v, want the initialization entrypoint without a command", cfg.Entrypoint, cfg.Cmd)
	}
	if cfg.OSUser != "snapflow" {
		t.Fatalf("OS user = %q, want snapflow", cfg.OSUser)
	}
}
