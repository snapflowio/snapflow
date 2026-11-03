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

package runtime

import (
	goruntime "runtime"
	"testing"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/template"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

func TestTemplateEligibilityRequiresFirecracker(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	backend := Backend{templates: template.New(template.Config{Paths: paths, CloneAvailable: goruntime.GOOS == "linux"}, templateSeeds{})}
	request := types.CreateRequest{
		Labels: map[string]string{
			hypervisor.InstanceProfileLabel: string(hypervisor.InstanceProfileEphemeral),
		},
	}
	if got, want := backend.templateEligible(request, hypervisor.HypervisorFirecracker), goruntime.GOOS == "linux"; got != want {
		t.Fatalf("Firecracker template eligibility = %t, want %t", got, want)
	}
	if backend.templateEligible(request, hypervisor.HypervisorCloudHypervisor) {
		t.Fatal("Cloud Hypervisor incorrectly entered the Firecracker template path")
	}
	backend.templates = template.New(template.Config{Paths: paths}, templateSeeds{})
	if backend.templateEligible(request, hypervisor.HypervisorFirecracker) {
		t.Fatal("Firecracker template path accepted a host without copy-on-write cloning")
	}
}

func TestTemplateSeedIdentityIsInternalAndContentAddressed(t *testing.T) {
	const keyID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	seedID := template.SeedID(keyID)
	identity := templateSeedIdentity(seedID, keyID)
	if identity.InstanceID != seedID {
		t.Fatalf("template seed identity = %q, want %q", identity.InstanceID, seedID)
	}
	if identity.IntentDigest != templateIntentDigestPrefix+keyID {
		t.Fatalf("template seed intent digest = %q", identity.IntentDigest)
	}
	if identity.AssignmentGeneration < 1 || identity.LifecycleGeneration < 1 {
		t.Fatalf("template seed generations are invalid: %#v", identity)
	}
}
