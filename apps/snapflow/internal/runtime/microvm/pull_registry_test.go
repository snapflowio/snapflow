// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package microvm

import (
	"testing"

	"github.com/snapflowio/microvm-go/types"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func TestGuestRegistryImagesPullThroughTheGuestRegistryEndpoint(t *testing.T) {
	guestRegistry := &types.Registry{URL: "http://registry:5000"}
	runtime := &Runtime{guestRegistry: guestRegistry, guestRegistryHost: "registry:5000"}
	benchmark := "registry:5000/snapflowio/platform@sha256:5555555555555555555555555555555555555555555555555555555555555555"
	if got := runtime.pullRegistry(benchmark, nil); got != guestRegistry {
		t.Fatalf("guest registry image pulled through %+v, want the guest registry endpoint", got)
	}
	if got := runtime.pullRegistry("docker.io/library/alpine:3.20", nil); got != nil {
		t.Fatalf("a public image was pulled through %+v", got)
	}
	explicit := &machinev1alpha1.Registry{Url: "https://cache.example.com"}
	if got := runtime.pullRegistry(benchmark, explicit); got == nil || got.URL != explicit.GetUrl() {
		t.Fatalf("an explicit registry was replaced by %+v", got)
	}
}
