// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"encoding/binary"
	"math"
	"testing"
	"testing/fstest"
	"time"
)

const (
	testH100DeviceID    = "0x2330"
	testGPUAddress      = "0000:3b:00.0"
	testNVIDIASMIRows   = "00000000:3B:00.0, GPU-6b2d5b9e-0a9c-4d3e-8f1a-2b3c4d5e6f7a, 81559, 2, Yes\n00000000:5E:00.0, GPU-0c1d2e3f-4a5b-4c6d-8e7f-8091a2b3c4d5, 24564, [N/A], [N/A]\n"
	testNVIDIASMIUUID   = "GPU-6b2d5b9e-0a9c-4d3e-8f1a-2b3c4d5e6f7a"
	testConsumerAddress = "0000:5e:00.0"
	testNVIDIATotalMiB  = 81559
	testECCErrors       = 2
	testGen5SpeedMTs    = 32_000
	testGen4SpeedMTs    = 16_000
	testLinkWidth       = 16
	testDegradedWidth   = 8
	testGEMMIterations  = 1_000
	testGEMMWindows     = 3
)

func TestGEMMTFLOPSCountsTwoOperationsPerMultiplyAdd(t *testing.T) {
	if got := math.Round(GEMMTFLOPS(GEMMDimension, testGEMMIterations, time.Second)); got != 137 {
		t.Fatalf("TFLOPS = %v, want 137", got)
	}
}

func TestGEMMOutputCarriesWindowsBeforeTheProduct(t *testing.T) {
	output := binary.LittleEndian.AppendUint64(nil, testGEMMWindows)
	for window := range testGEMMWindows {
		output = binary.LittleEndian.AppendUint64(output, uint64(testGEMMIterations+window))
		output = binary.LittleEndian.AppendUint64(output, uint64(time.Second))
	}
	product := make([]byte, testGEMMDimension*testGEMMDimension*GEMMElementBytes)
	product[len(product)-1] = testNonceFill
	windows, rows, err := parseGEMMOutput(append(output, product...), testGEMMDimension)
	if err != nil {
		t.Fatal(err)
	}
	last := windows[testGEMMWindows-1]
	if len(windows) != testGEMMWindows || last.iterations != testGEMMIterations+testGEMMWindows-1 || last.elapsed != time.Second {
		t.Fatalf("windows = %+v", windows)
	}
	if len(rows) != testGEMMDimension || rows[testGEMMDimension-1][testGEMMDimension*GEMMElementBytes-1] != testNonceFill {
		t.Fatal("the GEMM product rows do not follow the window records")
	}
	if _, _, err := parseGEMMOutput(output, testGEMMDimension); err == nil {
		t.Fatal("GEMM output without its product parsed")
	}
}

func TestGPUEnumerationReadsPCIeLinkHealth(t *testing.T) {
	system := fstest.MapFS{
		"sys/bus/pci/devices/0000:3b:00.0/vendor":             {Data: []byte("0x10de\n")},
		"sys/bus/pci/devices/0000:3b:00.0/device":             {Data: []byte(testH100DeviceID + "\n")},
		"sys/bus/pci/devices/0000:3b:00.0/class":              {Data: []byte("0x030200\n")},
		"sys/bus/pci/devices/0000:3b:00.0/current_link_speed": {Data: []byte("16.0 GT/s PCIe\n")},
		"sys/bus/pci/devices/0000:3b:00.0/max_link_speed":     {Data: []byte("32.0 GT/s PCIe\n")},
		"sys/bus/pci/devices/0000:3b:00.0/current_link_width": {Data: []byte("8\n")},
		"sys/bus/pci/devices/0000:3b:00.0/max_link_width":     {Data: []byte("16\n")},
		"sys/bus/pci/devices/0000:3b:00.1/vendor":             {Data: []byte("0x10de\n")},
		"sys/bus/pci/devices/0000:3b:00.1/device":             {Data: []byte("0x22a3\n")},
		"sys/bus/pci/devices/0000:3b:00.1/class":              {Data: []byte("0x040300\n")},
		"sys/bus/pci/devices/0000:00:02.0/vendor":             {Data: []byte("0x8086\n")},
		"sys/bus/pci/devices/0000:00:02.0/device":             {Data: []byte("0x46a6\n")},
		"sys/bus/pci/devices/0000:00:02.0/class":              {Data: []byte("0x030000\n")},
		"sys/bus/pci/devices/0000:5e:00.0/vendor":             {Data: []byte("0x10de\n")},
		"sys/bus/pci/devices/0000:5e:00.0/device":             {Data: []byte("0x2684\n")},
		"sys/bus/pci/devices/0000:5e:00.0/class":              {Data: []byte("0x030000\n")},
		"sys/bus/pci/devices/0000:5e:00.0/current_link_speed": {Data: []byte("Unknown\n")},
	}
	devices, err := enumerateGPUs(system)
	if err != nil {
		t.Fatal(err)
	}
	want := pciLink{currentSpeedMTs: testGen4SpeedMTs, maxSpeedMTs: testGen5SpeedMTs, currentWidth: testDegradedWidth, maxWidth: testLinkWidth}
	if len(devices) != 2 || devices[0].address != testGPUAddress || devices[0].deviceID != testH100DeviceID || devices[0].link != want {
		t.Fatalf("GPUs = %+v", devices)
	}
	if devices[1].address != testConsumerAddress || devices[1].link != (pciLink{}) {
		t.Fatalf("a GPU without link attributes = %+v", devices[1])
	}
	system["sys/bus/pci/devices/0000:5e:00.0/max_link_width"] = &fstest.MapFile{Data: []byte("wide\n")}
	if devices, err := enumerateGPUs(system); err == nil {
		t.Fatalf("an unparseable link width was accepted: %+v", devices)
	}
}

func TestNVIDIAReportsHealthAndTreatsUnavailableValuesAsHealthy(t *testing.T) {
	reported, err := parseNVIDIA(testNVIDIASMIRows)
	if err != nil {
		t.Fatal(err)
	}
	datacenter := reported[testGPUAddress]
	if datacenter.uuid != testNVIDIASMIUUID || datacenter.totalMiB != testNVIDIATotalMiB ||
		datacenter.uncorrectedECCErrors != testECCErrors || !datacenter.retiredPagesPending {
		t.Fatalf("nvidia-smi = %+v", reported)
	}
	if consumer := reported[testConsumerAddress]; consumer.uncorrectedECCErrors != 0 || consumer.retiredPagesPending {
		t.Fatalf("a GPU without ECC = %+v", consumer)
	}
}
