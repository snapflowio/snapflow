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
	"strconv"

	"github.com/snapflowio/microvm-go/internal/jailidentity"
	"github.com/vishvananda/netlink"
	"github.com/vishvananda/netns"
	"golang.org/x/sys/unix"
)

const (
	sysctlRoot              = "/proc/sys"
	sysctlFileMode          = 0o644
	namespaceDirMode        = 0o755
	namespacePinMode        = 0o444
	procRoot                = "/proc"
	processNetworkNamespace = "ns/net"
	noNamespaceOwner        = 0
	loopbackInterface       = "lo"
	enabled                 = "1"
	disabled                = "0"
)

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

func openNamespace(name string, owner int) (netns.NsHandle, error) {
	ns, err := netns.GetFromName(name)
	switch {
	case err == nil:
		live, liveErr := isNetworkNamespace(ns)
		if live || liveErr != nil {
			return closeUnless(ns, live, liveErr)
		}
		if err := ns.Close(); err != nil {
			return netns.None(), fmt.Errorf("close stale network namespace pin %s: %w", name, err)
		}
	case !errors.Is(err, os.ErrNotExist):
		return netns.None(), fmt.Errorf("open network namespace %s: %w", name, err)
	}
	if err := os.Remove(NamespacePath(name)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return netns.None(), fmt.Errorf("remove stale network namespace pin %s: %w", name, err)
	}
	if owner > 0 {
		return pinNamespace(name, owner)
	}
	return createNamespace(name)
}

func closeUnless(ns netns.NsHandle, keep bool, err error) (netns.NsHandle, error) {
	if keep {
		return ns, nil
	}
	return netns.None(), errors.Join(err, ns.Close())
}

func isNetworkNamespace(ns netns.NsHandle) (bool, error) {
	var stat unix.Statfs_t
	if err := unix.Fstatfs(int(ns), &stat); err != nil {
		return false, fmt.Errorf("inspect network namespace pin: %w", err)
	}
	return stat.Type == unix.NSFS_MAGIC, nil
}

func pinNamespace(name string, owner int) (netns.NsHandle, error) {
	if err := os.MkdirAll(namespaceDirectory, namespaceDirMode); err != nil {
		return netns.None(), fmt.Errorf("create network namespace directory: %w", err)
	}
	path := NamespacePath(name)
	file, err := os.OpenFile(path, os.O_RDONLY|os.O_CREATE|os.O_EXCL, namespacePinMode)
	if err != nil {
		return netns.None(), fmt.Errorf("create network namespace pin %s: %w", name, err)
	}
	if err := file.Close(); err != nil {
		return netns.None(), fmt.Errorf("create network namespace pin %s: %w", name, err)
	}
	source := filepath.Join(procRoot, strconv.Itoa(owner), processNetworkNamespace)
	if err := unix.Mount(source, path, "", unix.MS_BIND, ""); err != nil {
		return netns.None(), errors.Join(
			fmt.Errorf("adopt the network namespace of microVM process %d as %s: %w", owner, name, err),
			os.Remove(path),
		)
	}
	ns, err := netns.GetFromPath(path)
	if err != nil {
		return netns.None(), fmt.Errorf("open adopted network namespace %s: %w", name, err)
	}
	return ns, nil
}

func deleteNamespace(name string) error {
	path := NamespacePath(name)
	if err := unix.Unmount(path, unix.MNT_DETACH); err != nil && !errors.Is(err, unix.EINVAL) && !errors.Is(err, unix.ENOENT) {
		return fmt.Errorf("delete network namespace %s: %w", name, err)
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("delete network namespace %s: %w", name, err)
	}
	return nil
}

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
