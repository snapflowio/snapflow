// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package inventory

import (
	"testing"
	"testing/fstest"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	testProductUUID = "4c4c4544-0042-3510-8051-b4c04f565432"
	testBoardSerial = "/7X5QJ2/CNFCW0012300AB/"
	testNVMeSerial  = "S5GXNF0R123456"
	testSATASerial  = "WD-WCC4N1234567"
	testGPUUUID     = "GPU-6b2d5b9e-0a9c-4d3e-8f1a-2b3c4d5e6f7a"
)

func testSystem() fstest.MapFS {
	return fstest.MapFS{
		"sys/class/dmi/id/product_uuid":   {Data: []byte(testProductUUID + "\n")},
		"sys/class/dmi/id/board_serial":   {Data: []byte("Default string\n")},
		"sys/block/nvme0n1/device/serial": {Data: []byte("  " + testNVMeSerial + "  \n")},
		"sys/block/sda/device/vpd_pg80":   {Data: append([]byte{0x00, 0x80, 0x00, byte(len(testSATASerial))}, testSATASerial...)},
		"sys/block/loop0/size":            {Data: []byte("0\n")},
		"sys/block/nvme1n1/device/serial": {Data: []byte("00000000000000\n")},
	}
}

func TestReadComponentsDigestsRealIdentifiersAndSkipsPlaceholders(t *testing.T) {
	components, err := readComponents(Sources{System: testSystem(), GPUUUIDs: []string{testGPUUUID, testGPUUUID}})
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]machinev1alpha1.FingerprintKind{
		ValueDigest(testProductUUID): machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_SMBIOS_UUID,
		ValueDigest(testNVMeSerial):  machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_DISK_SERIAL,
		ValueDigest(testSATASerial):  machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_DISK_SERIAL,
		ValueDigest(testGPUUUID):     machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_GPU_UUID,
	}
	if len(components) != len(want) {
		t.Fatalf("components = %v, want %d entries", components, len(want))
	}
	for _, component := range components {
		if kind, found := want[component.GetValueDigest()]; !found || kind != component.GetKind() {
			t.Errorf("unexpected component %v", component)
		}
	}
}

func TestDigestIsOrderIndependentAndChangesWithTheInventory(t *testing.T) {
	first := &machinev1alpha1.FingerprintComponent{
		Kind: machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_SMBIOS_UUID, ValueDigest: ValueDigest(testProductUUID),
	}
	second := &machinev1alpha1.FingerprintComponent{
		Kind: machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_DISK_SERIAL, ValueDigest: ValueDigest(testNVMeSerial),
	}
	forward := Digest([]*machinev1alpha1.FingerprintComponent{first, second})
	if reversed := Digest([]*machinev1alpha1.FingerprintComponent{second, first}); reversed != forward {
		t.Fatalf("digest depends on order: %s != %s", reversed, forward)
	}
	if reduced := Digest([]*machinev1alpha1.FingerprintComponent{first}); reduced == forward {
		t.Fatal("removing a component did not change the inventory digest")
	}
}

func TestMeaningfulRejectsPlaceholders(t *testing.T) {
	for value, want := range map[string]bool{
		"":                                     false,
		"To Be Filled By O.E.M.":               false,
		"00000000-0000-0000-0000-000000000000": false,
		"FFFFFFFF":                             false,
		"----":                                 false,
		testBoardSerial:                        true,
		testProductUUID:                        true,
	} {
		if got := meaningful(value); got != want {
			t.Errorf("meaningful(%q) = %t, want %t", value, got, want)
		}
	}
}
