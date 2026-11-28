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
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/snapflowio/contracts-go/escrowhash"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	minimumSignatureLifetime = 2 * time.Minute
	maximumSignatureLifetime = 24 * time.Hour
)

var (
	errNoPayoutWallet  = errors.New("the organization has no payout wallet to settle to")
	errNoRelayFeeQuote = errors.New("the API has no relay fee quote while its chain is unreachable")
	errUneconomic      = errors.New("the payout after its relay fee is below the payout minimum; the earnings carry over")
)

func relayRequest(
	document *apiclient.MachineSettlementDocument,
	domain escrowhash.Domain,
	host *state.HostKey,
	plan settlePlan,
	payoutMinimum *big.Int,
) (apiclient.SettleMachineChannels, error) {
	if document.PayoutAddress == nil {
		return apiclient.SettleMachineChannels{}, errNoPayoutWallet
	}
	payout, err := decodePayout(*document.PayoutAddress)
	if err != nil {
		return apiclient.SettleMachineChannels{}, err
	}
	relayer, terms, err := relayTerms(document.Relayer)
	if err != nil {
		return apiclient.SettleMachineChannels{}, err
	}
	channels := plan.channels[:min(len(plan.channels), terms.batchSize)]
	fee := terms.fee(len(channels))
	batch := settlePlan{forced: plan.forced, credited: plan.credited, channels: channels}
	if net, ok := batch.economic(fee, payoutMinimum); !ok {
		return apiclient.SettleMachineChannels{}, fmt.Errorf("%w: withdrawable %s, relay fee %s, net %s, minimum %s",
			errUneconomic, batch.withdrawable(), fee, net, payoutMinimum)
	}
	withdrawal := escrowhash.HostWithdrawal{
		Host: host.Address(), Payout: payout, Relayer: relayer, RelayFee: fee, Nonce: terms.nonce, Deadline: terms.deadline,
	}
	signature, err := signHostWithdrawal(domain, host, withdrawal)
	if err != nil {
		return apiclient.SettleMachineChannels{}, err
	}
	channelIDs := make([]string, 0, len(channels))
	for _, candidate := range channels {
		channelIDs = append(channelIDs, candidate.channelID.Hex())
	}
	return apiclient.SettleMachineChannels{
		ChannelIds: channelIDs, PayoutAddress: payout.Hex(), RelayFee: fee.String(),
		Nonce: terms.nonce.String(), Deadline: terms.deadline.String(), Signature: hexutil.Encode(signature),
	}, nil
}

type relayQuote struct {
	batchSize int
	base      *big.Int
	perClaim  *big.Int
	maximum   *big.Int
	nonce     *big.Int
	deadline  *big.Int
}

func relayTerms(relayer apiclient.MachineSettlementRelayer) (common.Address, relayQuote, error) {
	address, err := decodeAddress("relayer", relayer.Address)
	if err != nil {
		return common.Address{}, relayQuote{}, err
	}
	if address == (common.Address{}) {
		return common.Address{}, relayQuote{}, errors.New("the document names no relayer")
	}
	if relayer.Quote == nil {
		return common.Address{}, relayQuote{}, errNoRelayFeeQuote
	}
	lifetime := time.Duration(relayer.SignatureLifetimeSeconds) * time.Second
	if lifetime <= minimumSignatureLifetime || lifetime > maximumSignatureLifetime {
		return common.Address{}, relayQuote{}, fmt.Errorf("invalid signature lifetime %ds; it must exceed %s and be at most %s",
			relayer.SignatureLifetimeSeconds, minimumSignatureLifetime, maximumSignatureLifetime)
	}
	terms := relayQuote{
		batchSize: min(relayer.MaxBatchSize, escrowhash.MaxBatchSize),
		deadline:  big.NewInt(relayer.Quote.QuotedAt.Add(lifetime).Unix()),
	}
	if terms.batchSize < 1 {
		return common.Address{}, relayQuote{}, fmt.Errorf("invalid relayer batch size %d", relayer.MaxBatchSize)
	}
	quote := relayer.Quote
	if terms.base, err = decodeAmount("base relay fee", quote.BaseMicroUsd); err != nil {
		return common.Address{}, relayQuote{}, err
	}
	if terms.perClaim, err = decodeAmount("per-claim relay fee", quote.PerClaimMicroUsd); err != nil {
		return common.Address{}, relayQuote{}, err
	}
	if terms.maximum, err = decodeAmount("maximum relay fee", quote.MaximumMicroUsd); err != nil {
		return common.Address{}, relayQuote{}, err
	}
	if terms.nonce, err = decodeUint("host withdrawal nonce", quote.HostWithdrawalNonce, uint256Bits); err != nil {
		return common.Address{}, relayQuote{}, err
	}
	return address, terms, nil
}

func (quote relayQuote) fee(claims int) *big.Int {
	fee := new(big.Int).Mul(quote.perClaim, big.NewInt(int64(claims)))
	fee.Add(fee, quote.base)
	ceiling := big.NewInt(escrowhash.MaxRelayFee)
	if quote.maximum.Cmp(ceiling) < 0 {
		ceiling = quote.maximum
	}
	if fee.Cmp(ceiling) > 0 {
		return new(big.Int).Set(ceiling)
	}
	return fee
}

func signHostWithdrawal(domain escrowhash.Domain, host *state.HostKey, withdrawal escrowhash.HostWithdrawal) ([]byte, error) {
	digest, err := escrowhash.HostWithdrawalDigest(domain, withdrawal)
	if err != nil {
		return nil, fmt.Errorf("digest the host withdrawal: %w", err)
	}
	return host.SignDigest(digest)
}
