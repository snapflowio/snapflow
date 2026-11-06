// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"fmt"
	"math/big"
	"strconv"
	"time"

	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/admin"
)

const (
	// usdcDecimals is the number of decimals of the USDC token; voucher
	// amounts are in its base units.
	usdcDecimals  = 6
	decimalBase   = 10
	int64Bits     = 64
	usdcFormatter = "%d.%0*d"
)

func Payout(theme style.Theme, result admin.PayoutResult) string {
	return Lines(
		Header(theme, text.PayoutTitle, result.Profile),
		"",
		Row(theme, text.LabelPayouts, Payouts(theme, result.Readiness)),
		Row(theme, text.LabelPayoutWallet, theme.Secondary.Render(text.PayoutWalletLink)+theme.Link.Render(result.PayoutURL)),
	)
}

func Vouchers(theme style.Theme, result admin.VouchersResult) string {
	lines := []string{Header(theme, text.VouchersTitle, result.Profile), ""}
	if len(result.Vouchers) == 0 {
		return Lines(append(lines, theme.Indent.Render(theme.Muted.Render(text.VouchersNone)))...)
	}
	for _, accepted := range result.Vouchers {
		lines = append(
			lines,
			Row(theme, text.LabelChannel, theme.Value.Render(text.ShortChannel(accepted.ChannelID))+
				theme.Muted.Render(text.DetailSeparator+string(accepted.State))),
			Row(theme, text.LabelSandbox, sandboxPayment(theme, accepted)),
			Row(theme, text.LabelVoucher, voucherSummary(theme, accepted)),
			"",
		)
	}
	return Lines(append(lines, Hint(theme, text.VoucherClaimHint))...)
}

func paymentHolds(theme style.Theme, holds []admin.PaymentHold) string {
	if len(holds) == 0 {
		return theme.Muted.Render(text.PaymentHoldsNone)
	}
	sandboxIDs := make([]string, 0, len(holds))
	for _, hold := range holds {
		sandboxIDs = append(sandboxIDs, hold.SandboxID)
	}
	return theme.Warning.Render(style.SymbolWarn + space + text.PaymentHolds(sandboxIDs))
}

func sandboxPayment(theme style.Theme, accepted admin.PaymentVoucher) string {
	rendered := theme.Value.Render(accepted.SandboxID)
	if accepted.HeldAt != nil {
		rendered += theme.Warning.Render(text.DetailSeparator + text.HeldSince(*accepted.HeldAt))
	}
	return rendered
}

func voucherSummary(theme style.Theme, accepted admin.PaymentVoucher) string {
	if accepted.Voucher == nil {
		return theme.Muted.Render(text.VoucherAwaiting)
	}
	expiry, err := strconv.ParseInt(accepted.Voucher.Expiry, decimalBase, int64Bits)
	if err != nil {
		return theme.Danger.Render(err.Error())
	}
	return theme.Value.Render(text.VoucherSummary(
		accepted.Voucher.Sequence, usdc(accepted.Voucher.HostAmount), time.Unix(expiry, 0),
	))
}

// usdc renders base units as a decimal USDC amount, keeping every digit.
func usdc(baseUnits string) string {
	amount, valid := new(big.Int).SetString(baseUnits, decimalBase)
	if !valid || amount.Sign() < 0 {
		return baseUnits
	}
	whole, fraction := new(big.Int).QuoRem(amount, new(big.Int).Exp(big.NewInt(decimalBase), big.NewInt(usdcDecimals), nil), new(big.Int))
	return fmt.Sprintf(usdcFormatter, whole, usdcDecimals, fraction)
}
