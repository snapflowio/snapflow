// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package telemetry

import (
	"bufio"
	"errors"
	"fmt"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"
)

var errNoDefaultRouteInterface = errors.New("no default-route network interface found")

const (
	networkDevicePath = "/proc/net/dev"
	ipv4RoutePath     = "/proc/net/route"
	ipv6RoutePath     = "/proc/net/ipv6_route"
	ipv4DefaultRoute  = "00000000"
	ipv6DefaultRoute  = "00000000000000000000000000000000"
	ipv6DefaultPrefix = "00"
	routeFlagUp       = 0x1
	hexadecimalBase   = 16
	decimalBase       = 10
	counterBits       = 64

	ipv4RouteInterfaceField     = 0
	ipv4RouteDestinationField   = 1
	ipv4RouteFlagsField         = 3
	ipv4RouteMinimumFields      = 4
	ipv6RouteDestinationField   = 0
	ipv6RoutePrefixLengthField  = 1
	ipv6RouteMinimumFields      = 10
	networkDeviceMinimumFields  = 16
	receiveBytesField           = 0
	receivePacketsField         = 1
	receiveDropsField           = 3
	transmitBytesField          = 8
	transmitPacketsField        = 9
	transmitDropsField          = 11
	loopbackInterfaceName       = "lo"
	networkDeviceNameSeparator  = ":"
	networkInterfaceListDivider = ", "
)

type networkCounters struct {
	bytesIn  uint64
	bytesOut uint64
	packets  uint64
	drops    uint64
}

func resolveNetworkInterfaces() (map[string]struct{}, error) {
	ipv4Routes, ipv4Err := os.ReadFile(ipv4RoutePath)
	ipv6Routes, ipv6Err := os.ReadFile(ipv6RoutePath)
	if ipv4Err != nil && ipv6Err != nil {
		return nil, errors.Join(
			fmt.Errorf("read %s: %w", ipv4RoutePath, ipv4Err),
			fmt.Errorf("read %s: %w", ipv6RoutePath, ipv6Err),
		)
	}
	names := defaultRouteInterfaces(ipv4Routes, ipv6Routes)
	if len(names) == 0 {
		return nil, errNoDefaultRouteInterface
	}
	result := make(map[string]struct{}, len(names))
	for _, name := range names {
		result[name] = struct{}{}
	}
	return result, nil
}

