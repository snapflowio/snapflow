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

package devices

import (
	"errors"
	"testing"
)

const (
	quarantinedAddress = "0000:0A:00.0"
	firstBoot          = "boot-one"
	secondBoot         = "boot-two"
)

func TestGPUQuarantineHoldsForTheBootAndLapsesOnReboot(t *testing.T) {
	boot := firstBoot
	quarantine := NewGPUQuarantine(t.TempDir())
	quarantine.bootID = func() (string, error) { return boot, nil }

	if err := quarantine.Add(quarantinedAddress, errors.New("nvidia-smi health check failed")); err != nil {
		t.Fatal(err)
	}
	held, err := quarantine.List()
	if err != nil {
		t.Fatal(err)
	}
	entry, found := held[normalizePCIAddress(quarantinedAddress)]
	if !found || entry.Reason == "" || entry.BootID != firstBoot {
		t.Fatalf("List() = %+v, want %s quarantined during %s with a reason", held, quarantinedAddress, firstBoot)
	}

	boot = secondBoot
	held, err = quarantine.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(held) != 0 {
		t.Fatalf("List() after reboot = %+v, want the quarantine lapsed", held)
	}
	boot = firstBoot
	if held, err = quarantine.List(); err != nil || len(held) != 0 {
		t.Fatalf("List() = %+v, %v; want the lapsed entry deleted", held, err)
	}
}

func TestGPUQuarantineIsEmptyBeforeAnyEntry(t *testing.T) {
	held, err := NewGPUQuarantine(t.TempDir() + "/missing").List()
	if err != nil || len(held) != 0 {
		t.Fatalf("List() = %+v, %v; want an empty quarantine", held, err)
	}
}
