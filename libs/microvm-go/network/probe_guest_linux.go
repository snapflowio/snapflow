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

//go:build linux

package network

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"

	"github.com/vishvananda/netlink"
	"github.com/vishvananda/netns"
)

const (
	probeGuestUplink   = "eth0"
	probeListenAddress = "0.0.0.0:0"
	probeSpoofedIP     = "10.0.0.5"
	probeSpoofedMAC    = "06:00:0a:00:00:99"
)

// cleanupStack undoes probe setup in reverse order; every step runs even
// when an earlier one fails.
type cleanupStack []func() error

func (stack *cleanupStack) push(step func() error) { *stack = append(*stack, step) }

func (stack cleanupStack) run() error {
	failures := make([]error, 0, len(stack))
	for index := len(stack) - 1; index >= 0; index-- {
		failures = append(failures, stack[index]())
	}
	return errors.Join(failures...)
}

// probeGuest stands in for a microVM: a namespace wired to the sandbox through
// a veth named like the TAP, carrying the fixed guest addressing.
type probeGuest struct {
	instanceID string
	allocation Allocation
	sandbox    netns.NsHandle
	namespace  netns.NsHandle
}

func (guest probeGuest) binding(peers ...string) PolicyBinding {
	return PolicyBinding{
		InstanceID: guest.instanceID, Namespace: guest.allocation.Namespace,
		TransitSandbox: guest.allocation.TransitSandbox, TransitHost: guest.allocation.TransitHost,
		DNS: guest.allocation.DNS, PeerTransits: peers,
	}
}

func newProbeGuest(ctx context.Context, manager *Manager, cleanup *cleanupStack, instanceID, guestName string) (probeGuest, error) {
	allocation, err := manager.Allocate(ctx, instanceID)
	if err != nil {
		return probeGuest{}, fmt.Errorf("allocate sandbox network: %w", err)
	}
	if allocation == nil {
		return probeGuest{}, errors.New("sandbox networking is disabled; check the transit range")
	}
	cleanup.push(func() error { return manager.Release(context.WithoutCancel(ctx), allocation) })
	sandbox, err := openProbeNamespace(cleanup, allocation.Namespace)
	if err != nil {
		return probeGuest{}, err
	}
	guest, err := createNamespace(guestName)
	if err != nil {
		return probeGuest{}, err
	}
	cleanup.push(func() error {
		closeErr := guest.Close()
		if closeErr != nil {
			closeErr = fmt.Errorf("close guest namespace: %w", closeErr)
		}
		return errors.Join(closeErr, deleteNamespace(guestName))
	})
	if err := replaceTAPWithVeth(sandbox, guest); err != nil {
		return probeGuest{}, err
	}
	created := probeGuest{instanceID: instanceID, allocation: *allocation, sandbox: sandbox, namespace: guest}
	if err := manager.ApplyEgressPolicy(ctx, created.binding()); err != nil {
		return probeGuest{}, fmt.Errorf("apply sandbox rules: %w", err)
	}
	return created, nil
}

// replaceTAPWithVeth swaps the sandbox TAP for a veth into the guest
// namespace, so the sandbox rules see the same interface name a VM uses.
func replaceTAPWithVeth(sandbox, guest netns.NsHandle) error {
	handle, err := netlink.NewHandleAt(sandbox)
	if err != nil {
		return fmt.Errorf("open sandbox namespace netlink handle: %w", err)
	}
	defer handle.Close()
	tap, err := handle.LinkByName(TAPName)
	if err != nil {
		return fmt.Errorf("find guest TAP: %w", err)
	}
	if err := handle.LinkDel(tap); err != nil {
		return fmt.Errorf("delete guest TAP: %w", err)
	}
	veth := &netlink.Veth{LinkAttrs: netlink.LinkAttrs{Name: TAPName}, PeerName: probeGuestUplink, PeerNamespace: netlink.NsFd(int(guest))}
	if err := handle.LinkAdd(veth); err != nil {
		return fmt.Errorf("create stand-in guest veth: %w", err)
	}
	gateway, err := pointToPoint(GatewayIP, guestPrefixBits)
	if err != nil {
		return err
	}
	if err := configureLink(handle, TAPName, gateway); err != nil {
		return err
	}
	guestHandle, err := netlink.NewHandleAt(guest)
	if err != nil {
		return fmt.Errorf("open guest namespace netlink handle: %w", err)
	}
	defer guestHandle.Close()
	if err := setGuestMAC(guestHandle, GuestMAC); err != nil {
		return err
	}
	address, err := pointToPoint(GuestIP, guestPrefixBits)
	if err != nil {
		return err
	}
	if err := configureLink(guestHandle, loopbackInterface, nil); err != nil {
		return err
	}
	if err := configureLink(guestHandle, probeGuestUplink, address); err != nil {
		return err
	}
	if err := guestHandle.RouteReplace(&netlink.Route{Gw: net.ParseIP(GatewayIP)}); err != nil {
		return fmt.Errorf("route stand-in guest traffic to the gateway: %w", err)
	}
	return nil
}

