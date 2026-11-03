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

	"github.com/vishvananda/netlink"
	"github.com/vishvananda/netns"
	"golang.org/x/sys/unix"
)

const (
	egressBandwidthFilterPriority = 1
	bitsPerByte                   = 8
	ingressQdiscMajor             = 0xffff
)

// applyEgressBandwidth polices traffic the guest sends, at the ingress of its
// TAP inside the namespace.
func applyEgressBandwidth(ns netns.NsHandle, bandwidthBPS uint64) error {
	handle, err := netlink.NewHandleAt(ns)
	if err != nil {
		return fmt.Errorf("open sandbox namespace netlink handle: %w", err)
	}
	defer handle.Close()
	link, err := handle.LinkByName(TAPName)
	if err != nil {
		return fmt.Errorf("find guest TAP for egress bandwidth enforcement: %w", err)
	}
	ingress := &netlink.Ingress{QdiscAttrs: netlink.QdiscAttrs{
		LinkIndex: link.Attrs().Index,
		Handle:    ingressQdiscHandle(),
		Parent:    netlink.HANDLE_INGRESS,
	}}
	if bandwidthBPS == 0 {
		if err := handle.QdiscDel(ingress); err != nil && !isNetlinkNotFound(err) {
			return fmt.Errorf("remove TAP egress bandwidth limiter: %w", err)
		}
		return nil
	}
	if err := handle.QdiscAdd(ingress); err != nil && !isNetlinkExists(err) {
		return fmt.Errorf("install TAP ingress queue for egress bandwidth limiter: %w", err)
	}
	rateBytes, burstBytes, err := bandwidthPoliceParameters(bandwidthBPS)
	if err != nil {
		return err
	}
	current, err := replaceStaleBandwidthFilters(handle, link, ingress.Parent, rateBytes, burstBytes)
	if err != nil || current {
		return err
	}
	if err := handle.FilterAdd(bandwidthPoliceFilter(link, rateBytes, burstBytes)); err != nil {
		return fmt.Errorf("install TAP egress bandwidth police filter: %w", err)
	}
	return nil
}

func ingressQdiscHandle() uint32 {
	return netlink.MakeHandle(ingressQdiscMajor, 0)
}

func replaceStaleBandwidthFilters(handle *netlink.Handle, link netlink.Link, parent, rateBytes, burstBytes uint32) (bool, error) {
	existingFilters, err := handle.FilterList(link, parent)
	if err != nil {
		return false, fmt.Errorf("list TAP egress bandwidth filters: %w", err)
	}
	var staleFilters []netlink.Filter
	for _, existingFilter := range existingFilters {
		u32, ok := existingFilter.(*netlink.U32)
		if !ok || u32.Priority != egressBandwidthFilterPriority ||
			u32.Protocol != unix.ETH_P_ALL || u32.Police == nil {
			continue
		}
		if policeMatches(u32.Police, rateBytes, burstBytes) {
			return true, nil
		}
		staleFilters = append(staleFilters, existingFilter)
	}
	for _, staleFilter := range staleFilters {
		if err := handle.FilterDel(staleFilter); err != nil && !isNetlinkNotFound(err) {
			return false, fmt.Errorf("remove stale TAP egress bandwidth filter: %w", err)
		}
	}
	return false, nil
}

func policeMatches(police *netlink.PoliceAction, rateBytes, burstBytes uint32) bool {
	return police.Rate == rateBytes && police.Burst == burstBytes &&
		police.ExceedAction == netlink.TC_POLICE_SHOT &&
		police.NotExceedAction == netlink.TC_POLICE_OK
}

func bandwidthPoliceFilter(link netlink.Link, rateBytes, burstBytes uint32) *netlink.U32 {
	police := netlink.NewPoliceAction()
	police.Rate = rateBytes
	police.Burst = burstBytes
	police.ExceedAction = netlink.TC_POLICE_SHOT
	police.NotExceedAction = netlink.TC_POLICE_OK
	return &netlink.U32{
		FilterAttrs: netlink.FilterAttrs{
			LinkIndex: link.Attrs().Index,
			Parent:    ingressQdiscHandle(),
			Handle:    netlink.MakeHandle(0, 1),
			Priority:  egressBandwidthFilterPriority,
			Protocol:  unix.ETH_P_ALL,
		},
		Sel: &netlink.TcU32Sel{
			Nkeys: 1,
			Flags: netlink.TC_U32_TERMINAL,
			Keys:  []netlink.TcU32Key{{Mask: 0, Val: 0, Off: 0}},
		},
		Police: police,
	}
}

func bandwidthPoliceParameters(bandwidthBPS uint64) (uint32, uint32, error) {
	if bandwidthBPS < MinimumEgressBandwidthBPS || bandwidthBPS > MaximumEgressBandwidthBPS {
		return 0, 0, fmt.Errorf("egress bandwidth %d bits per second is outside the supported range", bandwidthBPS)
	}
	rateBytes := (bandwidthBPS + bitsPerByte - 1) / bitsPerByte
	const (
		minimumBurstBytes  = uint64(64 * 1024)
		maximumBurstBytes  = uint64(4 * 1024 * 1024)
		burstWindowDivisor = uint64(10)
	)
	burstBytes := rateBytes / burstWindowDivisor
	if burstBytes < minimumBurstBytes {
		burstBytes = minimumBurstBytes
	}
	if burstBytes > maximumBurstBytes {
		burstBytes = maximumBurstBytes
	}
	return uint32(rateBytes), uint32(burstBytes), nil
}

func isNetlinkNotFound(err error) bool {
	return errors.Is(err, unix.ENOENT)
}

func isNetlinkExists(err error) bool {
	return errors.Is(err, unix.EEXIST)
}
