// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"context"
	"fmt"
	"math/big"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const holdCheckInterval = 5 * time.Second

type holdPolicy struct {
	window   time.Duration
	maxFloat *big.Int
}

type holdCause struct {
	reason apiclient.MachinePaymentHoldReason
	detail string
}

type holdDecision struct {
	sandboxID string
	cause     holdCause
}

type watchdog struct {
	runningSince map[string]time.Time
	held         map[string]bool
}

func newWatchdog() *watchdog {
	return &watchdog{runningSince: make(map[string]time.Time), held: make(map[string]bool)}
}

func (dog *watchdog) decide(
	channels []state.SettlementChannel,
	running map[string]bool,
	policy holdPolicy,
	now time.Time,
) (hold []holdDecision, release []string) {
	dog.trackRunning(running, now)
	bySandbox := meteredSandboxes(channels)
	for sandboxID, sandboxChannels := range bySandbox {
		held := dog.held[sandboxID]
		cause := dog.evaluate(sandboxID, sandboxChannels, held, policy, now)
		switch {
		case held && cause == nil:
			release = append(release, sandboxID)
		case !held && running[sandboxID] && cause != nil:
			hold = append(hold, holdDecision{sandboxID: sandboxID, cause: *cause})
		}
	}
	for sandboxID := range dog.held {
		if _, listed := bySandbox[sandboxID]; !listed {
			release = append(release, sandboxID)
		}
	}
	return hold, release
}

func meteredSandboxes(channels []state.SettlementChannel) map[string][]state.SettlementChannel {
	bySandbox := make(map[string][]state.SettlementChannel)
	for _, channel := range channels {
		for _, sandbox := range channel.Channel.Sandboxes {
			if sandbox.EndedAt == nil {
				bySandbox[sandbox.SandboxId] = append(bySandbox[sandbox.SandboxId], channel)
			}
		}
	}
	return bySandbox
}

func (dog *watchdog) trackRunning(running map[string]bool, now time.Time) {
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
}

func (dog *watchdog) evaluate(
	sandboxID string,
	channels []state.SettlementChannel,
	held bool,
	policy holdPolicy,
	now time.Time,
) *holdCause {
	for _, channel := range channels {
		baseline := coverageBaseline(channel)
		if since := dog.runningSince[sandboxID]; !held && since.After(baseline) {
			baseline = since
		}
		if now.Sub(baseline) > policy.window {
			return &holdCause{
				reason: apiclient.MachinePaymentHoldReasonPaymentWindowLapsed,
				detail: fmt.Sprintf("no voucher covered the channel within the %s payment window", policy.window),
			}
		}
		excess, err := floatExcess(channel.Channel, policy.maxFloat)
		if err != nil {
			return &holdCause{
				reason: apiclient.MachinePaymentHoldReasonFundsUnreadable,
				detail: fmt.Sprintf("the channel's amounts cannot be read: %v", err),
			}
		}
		if excess != nil {
			return excess
		}
	}
	return nil
}

func coverageBaseline(channel state.SettlementChannel) time.Time {
	if channel.AcceptedAt.Before(channel.Channel.CoveredAt) {
		return channel.AcceptedAt
	}
	return channel.Channel.CoveredAt
}

func (service *Service) enforce(ctx context.Context) {
	escrow, channels, err := service.store.LoadSettlement(ctx)
	if err != nil {
		if ctx.Err() == nil {
			service.log.WarnContext(ctx, "Failed to load settlement channels", "error", err)
		}
		return
	}
	if escrow == nil {
		return
	}
	running, err := service.runningSandboxes(ctx)
	if err != nil {
		service.log.WarnContext(ctx, "Failed to inspect runtime inventory for payment holds", "error", err)
		return
	}
	policy := holdPolicy{window: escrow.HoldWindow, maxFloat: service.maxFloat}
	hold, release := service.watchdog.decide(channels, running, policy, time.Now())
	for _, decision := range hold {
		hold := state.PaymentHold{HeldAt: time.Now(), Reason: string(decision.cause.reason), Detail: decision.cause.detail}
		if service.apply(ctx, decision.sandboxID, hold) {
			service.log.WarnContext(ctx, "Holding a sandbox until its customer pays",
				"sandbox_id", decision.sandboxID, "reason", decision.cause.reason, "detail", decision.cause.detail)
		}
	}
	for _, sandboxID := range release {
		if service.apply(ctx, sandboxID, state.PaymentHold{}) {
			service.log.InfoContext(ctx, "Released a sandbox held for payment", "sandbox_id", sandboxID)
		}
	}
}

func (service *Service) runningSandboxes(ctx context.Context) (map[string]bool, error) {
	inventory, err := service.runtime.RuntimeInventory(ctx)
	if err != nil {
		return nil, err
	}
	running := make(map[string]bool, len(inventory))
	for index := range inventory {
		if inventory[index].ControlPlaneManaged && inventory[index].Info.State == microvmtypes.RuntimeStateStarted {
			running[inventory[index].ID] = true
		}
	}
	return running, nil
}

func (service *Service) apply(ctx context.Context, sandboxID string, hold state.PaymentHold) bool {
	held := !hold.HeldAt.IsZero()
	if err := service.store.SetPaymentHold(ctx, sandboxID, hold); err != nil {
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
