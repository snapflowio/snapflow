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
	"errors"
	"fmt"
	"math"

	"github.com/vishvananda/netlink"
	"golang.org/x/sys/unix"
)

const (
	sandboxUploadDevice    = "sfup"
	shaperMajor            = 1
	shaperClassMinor       = 1
	shaperLeafMajor        = 0x10
	ingressQdiscMajor      = 0xffff
	redirectFilterPriority = 1
	bitsPerByte            = 8
	microsecondsPerSecond  = 1_000_000
	queueWindowDivisor     = 10
	minimumQueueBytes      = 64 * 1024
	minimumBurstBytes      = 64 * 1024
	shaperKind             = "tbf"
)

func applySandboxShaping(handle *netlink.Handle, traffic sandboxTraffic) error {
	tap, err := handle.LinkByName(TAPName)
	if err != nil {
		return fmt.Errorf("find guest TAP for bandwidth shaping: %w", err)
	}
	return errors.Join(
		applyShaper(handle, tap, traffic.download.bps, traffic.download.burstBytes),
		applyRedirectedShaper(handle, tap, sandboxUploadDevice, traffic.upload.bps, traffic.upload.burstBytes),
	)
}

func applyRedirectedShaper(handle *netlink.Handle, source netlink.Link, device string, bandwidthBPS, burstBytes uint64) error {
	if bandwidthBPS == 0 {
		return errors.Join(removeIngress(handle, source), deleteLinkWith(handle, device))
	}
	ifb, err := ensureIFB(handle, device)
	if err != nil {
		return err
	}
	if err := applyShaper(handle, ifb, bandwidthBPS, burstBytes); err != nil {
		return err
	}
	return redirectIngress(handle, source, ifb)
}

func applyShaper(handle *netlink.Handle, link netlink.Link, bandwidthBPS, burstBytes uint64) error {
	if bandwidthBPS == 0 {
		return removeShaper(handle, link)
	}
	if bandwidthBPS < MinimumBandwidthBPS || bandwidthBPS > MaximumBandwidthBPS {
		return fmt.Errorf("bandwidth %d bits per second is outside the supported range", bandwidthBPS)
	}
	rateBytes := (bandwidthBPS + bitsPerByte - 1) / bitsPerByte
	index := link.Attrs().Index
	root := &netlink.Tbf{
		QdiscAttrs: netlink.QdiscAttrs{LinkIndex: index, Handle: netlink.MakeHandle(shaperMajor, 0), Parent: netlink.HANDLE_ROOT},
		Rate:       rateBytes,
		Limit:      queueLimit(rateBytes),
		Buffer:     netlink.Xmittime(rateBytes, shaperBurst(rateBytes, burstBytes)),
	}
	if err := handle.QdiscReplace(root); err != nil {
		return fmt.Errorf("install bandwidth shaper on %s: %w", link.Attrs().Name, err)
	}
	leaf := netlink.NewFqCodel(netlink.QdiscAttrs{
		LinkIndex: index,
		Handle:    netlink.MakeHandle(shaperLeafMajor, 0),
		Parent:    netlink.MakeHandle(shaperMajor, shaperClassMinor),
	})
	if err := handle.QdiscReplace(leaf); err != nil {
		return fmt.Errorf("install fair queue under the shaper on %s: %w", link.Attrs().Name, err)
	}
	return nil
}

func queueLimit(rateBytes uint64) uint32 {
	return uint32(min(max(rateBytes/queueWindowDivisor, minimumQueueBytes), math.MaxUint32))
}

func shaperBurst(rateBytes, requested uint64) uint32 {
	ticksPerMicrosecond := max(netlink.TickInUsec(), 1)
	maximum := uint64(float64(math.MaxUint32) / ticksPerMicrosecond * float64(rateBytes) / microsecondsPerSecond)
	return uint32(min(max(requested, minimumBurstBytes), maximum, math.MaxUint32))
}

func removeShaper(handle *netlink.Handle, link netlink.Link) error {
	qdiscs, err := handle.QdiscList(link)
	if err != nil {
		return fmt.Errorf("list queues of %s: %w", link.Attrs().Name, err)
	}
	for _, qdisc := range qdiscs {
		attrs := qdisc.Attrs()
		if qdisc.Type() != shaperKind || attrs.Parent != netlink.HANDLE_ROOT {
			continue
		}
		if err := handle.QdiscDel(qdisc); err != nil && !isNetlinkNotFound(err) {
			return fmt.Errorf("remove bandwidth shaper from %s: %w", link.Attrs().Name, err)
		}
	}
	return nil
}

