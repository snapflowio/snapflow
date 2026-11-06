// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

import (
	"fmt"
	"strings"
	"time"
)

const (
	CommandVouchersJSON = "sudo snapflow vouchers --json"

	PayoutTitle        = "Payouts"
	VouchersTitle      = "Accepted vouchers"
	LabelPayoutWallet  = "Payout wallet"
	LabelPaymentHolds  = "Payment holds"
	LabelSandbox       = "Sandbox"
	LabelVoucher       = "Voucher"
	PayoutWalletLink   = "link or change it in the dashboard · "
	PaymentHoldsNone   = "none"
	VouchersNone       = "No payment channels yet; vouchers appear once a paying customer runs a sandbox here"
	VoucherAwaiting    = "awaiting the first signed voucher"
	VoucherClaimHint   = "export the signed vouchers with `" + CommandVouchersJSON + "` to claim them from your own wallet"
	UnitUSDC           = "USDC"
	voucherTimeLayout  = "2006-01-02 15:04 UTC"
	channelPrefixRunes = 6
	channelSuffixRunes = 4
	channelEllipsis    = "…"
)

func HelpPayout() Help {
	return Help{
		Use:   "payout",
		Short: "Show whether this machine's earnings can be paid out, and where to link a wallet",
		Long: `Payout shows whether the organization that owns this machine has a verified,
	sanctions-clear payout wallet that customers' signed USDC vouchers pay. Link or
	change the wallet in the dashboard by signing in with it; this machine never
	holds a wallet key. It exits non-zero until payouts are ready.`,
		Example: `  sudo snapflow payout
	  sudo snapflow payout --json | jq .readiness`,
	}
}

func HelpVouchers() Help {
	return Help{
		Use:   "vouchers",
		Short: "List the latest signed payment vouchers this machine accepted",
		Long: `Vouchers lists, for every sandbox a customer pays for on this machine, the
	latest voucher it verified: the channel, sequence, your cumulative share in
	USDC and when the voucher expires. Snapflow claims vouchers for you; --json
	exports them with their signatures and EIP-712 domain so you can also claim
	them from your own wallet.`,
		Example: `  sudo snapflow vouchers
	  sudo snapflow vouchers --json > vouchers.json`,
	}
}

func PaymentHolds(sandboxIDs []string) string {
	return fmt.Sprintf("%d paused until their customers pay: %s", len(sandboxIDs), strings.Join(sandboxIDs, ListSeparator))
}

func HeldSince(at time.Time) string {
	return "held for payment since " + at.UTC().Format(voucherTimeLayout)
}

func VoucherSummary(sequence, hostAmount string, expiresAt time.Time) string {
	return fmt.Sprintf("#%s · %s %s to you · expires %s", sequence, hostAmount, UnitUSDC, expiresAt.UTC().Format(voucherTimeLayout))
}

// ShortChannel keeps the start and end of a 32-byte channel id, enough to
// tell channels apart in a terminal; --json carries the full id.
func ShortChannel(channelID string) string {
	runes := []rune(channelID)
	if len(runes) <= channelPrefixRunes+channelSuffixRunes {
		return channelID
	}
	return string(runes[:channelPrefixRunes]) + channelEllipsis + string(runes[len(runes)-channelSuffixRunes:])
}
