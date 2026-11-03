// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"strings"

	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

func tierNames() map[apiclient.MachineTier]string {
	return map[apiclient.MachineTier]string{
		apiclient.MachineTierPrivate:    text.TierPrivate,
		apiclient.MachineTierCommunity:  text.TierCommunity,
		apiclient.MachineTierVerified:   text.TierVerified,
		apiclient.MachineTierDatacenter: text.TierDatacenter,
	}
}

func listingNames() map[apiclient.ListingState]string {
	return map[apiclient.ListingState]string{
		apiclient.ListingStateDraft:  text.ListingDraft,
		apiclient.ListingStateListed: text.ListingListed,
		apiclient.ListingStatePaused: text.ListingPaused,
	}
}

func visibilityNames() map[apiclient.ListingVisibility]string {
	return map[apiclient.ListingVisibility]string{
		apiclient.ListingVisibilityPrivate: text.VisibilityPrivate,
		apiclient.ListingVisibilityPublic:  text.VisibilityPublic,
	}
}

func marketplaceRows(theme style.Theme, machine *apiclient.MachineIdentityStatus) []string {
	dashboardNote := theme.Indent.Render(theme.Muted.Render(text.MarketplaceManagedInDashboard))
	if machine == nil || machine.Marketplace == nil {
		return []string{
			Row(theme, text.LabelMarketplace, theme.Muted.Render(text.MarketplaceNotRegistered)),
			dashboardNote,
		}
	}
	marketplace := machine.Marketplace
	rows := []string{
		Row(theme, text.LabelMarketplace, theme.Value.Render(text.MarketplaceSummary(
			named(tierNames(), marketplace.Tier),
			named(listingNames(), marketplace.ListingState),
			named(visibilityNames(), marketplace.Visibility),
		))),
		Row(theme, text.LabelBenchmark, benchmark(theme, marketplace.LatestBenchmarkState)),
	}
	if len(marketplace.Reasons) > 0 {
		rows = append(rows, Row(theme, text.LabelTierNotes, theme.Secondary.Render(strings.Join(marketplace.Reasons, text.ListSeparator))))
	}
	return append(rows, dashboardNote)
}

func benchmark(theme style.Theme, state *apiclient.BenchmarkState) string {
	if state == nil {
		return theme.Muted.Render(text.BenchmarkNone)
	}
	switch *state {
	case apiclient.BenchmarkStatePassed:
		return theme.Success.Render(style.SymbolPass + space + text.BenchmarkPassed)
	case apiclient.BenchmarkStatePending:
		return theme.Warning.Render(style.SymbolPending + space + text.BenchmarkPending)
	case apiclient.BenchmarkStateFailed:
		return theme.Danger.Render(style.SymbolFail + space + text.BenchmarkFailed)
	case apiclient.BenchmarkStateExpired:
		return theme.Danger.Render(style.SymbolFail + space + text.BenchmarkExpired)
	default:
		return theme.Muted.Render(text.MarketplaceUnknown)
	}
}

func named[K comparable](names map[K]string, key K) string {
	if name, found := names[key]; found {
		return name
	}
	return text.MarketplaceUnknown
}