func ingressQdisc(link netlink.Link) *netlink.Ingress {
	return &netlink.Ingress{QdiscAttrs: netlink.QdiscAttrs{
		LinkIndex: link.Attrs().Index,
		Handle:    netlink.MakeHandle(ingressQdiscMajor, 0),
		Parent:    netlink.HANDLE_INGRESS,
	}}
}

func removeIngress(handle *netlink.Handle, link netlink.Link) error {
	if err := handle.QdiscDel(ingressQdisc(link)); err != nil && !isNetlinkNotFound(err) && !errors.Is(err, unix.EINVAL) {
		return fmt.Errorf("remove ingress redirect from %s: %w", link.Attrs().Name, err)
	}
	return nil
}

func redirectIngress(handle *netlink.Handle, source, target netlink.Link) error {
	ingress := ingressQdisc(source)
	if err := handle.QdiscAdd(ingress); err != nil && !isNetlinkExists(err) {
		return fmt.Errorf("install ingress queue on %s: %w", source.Attrs().Name, err)
	}
	filters, err := handle.FilterList(source, ingress.Handle)
	if err != nil {
		return fmt.Errorf("list ingress filters of %s: %w", source.Attrs().Name, err)
	}
	for _, filter := range filters {
		if redirectsTo(filter, target) {
			return nil
		}
		if filter.Attrs().Priority != redirectFilterPriority {
			continue
		}
		if err := handle.FilterDel(filter); err != nil && !isNetlinkNotFound(err) {
			return fmt.Errorf("remove stale ingress filter from %s: %w", source.Attrs().Name, err)
		}
	}
	redirect := &netlink.MatchAll{
		FilterAttrs: netlink.FilterAttrs{
			LinkIndex: source.Attrs().Index,
			Parent:    ingress.Handle,
			Priority:  redirectFilterPriority,
			Protocol:  unix.ETH_P_ALL,
		},
		Actions: []netlink.Action{netlink.NewMirredAction(target.Attrs().Index)},
	}
	if err := handle.FilterAdd(redirect); err != nil {
		return fmt.Errorf("redirect %s ingress to %s: %w", source.Attrs().Name, target.Attrs().Name, err)
	}
	return nil
}

func redirectsTo(filter netlink.Filter, target netlink.Link) bool {
	matchAll, ok := filter.(*netlink.MatchAll)
	if !ok || matchAll.Priority != redirectFilterPriority {
		return false
	}
	for _, action := range matchAll.Actions {
		if mirred, ok := action.(*netlink.MirredAction); ok && mirred.Ifindex == target.Attrs().Index {
			return true
		}
	}
	return false
}

func ensureIFB(handle *netlink.Handle, name string) (netlink.Link, error) {
	link, err := handle.LinkByName(name)
	if isLinkNotFound(err) {
		if err := handle.LinkAdd(&netlink.Ifb{LinkAttrs: netlink.LinkAttrs{Name: name}}); err != nil && !isNetlinkExists(err) {
			return nil, fmt.Errorf("create shaping device %s: %w", name, err)
		}
		link, err = handle.LinkByName(name)
	}
	if err != nil {
		return nil, fmt.Errorf("find shaping device %s: %w", name, err)
	}
	if err := handle.LinkSetUp(link); err != nil {
		return nil, fmt.Errorf("bring shaping device %s up: %w", name, err)
	}
	return link, nil
}

func deleteLinkWith(handle *netlink.Handle, name string) error {
	link, err := handle.LinkByName(name)
	if isLinkNotFound(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("find link %s: %w", name, err)
	}
	if err := handle.LinkDel(link); err != nil && !isLinkNotFound(err) {
		return fmt.Errorf("delete link %s: %w", name, err)
	}
	return nil
}

func isNetlinkNotFound(err error) bool {
	return errors.Is(err, unix.ENOENT)
}

func isNetlinkExists(err error) bool {
	return errors.Is(err, unix.EEXIST)
}