func setGuestMAC(handle *netlink.Handle, mac string) error {
	address, err := net.ParseMAC(mac)
	if err != nil {
		return fmt.Errorf("parse guest MAC %s: %w", mac, err)
	}
	link, err := handle.LinkByName(probeGuestUplink)
	if err != nil {
		return fmt.Errorf("find stand-in guest uplink: %w", err)
	}
	if err := handle.LinkSetHardwareAddr(link, address); err != nil {
		return fmt.Errorf("set stand-in guest MAC: %w", err)
	}
	return nil
}

// spoofAddress adds an address the sandbox never assigned to the guest.
func spoofAddress(guest probeGuest) error {
	handle, err := netlink.NewHandleAt(guest.namespace)
	if err != nil {
		return fmt.Errorf("open guest namespace netlink handle: %w", err)
	}
	defer handle.Close()
	link, err := handle.LinkByName(probeGuestUplink)
	if err != nil {
		return fmt.Errorf("find stand-in guest uplink: %w", err)
	}
	address, err := pointToPoint(probeSpoofedIP, guestPrefixBits)
	if err != nil {
		return err
	}
	if err := handle.AddrAdd(link, address); err != nil {
		return fmt.Errorf("add spoofed guest address: %w", err)
	}
	return nil
}

func spoofMAC(guest probeGuest) error {
	handle, err := netlink.NewHandleAt(guest.namespace)
	if err != nil {
		return fmt.Errorf("open guest namespace netlink handle: %w", err)
	}
	defer handle.Close()
	return setGuestMAC(handle, probeSpoofedMAC)
}

// dialFrom opens and closes a TCP connection from inside the guest, from
// source when it is set.
func dialFrom(ctx context.Context, guest probeGuest, source, address string) error {
	dialCtx, cancel := context.WithTimeout(ctx, probeDialTimeout)
	defer cancel()
	dialer := &net.Dialer{}
	if source != "" {
		dialer.LocalAddr = &net.TCPAddr{IP: net.ParseIP(source)}
	}
	return inNamespace(guest.namespace, func() error {
		connection, err := dialer.DialContext(dialCtx, "tcp", address)
		if err != nil {
			return err
		}
		return connection.Close()
	})
}

// probeListener accepts and immediately closes connections so a dial proves
// reachability.
type probeListener struct {
	listener net.Listener
	done     chan struct{}
	// err is written only by the accept loop before done closes.
	err error
}

// listenIn listens on an ephemeral port in namespace, or in the calling
// thread's namespace when namespace is netns.None().
func listenIn(ctx context.Context, cleanup *cleanupStack, namespace netns.NsHandle) (int, error) {
	var listener net.Listener
	var config net.ListenConfig
	start := func() error {
		created, err := config.Listen(ctx, "tcp", probeListenAddress)
		listener = created
		return err
	}
	var err error
	if namespace == netns.None() {
		err = start()
	} else {
		err = inNamespace(namespace, start)
	}
	if err != nil {
		return 0, fmt.Errorf("start probe listener: %w", err)
	}
	accepting := &probeListener{listener: listener, done: make(chan struct{})}
	go accepting.serve()
	cleanup.push(accepting.close)
	address, ok := listener.Addr().(*net.TCPAddr)
	if !ok {
		return 0, fmt.Errorf("probe listener has unexpected address %s", listener.Addr())
	}
	return address.Port, nil
}

func (accepting *probeListener) serve() {
	defer close(accepting.done)
	for {
		connection, err := accepting.listener.Accept()
		if errors.Is(err, net.ErrClosed) {
			return
		}
		if err == nil {
			if closeErr := connection.Close(); closeErr != nil {
				accepting.err = errors.Join(accepting.err, fmt.Errorf("close accepted probe connection: %w", closeErr))
			}
		}
	}
}

func (accepting *probeListener) close() error {
	err := accepting.listener.Close()
	<-accepting.done
	if err != nil {
		err = fmt.Errorf("close probe listener: %w", err)
	}
	return errors.Join(err, accepting.err)
}

func openProbeNamespace(cleanup *cleanupStack, name string) (netns.NsHandle, error) {
	handle, err := netns.GetFromName(name)
	if err != nil {
		return netns.None(), fmt.Errorf("open network namespace %s: %w", name, err)
	}
	cleanup.push(func() error {
		if err := handle.Close(); err != nil {
			return fmt.Errorf("close namespace handle %s: %w", name, err)
		}
		return nil
	})
	return handle, nil
}

// hostLANAddress is an address the host owns on a real interface, which a
// guest must never reach.
func hostLANAddress(transit netip.Prefix) (string, error) {
	addresses, err := netlink.AddrList(nil, netlink.FAMILY_V4)
	if err != nil {
		return "", fmt.Errorf("list host addresses: %w", err)
	}
	for _, address := range addresses {
		parsed, ok := netip.AddrFromSlice(address.IP.To4())
		if ok && !parsed.IsLoopback() && !transit.Contains(parsed) {
			return parsed.String(), nil
		}
	}
	return "", errors.New("the host has no non-loopback IPv4 address")
}
