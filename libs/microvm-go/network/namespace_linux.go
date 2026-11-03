// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the license at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

//go:build linux

package network

import (
	"errors"
	"fmt"
	"net"
	"net/netip"
	"os"
	"path/filepath"
	"runtime"

	"github.com/snapflowio/microvm-go/internal/jailidentity"
	"github.com/vishvananda/netlink"
	"github.com/vishvananda/netns"
	"golang.org/x/sys/unix"
)

const (
	namespaceDirectory = "/run/netns"
	sysctlRoot         = "/proc/sys"
	sysctlFileMode     = 0o644
	namespaceDirMode   = 0o755
	loopbackInterface  = "lo"
	enabled            = "1"
	disabled           = "0"
)

// NamespacePath is where the named network namespace of an instance lives.
func NamespacePath(name string) string { return filepath.Join(namespaceDirectory, name) }

// namespaceSysctls harden each sandbox namespace: forwarding on for its own
// router role, strict reverse-path filtering, and no IPv6 at all.
func namespaceSysctls() map[string]string {
	return map[string]string{
		"net/ipv4/ip_forward":                enabled,
		"net/ipv4/conf/all/rp_filter":        enabled,
		"net/ipv4/conf/default/rp_filter":    enabled,
		"net/ipv4/conf/all/accept_local":     disabled,
		"net/ipv4/conf/all/send_redirects":   disabled,
		"net/ipv6/conf/all/disable_ipv6":     enabled,
		"net/ipv6/conf/default/disable_ipv6": enabled,
	}
}

// inNamespace runs fn on a thread that has joined ns. The thread is retired
// instead of reused if it cannot return to its original namespace.
func inNamespace(ns netns.NsHandle, fn func() error) error {
	runtime.LockOSThread()
	origin, err := netns.Get()
	if err != nil {
		runtime.UnlockOSThread()
		return fmt.Errorf("read current network namespace: %w", err)
	}
	defer origin.Close()
	if err := netns.Set(ns); err != nil {
		runtime.UnlockOSThread()
		return fmt.Errorf("join sandbox network namespace: %w", err)
	}
	result := fn()
	if err := netns.Set(origin); err != nil {
		return errors.Join(result, fmt.Errorf("return to the original network namespace: %w", err))
	}
	runtime.UnlockOSThread()
	return result
}

// createNamespace creates and names a fresh namespace without moving the
// calling thread into it permanently.
func createNamespace(name string) (netns.NsHandle, error) {
	if err := os.MkdirAll(namespaceDirectory, namespaceDirMode); err != nil {
		return netns.None(), fmt.Errorf("create network namespace directory: %w", err)
	}
	runtime.LockOSThread()
	origin, err := netns.Get()
	if err != nil {
		runtime.UnlockOSThread()
		return netns.None(), fmt.Errorf("read current network namespace: %w", err)
	}
	defer origin.Close()
	created, createErr := netns.NewNamed(name)
	if err := netns.Set(origin); err != nil {
		return netns.None(), errors.Join(createErr, fmt.Errorf("return to the original network namespace: %w", err))
	}
	runtime.UnlockOSThread()
	if createErr != nil {
		return netns.None(), fmt.Errorf("create network namespace %s: %w", name, createErr)
	}
	return created, nil
}

func deleteNamespace(name string) error {
	if err := netns.DeleteNamed(name); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("delete network namespace %s: %w", name, err)
	}
	return nil
}

// wireNamespace connects ns to the host through a veth pair, creates the
// guest TAP inside it and applies the namespace sysctls.
func wireNamespace(ns netns.NsHandle, instanceID string, allocation Allocation) error {
	hostAddress, err := pointToPoint(allocation.TransitHost, transitPairBits)
	if err != nil {
		return err
	}
	sandboxAddress, err := pointToPoint(allocation.TransitSandbox, transitPairBits)
	if err != nil {
		return err
	}
	gatewayAddress, err := pointToPoint(allocation.Gateway, guestPrefixBits)
	if err != nil {
		return err
	}
	veth := &netlink.Veth{
		LinkAttrs:     netlink.LinkAttrs{Name: allocation.HostVeth},
		PeerName:      namespaceUplink,
		PeerNamespace: netlink.NsFd(int(ns)),
	}
	if err := netlink.LinkAdd(veth); err != nil && !errors.Is(err, unix.EEXIST) {
		return fmt.Errorf("create sandbox veth pair: %w", err)
	}
	if err := configureLink(nil, allocation.HostVeth, hostAddress); err != nil {
		return err
	}
	handle, err := netlink.NewHandleAt(ns)
	if err != nil {
		return fmt.Errorf("open sandbox namespace netlink handle: %w", err)
	}
	defer handle.Close()
	if err := configureLink(handle, loopbackInterface, nil); err != nil {
		return err
	}
	if err := configureLink(handle, namespaceUplink, sandboxAddress); err != nil {
		return err
	}
	gateway, err := netip.ParseAddr(allocation.TransitHost)
	if err != nil {
		return fmt.Errorf("parse transit gateway: %w", err)
	}
	if err := handle.RouteReplace(&netlink.Route{Gw: net.IP(gateway.AsSlice())}); err != nil {
		return fmt.Errorf("route sandbox traffic to the host: %w", err)
	}
	return inNamespace(ns, func() error {
		if err := createTAP(instanceID); err != nil {
			return err
		}
		if err := configureLink(nil, TAPName, gatewayAddress); err != nil {
			return err
		}
		return writeSysctls(namespaceSysctls())
	})
}

func createTAP(instanceID string) error {
	if _, err := netlink.LinkByName(TAPName); err == nil {
		return nil
	}
	owner, group, err := jailidentity.ForInstance(instanceID)
	if err != nil {
		return fmt.Errorf("resolve TAP owner: %w", err)
	}
	tap := &netlink.Tuntap{
		LinkAttrs: netlink.LinkAttrs{Name: TAPName},
		Mode:      netlink.TUNTAP_MODE_TAP,
		Owner:     owner,
		Group:     group,
	}
	if err := netlink.LinkAdd(tap); err != nil {
		return fmt.Errorf("create guest TAP: %w", err)
	}
	return nil
}

// configureLink brings name up and assigns address when given; a nil handle
// works in the calling thread's namespace.
func configureLink(handle *netlink.Handle, name string, address *netlink.Addr) error {
	if handle == nil {
		handle = &netlink.Handle{}
	}
	link, err := handle.LinkByName(name)
	if err != nil {
		return fmt.Errorf("find link %s: %w", name, err)
	}
	if address != nil {
		if err := handle.AddrReplace(link, address); err != nil {
			return fmt.Errorf("address link %s: %w", name, err)
		}
	}
	if err := handle.LinkSetUp(link); err != nil {
		return fmt.Errorf("bring link %s up: %w", name, err)
	}
	return nil
}

func pointToPoint(address string, bits int) (*netlink.Addr, error) {
	parsed, err := netip.ParseAddr(address)
	if err != nil || !parsed.Is4() {
		return nil, fmt.Errorf("invalid IPv4 address %q", address)
	}
	return &netlink.Addr{IPNet: &net.IPNet{IP: net.IP(parsed.AsSlice()), Mask: net.CIDRMask(bits, ipv4Bits)}}, nil
}

func writeSysctls(values map[string]string) error {
	for key, value := range values {
		if err := os.WriteFile(filepath.Join(sysctlRoot, key), []byte(value), sysctlFileMode); err != nil {
			return fmt.Errorf("set sysctl %s: %w", key, err)
		}
	}
	return nil
}
