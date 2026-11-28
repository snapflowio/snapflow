// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"errors"
	"fmt"
	"math/big"
	"slices"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/snapflowio/contracts-go/escrowhash"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	signerExpiryMargin     = 6 * time.Hour
	withdrawalUnlockMargin = 2 * time.Hour
	signerCapCooldown      = time.Hour
)

type settleReason string

const (
	reasonPayoutMinimum      settleReason = "the pending earnings reached the payout minimum"
	reasonFloatExceeded      settleReason = "a channel exceeds the maximum unclaimed float"
	reasonSignerCap          settleReason = "a customer's signer reached its spending cap"
	reasonSignerExpiry       settleReason = "a signer's vouchers near the end of their claim window"
	reasonCustomerWithdrawal settleReason = "a customer's withdrawal unlocks soon"
	reasonDraining           settleReason = "the machine is draining"
	reasonRemoved            settleReason = "the machine was removed"
)

type claimable struct {
	channel      state.SettlementChannel
	channelID    common.Hash
	voucher      signedVoucher
	unclaimed    *big.Int
	earned       *big.Int
	signerCapped bool
	dueAt        time.Time
	dueReason    settleReason
}

type settleTerms struct {
	payoutMinimum    *big.Int
	credited         *big.Int
	maxFloat         *big.Int
	signerCapReadyAt time.Time
	everything       settleReason
}

type settlePlan struct {
	reason   settleReason
	urgent   bool
	forced   bool
	credited *big.Int
	channels []claimable
}

func (plan settlePlan) withdrawable() *big.Int {
	total := new(big.Int)
	if plan.credited != nil {
		total.Set(plan.credited)
	}
	for _, candidate := range plan.channels {
		total.Add(total, candidate.earned)
	}
	return total
}

func claimableChannels(channels []state.SettlementChannel, claimWindow time.Duration) ([]claimable, error) {
	candidates := []claimable{}
	var failures []error
	for _, channel := range channels {
		candidate, found, err := claimableOf(channel, claimWindow)
		if err != nil {
			failures = append(failures, fmt.Errorf("payment channel %s: %w", channel.ID(), err))
			continue
		}
		if found {
			candidates = append(candidates, candidate)
		}
	}
	return candidates, errors.Join(failures...)
}

func claimableOf(channel state.SettlementChannel, claimWindow time.Duration) (claimable, bool, error) {
	if channel.Channel.Voucher == nil {
		return claimable{}, false, nil
	}
	unclaimed, err := unclaimedOf(channel.Channel)
	if err != nil || unclaimed.Sign() == 0 {
		return claimable{}, false, err
	}
	voucher, err := decodeSigned(*channel.Channel.Voucher)
	if err != nil {
		return claimable{}, false, err
	}
	channelID, err := decodeHash("channel id", channel.Channel.ChannelId)
	if err != nil {
		return claimable{}, false, err
	}
	limit := channel.Channel.VoucherLimit
	candidate := claimable{
		channel: channel, channelID: channelID, voucher: voucher,
		unclaimed: unclaimed, earned: hostShare(unclaimed, voucher.voucher.FeeBps),
		signerCapped: limit != nil && *limit == apiclient.VoucherLimitSignerCap,
	}
	if err := candidate.setDeadline(claimWindow); err != nil {
		return claimable{}, false, err
	}
	return candidate, true, nil
}

func (candidate *claimable) setDeadline(claimWindow time.Duration) error {
	listed := candidate.channel.Channel
	if signer := listed.Signer; signer != nil && !signer.CustomerWallet {
		if signer.ExpiresAt != nil {
			candidate.consider(signer.ExpiresAt.Add(claimWindow-signerExpiryMargin), reasonSignerExpiry)
		}
		if signer.ThawEndsAt != nil {
			candidate.consider(signer.ThawEndsAt.Add(-signerExpiryMargin), reasonSignerExpiry)
		}
	}
	if listed.CustomerWithdrawalUnlockAt == nil {
		return nil
	}
	pending, err := decodeAmount("customer pending amount", listed.CustomerPendingAmount)
	if err != nil {
		return err
	}
	if pending.Sign() > 0 {
		candidate.consider(listed.CustomerWithdrawalUnlockAt.Add(-withdrawalUnlockMargin), reasonCustomerWithdrawal)
	}
	return nil
}

func (candidate *claimable) consider(dueAt time.Time, reason settleReason) {
	if candidate.dueAt.IsZero() || dueAt.Before(candidate.dueAt) {
		candidate.dueAt, candidate.dueReason = dueAt, reason
	}
}

func planSettlement(candidates []claimable, terms settleTerms, now time.Time) (settlePlan, bool) {
	if len(candidates) == 0 && terms.credited.Sign() == 0 {
		return settlePlan{}, false
	}
	ordered := slices.Clone(candidates)
	slices.SortStableFunc(ordered, compareUrgency)
	plan := settlePlan{credited: terms.credited, channels: ordered[:min(len(ordered), escrowhash.MaxBatchSize)]}
	total := new(big.Int).Set(terms.credited)
	floatExceeded, signerCapped := false, false
	for _, candidate := range ordered {
		total.Add(total, candidate.earned)
		floatExceeded = floatExceeded || candidate.unclaimed.Cmp(terms.maxFloat) > 0
		signerCapped = signerCapped || candidate.signerCapped
	}
	switch {
	case terms.everything != "":
		plan.reason, plan.urgent, plan.forced = terms.everything, true, true
	case len(ordered) > 0 && !ordered[0].dueAt.IsZero() && !now.Before(ordered[0].dueAt):
		plan.reason, plan.urgent = ordered[0].dueReason, true
	case floatExceeded:
		plan.reason = reasonFloatExceeded
	case signerCapped && !now.Before(terms.signerCapReadyAt):
		plan.reason, plan.forced = reasonSignerCap, true
	case total.Cmp(terms.payoutMinimum) >= 0:
		plan.reason = reasonPayoutMinimum
	default:
		return settlePlan{}, false
	}
	return plan, true
}

func (plan settlePlan) economic(fee, payoutMinimum *big.Int) (*big.Int, bool) {
	net := new(big.Int).Sub(plan.withdrawable(), fee)
	if net.Sign() <= 0 {
		return net, false
	}
	return net, plan.forced || net.Cmp(payoutMinimum) >= 0
}

func compareUrgency(left, right claimable) int {
	switch {
	case left.dueAt.IsZero() != right.dueAt.IsZero():
		if left.dueAt.IsZero() {
			return 1
		}
		return -1
	case !left.dueAt.Equal(right.dueAt):
		return left.dueAt.Compare(right.dueAt)
	case left.signerCapped != right.signerCapped:
		if left.signerCapped {
			return -1
		}
		return 1
	}
	return right.earned.Cmp(left.earned)
}
