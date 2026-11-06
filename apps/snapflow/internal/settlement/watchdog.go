// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"context"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const holdCheckInterval = 5 * time.Second

// watchdog decides which sandboxes to hold for payment. A running sandbox
// with an open channel is held once no voucher has been accepted for longer
// than the channel's window (voucher interval x grace intervals), measured
// from the later of the last accepted voucher and the moment this process saw
// the sandbox running, so a sandbox that just started and a daemon that just
// restarted both get a full window. A held sandbox is released only by a
// voucher accepted within the window, or when the API stops listing its
// channels.
type watchdog struct {
	runningSince map[string]time.Time
	held         map[string]bool
}

func newWatchdog() *watchdog {
	return &watchdog{runningSince: make(map[string]time.Time), held: make(map[string]bool)}
}

func (dog *watchdog) decide(
	channels []state.PaymentChannel,
	running map[string]bool,
	now time.Time,
) (hold, release []string) {
	for sandboxID := range running {
		if _, seen := dog.runningSince[sandboxID]; !seen {
			dog.runningSince[sandboxID] = now
		}
	}
	for sandboxID := range dog.runningSince {
		if !running[sandboxID] {
			delete(dog.runningSince, sandboxID)
		}
	}
	bySandbox := make(map[string][]state.PaymentChannel)
	for _, channel := range channels {
		bySandbox[channel.SandboxID] = append(bySandbox[channel.SandboxID], channel)
	}
	for sandboxID, sandboxChannels := range bySandbox {
		held := dog.held[sandboxID]
		open, overdue := dog.overdue(sandboxChannels, held, now)
		switch {
		case held && open && !overdue:
			release = append(release, sandboxID)
		case !held && running[sandboxID] && overdue:
			hold = append(hold, sandboxID)
		}
	}
	for sandboxID := range dog.held {
		if _, listed := bySandbox[sandboxID]; !listed {
			release = append(release, sandboxID)
		}
	}
	return hold, release
}

// overdue reports whether the sandbox has an open channel and whether any of
// them lacks a voucher within its window. A held sandbox is measured from its
// vouchers alone, so seeing it running before the hold took effect never
// releases it.
func (dog *watchdog) overdue(channels []state.PaymentChannel, held bool, now time.Time) (open, overdue bool) {
	for _, channel := range channels {
		if channel.State != apiclient.PaymentChannelStateOpen {
			continue
		}
		open = true
		baseline := channel.AcceptedAt
		if since := dog.runningSince[channel.SandboxID]; !held && since.After(baseline) {
			baseline = since
		}
		if now.Sub(baseline) > channel.HoldWindow {
			overdue = true
		}
	}
	return open, overdue
}

func (service *Service) enforce(ctx context.Context) {
	channels, err := service.store.LoadPaymentChannels(ctx)
	if err != nil {
		service.log.WarnContext(ctx, "Failed to load payment channels", "error", err)
		return
	}
	inventory, err := service.runtime.RuntimeInventory(ctx)
	if err != nil {
		service.log.WarnContext(ctx, "Failed to inspect runtime inventory for payment holds", "error", err)
		return
	}
	running := make(map[string]bool, len(inventory))
	for index := range inventory {
		if inventory[index].ControlPlaneManaged && inventory[index].Info.State == microvmtypes.RuntimeStateStarted {
			running[inventory[index].ID] = true
		}
	}
	now := service.now()
	hold, release := service.watchdog.decide(channels, running, now)
	for _, sandboxID := range hold {
		if service.apply(ctx, sandboxID, now) {
			service.log.WarnContext(ctx, "Holding a sandbox: its customer has not paid within the voucher window",
				"sandbox_id", sandboxID)
		}
	}
	for _, sandboxID := range release {
		if service.apply(ctx, sandboxID, time.Time{}) {
			service.log.InfoContext(ctx, "Released a sandbox held for payment", "sandbox_id", sandboxID)
		}
	}
}

// apply stores a hold (heldAt set) or release (zero heldAt) before handing it
// to convergence, so a restart never forgets a hold that already paused a
// sandbox.
func (service *Service) apply(ctx context.Context, sandboxID string, heldAt time.Time) bool {
	held := !heldAt.IsZero()
	if err := service.store.SetPaymentHold(ctx, sandboxID, heldAt); err != nil {
		service.log.WarnContext(ctx, "Failed to store a payment hold", "sandbox_id", sandboxID, "held", held, "error", err)
		return false
	}
	if held {
		service.watchdog.held[sandboxID] = true
	} else {
		delete(service.watchdog.held, sandboxID)
	}
	service.holds.Set(sandboxID, held)
	return true
}

func heldSandboxes(channels []state.PaymentChannel) map[string]bool {
	held := make(map[string]bool)
	for _, channel := range channels {
		if !channel.HeldAt.IsZero() {
			held[channel.SandboxID] = true
		}
	}
	return held
}
