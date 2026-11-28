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
	"strings"

	"github.com/vishvananda/netlink"
)

const householdUploadDevice = "snapflow-up"

func applyHouseholdCap(policy TrafficPolicy) error {
	handle := &netlink.Handle{}
	links, err := handle.LinkList()
	if err != nil {
		return fmt.Errorf("list host links for the household upload cap: %w", err)
	}
	var veths []netlink.Link
	for _, link := range links {
		if strings.HasPrefix(link.Attrs().Name, VethPrefix) {
			veths = append(veths, link)
		}
	}
	if policy.HostUploadBPS == 0 {
		failures := make([]error, 0, len(veths)+1)
		for _, veth := range veths {
			failures = append(failures, removeIngress(handle, veth))
		}
		return errors.Join(append(failures, deleteLinkWith(handle, householdUploadDevice))...)
	}
	ifb, err := ensureIFB(handle, householdUploadDevice)
	if err != nil {
		return err
	}
	if err := applyShaper(handle, ifb, policy.HostUploadBPS, policy.BurstBytes); err != nil {
		return err
	}
	failures := make([]error, 0, len(veths))
	for _, veth := range veths {
		failures = append(failures, redirectIngress(handle, veth, ifb))
	}
	return errors.Join(failures...)
}