func defaultRouteInterfaces(ipv4Routes, ipv6Routes []byte) []string {
	result := make(map[string]struct{})
	ipv4Scanner := bufio.NewScanner(strings.NewReader(string(ipv4Routes)))
	for ipv4Scanner.Scan() {
		if name, found := ipv4DefaultRouteInterface(strings.Fields(ipv4Scanner.Text())); found {
			result[name] = struct{}{}
		}
	}
	ipv6Scanner := bufio.NewScanner(strings.NewReader(string(ipv6Routes)))
	for ipv6Scanner.Scan() {
		if name, found := ipv6DefaultRouteInterface(strings.Fields(ipv6Scanner.Text())); found {
			result[name] = struct{}{}
		}
	}
	names := make([]string, 0, len(result))
	for name := range result {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func ipv4DefaultRouteInterface(fields []string) (string, bool) {
	if len(fields) < ipv4RouteMinimumFields || fields[ipv4RouteDestinationField] != ipv4DefaultRoute {
		return "", false
	}
	flags, err := strconv.ParseUint(fields[ipv4RouteFlagsField], hexadecimalBase, counterBits)
	name := fields[ipv4RouteInterfaceField]
	return name, err == nil && flags&routeFlagUp != 0 && name != loopbackInterfaceName
}

func ipv6DefaultRouteInterface(fields []string) (string, bool) {
	if len(fields) < ipv6RouteMinimumFields ||
		fields[ipv6RouteDestinationField] != ipv6DefaultRoute ||
		fields[ipv6RoutePrefixLengthField] != ipv6DefaultPrefix {
		return "", false
	}
	name := fields[len(fields)-1]
	return name, name != loopbackInterfaceName
}

func readNetwork(interfaces map[string]struct{}) (networkCounters, error) {
	data, err := os.ReadFile(networkDevicePath)
	if err != nil {
		return networkCounters{}, fmt.Errorf("read %s: %w", networkDevicePath, err)
	}
	return parseNetworkCounters(data, interfaces)
}

func parseNetworkCounters(
	data []byte,
	interfaces map[string]struct{},
) (networkCounters, error) {
	var total networkCounters
	found := make(map[string]struct{}, len(interfaces))
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		interfaceName, counters, present := strings.Cut(line, networkDeviceNameSeparator)
		interfaceName = strings.TrimSpace(interfaceName)
		if !present {
			continue
		}
		if _, selected := interfaces[interfaceName]; !selected {
			continue
		}
		device, err := parseNetworkDeviceCounters(interfaceName, strings.Fields(counters))
		if err != nil {
			return networkCounters{}, err
		}
		if total, err = total.add(device); err != nil {
			return networkCounters{}, fmt.Errorf(
				"sum network interface %s counters: %w",
				interfaceName,
				err,
			)
		}
		found[interfaceName] = struct{}{}
	}
	if err := scanner.Err(); err != nil {
		return networkCounters{}, fmt.Errorf("scan %s: %w", networkDevicePath, err)
	}
	if err := requireAllInterfaces(interfaces, found); err != nil {
		return networkCounters{}, err
	}
	return total, nil
}

func parseNetworkDeviceCounters(interfaceName string, fields []string) (networkCounters, error) {
	if len(fields) < networkDeviceMinimumFields {
		return networkCounters{}, fmt.Errorf(
			"network interface %s has invalid counters",
			interfaceName,
		)
	}
	values := make([]uint64, len(fields))
	for index, field := range fields {
		value, err := strconv.ParseUint(field, decimalBase, counterBits)
		if err != nil {
			return networkCounters{}, fmt.Errorf(
				"parse network interface %s counter %d: %w",
				interfaceName,
				index,
				err,
			)
		}
		values[index] = value
	}
	packets, err := addCounter(values[receivePacketsField], values[transmitPacketsField])
	if err != nil {
		return networkCounters{}, fmt.Errorf("sum network interface %s packets: %w", interfaceName, err)
	}
	drops, err := addCounter(values[receiveDropsField], values[transmitDropsField])
	if err != nil {
		return networkCounters{}, fmt.Errorf("sum network interface %s drops: %w", interfaceName, err)
	}
	return networkCounters{
		bytesIn:  values[receiveBytesField],
		bytesOut: values[transmitBytesField],
		packets:  packets,
		drops:    drops,
	}, nil
}

func (counters networkCounters) add(other networkCounters) (networkCounters, error) {
	bytesIn, bytesInErr := addCounter(counters.bytesIn, other.bytesIn)
	bytesOut, bytesOutErr := addCounter(counters.bytesOut, other.bytesOut)
	packets, packetsErr := addCounter(counters.packets, other.packets)
	drops, dropsErr := addCounter(counters.drops, other.drops)
	if err := errors.Join(bytesInErr, bytesOutErr, packetsErr, dropsErr); err != nil {
		return networkCounters{}, err
	}
	return networkCounters{
		bytesIn:  bytesIn,
		bytesOut: bytesOut,
		packets:  packets,
		drops:    drops,
	}, nil
}

func requireAllInterfaces(interfaces, found map[string]struct{}) error {
	if len(found) == len(interfaces) {
		return nil
	}
	missing := make([]string, 0, len(interfaces)-len(found))
	for interfaceName := range interfaces {
		if _, present := found[interfaceName]; !present {
			missing = append(missing, interfaceName)
		}
	}
	sort.Strings(missing)
	return fmt.Errorf(
		"network interfaces not found: %s",
		strings.Join(missing, networkInterfaceListDivider),
	)
}

func addCounter(total, value uint64) (uint64, error) {
	if value > math.MaxUint64-total {
		return 0, errors.New("network counter overflow")
	}
	return total + value, nil
}
