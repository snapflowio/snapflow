// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"errors"
	"fmt"
	"io/fs"
	"math"
	"path"
	"slices"
	"strconv"
	"strings"
)

const (
	pciDevicesPath       = "sys/bus/pci/devices"
	pciVendorFile        = "vendor"
	pciDeviceFile        = "device"
	pciClassFile         = "class"
	pciCurrentSpeedFile  = "current_link_speed"
	pciMaxSpeedFile      = "max_link_speed"
	pciCurrentWidthFile  = "current_link_width"
	pciMaxWidthFile      = "max_link_width"
	pciSpeedUnit         = " GT/s"
	pciUnknownSpeed      = "Unknown"
	megatransfersPerGiga = 1_000
	nvidiaVendorID       = "0x10de"
	pciDisplayClass      = "0x0300"
	pciProcessingClass   = "0x0302"
	pciClassPrefixLength = len(pciDisplayClass)
	pciDomainDigits      = 4
	pciAddressSeparator  = ":"
	pciWidthBits         = 32
)

type pciGPU struct {
	address  string
	deviceID string
	link     pciLink
}

// pciLink holds the negotiated and maximum PCIe link; a field is zero when the
// kernel does not expose it (conventional PCI) or reports the speed as unknown.
type pciLink struct {
	currentSpeedMTs uint32
	maxSpeedMTs     uint32
	currentWidth    uint32
	maxWidth        uint32
}

func enumerateGPUs(system fs.FS) ([]pciGPU, error) {
	entries, err := fs.ReadDir(system, pciDevicesPath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list PCI devices: %w", err)
	}
	devices := []pciGPU{}
	for _, entry := range entries {
		device, isGPU, err := readPCIGPU(system, entry.Name())
		if err != nil {
			return nil, err
		}
		if isGPU {
			devices = append(devices, device)
		}
	}
	slices.SortFunc(devices, func(left, right pciGPU) int { return strings.Compare(left.address, right.address) })
	return devices, nil
}

func readPCIGPU(system fs.FS, address string) (pciGPU, bool, error) {
	values := map[string]string{}
	for _, name := range []string{pciVendorFile, pciDeviceFile, pciClassFile} {
		content, err := fs.ReadFile(system, path.Join(pciDevicesPath, address, name))
		if err != nil {
			return pciGPU{}, false, fmt.Errorf("read PCI %s of %s: %w", name, address, err)
		}
		values[name] = strings.ToLower(strings.TrimSpace(string(content)))
	}
	class := values[pciClassFile]
	isGPU := values[pciVendorFile] == nvidiaVendorID && len(class) >= pciClassPrefixLength &&
		(class[:pciClassPrefixLength] == pciDisplayClass || class[:pciClassPrefixLength] == pciProcessingClass)
	if !isGPU {
		return pciGPU{}, false, nil
	}
	link, err := readPCILink(system, address)
	if err != nil {
		return pciGPU{}, false, err
	}
	return pciGPU{address: normalizePCIAddress(address), deviceID: values[pciDeviceFile], link: link}, true, nil
}

func readPCILink(system fs.FS, address string) (pciLink, error) {
	read := func(file string, parse func(string) (uint32, error)) (uint32, error) {
		content, err := fs.ReadFile(system, path.Join(pciDevicesPath, address, file))
		if errors.Is(err, fs.ErrNotExist) {
			return 0, nil
		}
		if err != nil {
			return 0, fmt.Errorf("read PCI %s of %s: %w", file, address, err)
		}
		return parse(strings.TrimSpace(string(content)))
	}
	currentSpeed, currentSpeedErr := read(pciCurrentSpeedFile, parsePCISpeed)
	maxSpeed, maxSpeedErr := read(pciMaxSpeedFile, parsePCISpeed)
	currentWidth, currentWidthErr := read(pciCurrentWidthFile, parsePCIWidth)
	maxWidth, maxWidthErr := read(pciMaxWidthFile, parsePCIWidth)
	link := pciLink{currentSpeedMTs: currentSpeed, maxSpeedMTs: maxSpeed, currentWidth: currentWidth, maxWidth: maxWidth}
	return link, errors.Join(currentSpeedErr, maxSpeedErr, currentWidthErr, maxWidthErr)
}

func parsePCISpeed(value string) (uint32, error) {
	if strings.HasPrefix(value, pciUnknownSpeed) {
		return 0, nil
	}
	rate, _, found := strings.Cut(value, pciSpeedUnit)
	if !found {
		return 0, fmt.Errorf("unexpected PCIe link speed %q", value)
	}
	gigatransfers, err := strconv.ParseFloat(rate, 64)
	if err != nil {
		return 0, fmt.Errorf("parse PCIe link speed %q: %w", value, err)
	}
	return uint32(math.Round(gigatransfers * megatransfersPerGiga)), nil
}

func parsePCIWidth(value string) (uint32, error) {
	width, err := strconv.ParseUint(value, 10, pciWidthBits)
	if err != nil {
		return 0, fmt.Errorf("parse PCIe link width %q: %w", value, err)
	}
	return uint32(width), nil
}

func normalizePCIAddress(address string) string {
	domain, rest, found := strings.Cut(strings.ToLower(address), pciAddressSeparator)
	if !found || len(domain) < pciDomainDigits {
		return strings.ToLower(address)
	}
	return domain[len(domain)-pciDomainDigits:] + pciAddressSeparator + rest
}
