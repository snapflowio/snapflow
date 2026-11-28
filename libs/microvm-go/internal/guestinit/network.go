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

package guestinit

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/insomniacslk/dhcp/dhcpv4/nclient4"
	"github.com/snapflowio/microvm-go/internal/configdrive"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/vishvananda/netlink"
)

const dhcpLeaseTimeout = 15 * time.Second

func configureNetwork(cfg *Config) error {
	loopback, err := netlink.LinkByName("lo")
	if err != nil {
		return fmt.Errorf("find guest loopback: %w", err)
	}
	if err := netlink.LinkSetUp(loopback); err != nil {
		return fmt.Errorf("bring up guest loopback: %w", err)
	}
	if cfg.NetworkMode == "" {
		return nil
	}

	link, err := netlink.LinkByName("eth0")
	if err != nil {
		link, err = firstEthernetLink()
		if err != nil {
			return err
		}
	}
	if err := netlink.LinkSetUp(link); err != nil {
		return fmt.Errorf("bring up guest link %s: %w", link.Attrs().Name, err)
	}

	switch cfg.NetworkMode {
	case configdrive.NetworkModeStatic:
		return configureStaticNetwork(link, cfg)
	case configdrive.NetworkModeDHCP:
		return configureDHCPNetwork(link)
	default:
		return fmt.Errorf("unsupported guest network mode %q", cfg.NetworkMode)
	}
}

func configureStaticNetwork(link netlink.Link, cfg *Config) error {
	if cfg.GuestIP == "" || cfg.GuestGW == "" || cfg.GuestCIDR <= 0 {
		return fmt.Errorf("static network configuration is incomplete")
	}

	address := fmt.Sprintf("%s/%d", cfg.GuestIP, cfg.GuestCIDR)
	addr, err := netlink.ParseAddr(address)
	if err != nil {
		return fmt.Errorf("parse guest address %s: %w", address, err)
	}
	if err := netlink.AddrReplace(link, addr); err != nil {
		return fmt.Errorf("add guest address: %w", err)
	}
	gateway := net.ParseIP(cfg.GuestGW)
	if gateway == nil {
		return fmt.Errorf("invalid gateway %q", cfg.GuestGW)
	}
	route := &netlink.Route{LinkIndex: link.Attrs().Index, Gw: gateway}
	if err := netlink.RouteReplace(route); err != nil {
		return fmt.Errorf("add default route: %w", err)
	}

	dns := cfg.GuestDNS
	if dns == "" {
		dns = cfg.GuestGW
	}
	return writeResolver([]net.IP{net.ParseIP(dns)})
}

func configureDHCPNetwork(link netlink.Link) error {
	ctx, cancel := context.WithTimeout(context.Background(), dhcpLeaseTimeout)
	defer cancel()

	client, err := nclient4.New(link.Attrs().Name)
	if err != nil {
		return fmt.Errorf("create DHCP client for %s: %w", link.Attrs().Name, err)
	}
	defer client.Close()

	lease, err := client.Request(ctx)
	if err != nil {
		return fmt.Errorf("request DHCP lease for %s: %w", link.Attrs().Name, err)
	}
	if lease == nil || lease.ACK == nil || lease.ACK.YourIPAddr == nil {
		return fmt.Errorf("dhcp server returned an incomplete lease for %s", link.Attrs().Name)
	}

	mask := lease.ACK.SubnetMask()
	ones, bits := mask.Size()
	if bits != 32 || ones <= 0 {
		return fmt.Errorf("dhcp lease for %s has an invalid subnet mask", link.Attrs().Name)
	}
	addr, err := netlink.ParseAddr(fmt.Sprintf("%s/%d", lease.ACK.YourIPAddr.String(), ones))
	if err != nil {
		return fmt.Errorf("parse DHCP address for %s: %w", link.Attrs().Name, err)
	}
	if err := netlink.AddrReplace(link, addr); err != nil {
		return fmt.Errorf("apply DHCP address to %s: %w", link.Attrs().Name, err)
	}

	routers := lease.ACK.Router()
	if len(routers) == 0 || routers[0] == nil {
		return fmt.Errorf("dhcp lease for %s does not include a default gateway", link.Attrs().Name)
	}
	if err := netlink.RouteReplace(&netlink.Route{LinkIndex: link.Attrs().Index, Gw: routers[0]}); err != nil {
		return fmt.Errorf("apply DHCP default route to %s: %w", link.Attrs().Name, err)
	}

	dns := lease.ACK.DNS()
	if len(dns) == 0 {
		dns = routers[:1]
	}
	return writeResolver(dns)
}

func writeResolver(servers []net.IP) error {
	lines := make([]string, 0, len(servers))
	for _, server := range servers {
		if server == nil {
			continue
		}
		lines = append(lines, "nameserver "+server.String())
	}
	if len(lines) == 0 {
		return fmt.Errorf("network configuration did not provide a DNS server")
	}

	resolv := filepath.Join(newRoot, "etc", "resolv.conf")
	if err := os.MkdirAll(filepath.Dir(resolv), filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create resolv.conf directory: %w", err)
	}
	if err := os.WriteFile(resolv, []byte(strings.Join(lines, "\n")+"\n"), filemode.SharedFile); err != nil {
		return fmt.Errorf("write resolv.conf: %w", err)
	}
	return nil
}

func firstEthernetLink() (netlink.Link, error) {
	links, err := netlink.LinkList()
	if err != nil {
		return nil, fmt.Errorf("list guest links: %w", err)
	}
	for _, link := range links {
		attrs := link.Attrs()
		if attrs == nil || attrs.Name == "lo" {
			continue
		}
		return link, nil
	}
	return nil, fmt.Errorf("no guest ethernet link found")
}
