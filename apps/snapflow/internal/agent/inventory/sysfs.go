// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package inventory

import (
	"errors"
	"fmt"
	"io/fs"
	"path"
	"strings"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	blockDevicesPath      = "sys/block"
	blockDeviceLink       = "device"
	blockDeviceSerial     = "serial"
	blockDeviceUnitSerial = "vpd_pg80"
	unitSerialLengthIndex = 3
	unitSerialHeaderBytes = 4
	identifierSeparator   = "-"
)

func dmiIdentifiers() map[machinev1alpha1.FingerprintKind]string {
	return map[machinev1alpha1.FingerprintKind]string{
		machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_SMBIOS_UUID:  "sys/class/dmi/id/product_uuid",
		machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_BOARD_SERIAL: "sys/class/dmi/id/board_serial",
	}
}

func placeholderIdentifiers() map[string]bool {
	return map[string]bool{
		"to be filled by o.e.m.":               true,
		"default string":                       true,
		"not specified":                        true,
		"not applicable":                       true,
		"system serial number":                 true,
		"none":                                 true,
		"n/a":                                  true,
		"0123456789":                           true,
		"123456789":                            true,
		"03000200-0400-0500-0006-000700080009": true,
	}
}

func readIdentifier(system fs.FS, name string) (string, error) {
	content, err := fs.ReadFile(system, name)
	if errors.Is(err, fs.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("read host identifier %s: %w", name, err)
	}
	return strings.TrimSpace(string(content)), nil
}

func readDiskSerials(system fs.FS) ([]string, error) {
	devices, err := fs.ReadDir(system, blockDevicesPath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list host block devices: %w", err)
	}
	serials := make([]string, 0, len(devices))
	for _, device := range devices {
		serial, err := readDiskSerial(system, path.Join(blockDevicesPath, device.Name(), blockDeviceLink))
		if err != nil {
			return nil, err
		}
		if serial != "" {
			serials = append(serials, serial)
		}
	}
	return serials, nil
}

func readDiskSerial(system fs.FS, devicePath string) (string, error) {
	serial, err := readIdentifier(system, path.Join(devicePath, blockDeviceSerial))
	if err != nil || serial != "" {
		return serial, err
	}
	page, err := fs.ReadFile(system, path.Join(devicePath, blockDeviceUnitSerial))
	if errors.Is(err, fs.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("read host disk unit serial %s: %w", devicePath, err)
	}
	return unitSerial(page), nil
}

func unitSerial(page []byte) string {
	if len(page) < unitSerialHeaderBytes {
		return ""
	}
	end := min(len(page), unitSerialHeaderBytes+int(page[unitSerialLengthIndex]))
	return strings.TrimSpace(string(page[unitSerialHeaderBytes:end]))
}

func meaningful(value string) bool {
	if value == "" || placeholderIdentifiers()[strings.ToLower(value)] {
		return false
	}
	characters := strings.ReplaceAll(strings.ToLower(value), identifierSeparator, "")
	return characters != "" && strings.Trim(characters, characters[:1]) != ""
}

func kindNames() map[machinev1alpha1.FingerprintKind]string {
	return map[machinev1alpha1.FingerprintKind]string{
		machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_SMBIOS_UUID:  "smbios_uuid",
		machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_BOARD_SERIAL: "board_serial",
		machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_DISK_SERIAL:  "disk_serial",
		machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_GPU_UUID:     "gpu_uuid",
	}
}
