// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"fmt"
	"math/big"

	"github.com/snapflowio/contracts-go/escrowhash"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

func unclaimedOf(channel apiclient.MachineSettlementChannel) (*big.Int, error) {
	if channel.Voucher == nil {
		return new(big.Int), nil
	}
	cumulative, err := decodeAmount("cumulative amount", channel.Voucher.CumulativeAmount)
	if err != nil {
		return nil, err
	}
	claimed, err := decodeAmount("claimed amount", channel.ClaimedAmount)
	if err != nil {
		return nil, err
	}
	unclaimed := cumulative.Sub(cumulative, claimed)
	if unclaimed.Sign() < 0 {
		return unclaimed.SetInt64(0), nil
	}
	return unclaimed, nil
}

func hostShare(amount *big.Int, feeBps uint16) *big.Int {
	return new(big.Int).Sub(amount, escrowhash.FeeOf(amount, feeBps))
}

func floatExcess(channel apiclient.MachineSettlementChannel, maxFloat *big.Int) (*holdCause, error) {
	unclaimed, err := unclaimedOf(channel)
	if err != nil {
		return nil, err
	}
	if unclaimed.Cmp(maxFloat) <= 0 {
		return nil, nil
	}
	return &holdCause{
		reason: apiclient.MachinePaymentHoldReasonFloatExceeded,
		detail: fmt.Sprintf("unclaimed value %s exceeds the host's maximum float %s", unclaimed, maxFloat),
	}, nil
}
