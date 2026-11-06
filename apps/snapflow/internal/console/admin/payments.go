// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admin

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type PayoutResult struct {
	Profile   string                    `json:"profile"`
	Readiness apiclient.PayoutReadiness `json:"readiness"`
	PayoutURL string                    `json:"payoutUrl"`
}

// Payout reads whether the machine's organization can be paid, as the
// control plane sees it.
func Payout(ctx context.Context, cfg *config.Config) (PayoutResult, error) {
	identity, err := state.LoadIdentity(ctx, cfg.Machine.StateDirectory)
	if err != nil {
		return PayoutResult{}, err
	}
	machine, err := fetchIdentityStatus(ctx, identity)
	if err != nil {
		return PayoutResult{}, err
	}
	return PayoutResult{
		Profile: string(cfg.Profile.Name), Readiness: machine.Payouts, PayoutURL: cfg.Profile.PayoutURL,
	}, nil
}

// PaymentVoucher is the latest voucher this machine accepted for a channel,
// with its signature and EIP-712 domain, so a host can claim it from its own
// wallet.
type PaymentVoucher struct {
	ChannelID  string                          `json:"channelId"`
	SandboxID  string                          `json:"sandboxId"`
	LeaseID    string                          `json:"leaseId"`
	State      apiclient.PaymentChannelState   `json:"state"`
	Domain     *apiclient.EscrowDomain         `json:"domain"`
	Voucher    *apiclient.MachineSignedVoucher `json:"voucher"`
	AcceptedAt *time.Time                      `json:"acceptedAt,omitempty"`
	HeldAt     *time.Time                      `json:"heldAt,omitempty"`
}

type VouchersResult struct {
	Profile  string           `json:"profile"`
	Vouchers []PaymentVoucher `json:"vouchers"`
}

func Vouchers(ctx context.Context, cfg *config.Config) (VouchersResult, error) {
	channels, err := state.InspectPaymentChannels(ctx, cfg.Machine.StateDirectory)
	if err != nil {
		return VouchersResult{}, fmt.Errorf("read accepted vouchers: %w", err)
	}
	vouchers := make([]PaymentVoucher, 0, len(channels))
	for _, channel := range channels {
		vouchers = append(vouchers, PaymentVoucher{
			ChannelID: channel.ChannelID, SandboxID: channel.SandboxID, LeaseID: channel.LeaseID,
			State: channel.State, Domain: channel.Domain, Voucher: channel.Voucher,
			AcceptedAt: optionalTime(channel.AcceptedAt), HeldAt: optionalTime(channel.HeldAt),
		})
	}
	return VouchersResult{Profile: string(cfg.Profile.Name), Vouchers: vouchers}, nil
}

// PaymentHold is a sandbox this machine paused because its customer stopped
// paying.
type PaymentHold struct {
	SandboxID string    `json:"sandboxId"`
	HeldAt    time.Time `json:"heldAt"`
}

func (result *StatusResult) inspectPaymentHolds(ctx context.Context, cfg *config.Config) {
	if !result.Registration.Registered {
		return
	}
	channels, err := state.InspectPaymentChannels(ctx, cfg.Machine.StateDirectory)
	if err != nil {
		result.fail(fmt.Errorf("read payment holds: %w", err))
		return
	}
	for _, channel := range channels {
		if channel.HeldAt.IsZero() || slices.ContainsFunc(result.PaymentHolds, func(hold PaymentHold) bool {
			return hold.SandboxID == channel.SandboxID
		}) {
			continue
		}
		result.PaymentHolds = append(result.PaymentHolds, PaymentHold{SandboxID: channel.SandboxID, HeldAt: channel.HeldAt})
	}
}

func optionalTime(at time.Time) *time.Time {
	if at.IsZero() {
		return nil
	}
	return &at
}
