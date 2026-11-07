// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"slices"
	"testing"
	"time"

	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

func paidChannel(acceptedAt time.Time, channelState apiclient.PaymentChannelState) state.PaymentChannel {
	return state.PaymentChannel{
		ChannelID: "0x01", SandboxID: testSandboxID, LeaseID: testLeaseID, State: channelState,
		HoldWindow: testWindow, AcceptedAt: acceptedAt,
	}
}

func running(sandboxIDs ...string) map[string]bool {
	set := make(map[string]bool, len(sandboxIDs))
	for _, sandboxID := range sandboxIDs {
		set[sandboxID] = true
	}
	return set
}

func TestWatchdogGivesAStartingSandboxAFullWindow(t *testing.T) {
	dog := newWatchdog()
	start := testNow()
	stale := []state.PaymentChannel{paidChannel(start.Add(-time.Hour), apiclient.PaymentChannelStateOpen)}
	if hold, _ := dog.decide(stale, running(testSandboxID), start); len(hold) != 0 {
		t.Fatalf("a sandbox that just started (or a daemon that just restarted) was held: %v", hold)
	}
	if hold, _ := dog.decide(stale, running(testSandboxID), start.Add(testWindow)); len(hold) != 0 {
		t.Fatalf("held exactly at the end of the window: %v", hold)
	}
	hold, _ := dog.decide(stale, running(testSandboxID), start.Add(testWindow+time.Second))
	if !slices.Equal(hold, []string{testSandboxID}) {
		t.Fatalf("hold = %v, want the unpaid sandbox", hold)
	}
}

func TestWatchdogKeepsAPaidSandboxRunning(t *testing.T) {
	dog := newWatchdog()
	now := testNow()
	dog.decide(nil, running(testSandboxID), now.Add(-time.Hour))
	paid := []state.PaymentChannel{paidChannel(now.Add(-testWindow/2), apiclient.PaymentChannelStateOpen)}
	if hold, release := dog.decide(paid, running(testSandboxID), now); len(hold)+len(release) != 0 {
		t.Fatalf("a paid sandbox changed: hold %v release %v", hold, release)
	}
}

func TestWatchdogNeverHoldsIdleOrClosingSandboxes(t *testing.T) {
	dog := newWatchdog()
	now := testNow()
	unpaid := []state.PaymentChannel{{
		ChannelID: "0x01", SandboxID: testSandboxID, LeaseID: testLeaseID,
		State: apiclient.PaymentChannelStateOpen, HoldWindow: testWindow,
	}}
	if hold, _ := dog.decide(unpaid, running(), now); len(hold) != 0 {
		t.Fatalf("a sandbox that is not running was held: %v", hold)
	}
	dog.decide(nil, running(testSandboxID), now.Add(-time.Hour))
	closing := []state.PaymentChannel{paidChannel(now.Add(-time.Hour), apiclient.PaymentChannelStateClosing)}
	if hold, _ := dog.decide(closing, running(testSandboxID), now); len(hold) != 0 {
		t.Fatalf("a closing channel's sandbox was held; the API stops it: %v", hold)
	}
}

func TestWatchdogReleasesOnlyOnAFreshVoucher(t *testing.T) {
	dog := newWatchdog()
	now := testNow()
	dog.held[testSandboxID] = true
	stale := []state.PaymentChannel{paidChannel(now.Add(-time.Hour), apiclient.PaymentChannelStateOpen)}
	if _, release := dog.decide(stale, running(testSandboxID), now); len(release) != 0 {
		t.Fatalf("seeing a held sandbox running released it: %v", release)
	}
	closed := []state.PaymentChannel{paidChannel(now.Add(-time.Hour), apiclient.PaymentChannelStateClosed)}
	if _, release := dog.decide(closed, running(), now); len(release) != 0 {
		t.Fatalf("a closed channel released its held sandbox: %v", release)
	}
	fresh := []state.PaymentChannel{paidChannel(now, apiclient.PaymentChannelStateOpen)}
	if _, release := dog.decide(fresh, running(), now); !slices.Equal(release, []string{testSandboxID}) {
		t.Fatalf("release = %v, want the paid sandbox", release)
	}
}

func TestWatchdogReleasesSandboxesTheAPINoLongerLists(t *testing.T) {
	dog := newWatchdog()
	dog.held[testSandboxID] = true
	if _, release := dog.decide(nil, running(), testNow()); !slices.Equal(release, []string{testSandboxID}) {
		t.Fatalf("release = %v, want the unlisted sandbox", release)
	}
}
