// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package local

import (
	"net/url"
	"strings"

	"github.com/snapflowio/snapflow/internal/foundation/config"
)

const (
	pathSeparator     = "/"
	dashboardMachines = "machines"
	dashboardAdd      = "add"
	dashboardHealth   = "health"
	dashboardSoftware = "software"
	dashboardTrust    = "trust"
	dashboardListings = "listings"
	dashboardMine     = "mine"
	dashboardEarnings = "earnings"
	dashboardPayouts  = "payouts"
)

type dashboardPages struct {
	root      string
	machineID string
}

func newDashboardPages(profile config.Profile, machineID string) dashboardPages {
	return dashboardPages{root: profile.DashboardRoot, machineID: machineID}
}

func (pages dashboardPages) page(segments ...string) string {
	if pages.root == "" {
		return ""
	}
	escaped := make([]string, 0, len(segments)+1)
	escaped = append(escaped, strings.TrimSuffix(pages.root, pathSeparator))
	for _, segment := range segments {
		escaped = append(escaped, url.PathEscape(segment))
	}
	return strings.Join(escaped, pathSeparator)
}

func (pages dashboardPages) machinePage(segments ...string) string {
	if pages.machineID == "" {
		return pages.page(dashboardMachines)
	}
	return pages.page(append([]string{dashboardMachines, pages.machineID}, segments...)...)
}

func (pages dashboardPages) machine() string { return pages.machinePage() }

func (pages dashboardPages) addMachine() string { return pages.page(dashboardMachines, dashboardAdd) }

func (pages dashboardPages) health() string { return pages.machinePage(dashboardHealth) }

func (pages dashboardPages) software() string { return pages.machinePage(dashboardSoftware) }

func (pages dashboardPages) trust() string { return pages.machinePage(dashboardTrust) }

func (pages dashboardPages) listing() string {
	if pages.machineID == "" {
		return pages.page(dashboardListings, dashboardMine)
	}
	return pages.page(dashboardListings, dashboardMine, pages.machineID)
}

func (pages dashboardPages) payouts() string { return pages.page(dashboardEarnings, dashboardPayouts) }
