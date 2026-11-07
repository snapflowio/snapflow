// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"bytes"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/snapflowio/contracts-go/escrow"
	"github.com/snapflowio/contracts-go/voucher"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	decimalBase   = 10
	uint64Bits    = 64
	uint256Bits   = 256
	channelIDSize = common.HashLength
)

// errUnchanged reports a voucher the machine already accepted; it is not a
// rejection.
var errUnchanged = errors.New("the voucher is already accepted")

// signedVoucher is a voucher decoded from the API document into the contract
// binding types, ready to hash and compare.
type signedVoucher struct {
	voucher   escrow.Voucher
	signer    common.Address
	signature []byte
}

// verify checks a voucher before the machine accepts it: the signature must
// recover to the reported signer over the escrow's EIP-712 digest, the channel
// must be the one derived from the customer, host and lease, and against the
// previously accepted voucher the sequence must grow, no amount may shrink and
// the host must stay the same (the API does not report the payout address to
// the machine, so the first accepted host is pinned per channel).
//
// The machine has no chain access, so it cannot tell whether the signer is
// still an active session key of the customer; the claim relayer simulates
// every claim and the API checks session keys before accepting signatures.
func verify(
	channel apiclient.MachineVoucherChannel,
	domain apiclient.EscrowDomain,
	previous *apiclient.MachineSignedVoucher,
	now time.Time,
) error {
	if channel.Voucher == nil {
		return errors.New("the channel has no signed voucher")
	}
	escrowDomain, err := decodeDomain(domain)
	if err != nil {
		return err
	}
	received, err := decodeSigned(*channel.Voucher)
	if err != nil {
		return err
	}
	if err := verifyChannel(channel, received.voucher); err != nil {
		return err
	}
	signer, err := voucher.RecoverSigner(escrowDomain, received.voucher, received.signature)
	if err != nil {
		return fmt.Errorf("recover the voucher signer: %w", err)
	}
	if signer != received.signer {
		return fmt.Errorf("the voucher is signed by %s, not the reported signer %s", signer, received.signer)
	}
	if previous != nil {
		accepted, err := decodeSigned(*previous)
		if err != nil {
			return fmt.Errorf("decode the accepted voucher: %w", err)
		}
		if err := verifyProgress(accepted, received); err != nil {
			return err
		}
	}
	if received.voucher.Expiry <= uint64(now.Unix()) {
		return fmt.Errorf("the voucher expired at %d", received.voucher.Expiry)
	}
	return nil
}

func verifyChannel(channel apiclient.MachineVoucherChannel, received escrow.Voucher) error {
	channelID, err := decodeChannelID(channel.ChannelId)
	if err != nil {
		return err
	}
	if common.Hash(received.ChannelId) != channelID {
		return fmt.Errorf("the voucher pays channel %s, not %s", common.Hash(received.ChannelId), channelID)
	}
	derived, err := voucher.ChannelID(received.Customer, received.Host, channel.LeaseId.String())
	if err != nil {
		return fmt.Errorf("derive the channel id: %w", err)
	}
	if derived != channelID {
		return fmt.Errorf("channel %s does not belong to lease %s between %s and %s",
			channelID, channel.LeaseId, received.Customer, received.Host)
	}
	return nil
}

func verifyProgress(accepted, received signedVoucher) error {
	if received.voucher.Sequence == accepted.voucher.Sequence && bytes.Equal(received.signature, accepted.signature) {
		return errUnchanged
	}
	if received.voucher.Sequence <= accepted.voucher.Sequence {
		return fmt.Errorf("sequence %d does not follow the accepted sequence %d",
			received.voucher.Sequence, accepted.voucher.Sequence)
	}
	if received.voucher.Host != accepted.voucher.Host {
		return fmt.Errorf("the voucher pays host %s instead of %s", received.voucher.Host, accepted.voucher.Host)
	}
	if received.voucher.Customer != accepted.voucher.Customer {
		return fmt.Errorf("the voucher is paid by %s instead of %s", received.voucher.Customer, accepted.voucher.Customer)
	}
	amounts := []struct {
		name               string
		received, accepted *big.Int
	}{
		{"host amount", received.voucher.HostAmount, accepted.voucher.HostAmount},
		{"fee amount", received.voucher.FeeAmount, accepted.voucher.FeeAmount},
		{"service amount", received.voucher.ServiceAmount, accepted.voucher.ServiceAmount},
	}
	for _, amount := range amounts {
		if amount.received.Cmp(amount.accepted) < 0 {
			return fmt.Errorf("the %s fell from %s to %s", amount.name, amount.accepted, amount.received)
		}
	}
	return nil
}

func decodeDomain(domain apiclient.EscrowDomain) (voucher.Domain, error) {
	if domain.Name != voucher.DomainName || domain.Version != voucher.DomainVersion {
		return voucher.Domain{}, fmt.Errorf("unexpected escrow domain %s version %s", domain.Name, domain.Version)
	}
	if domain.ChainId <= 0 {
		return voucher.Domain{}, fmt.Errorf("invalid escrow chain id %d", domain.ChainId)
	}
	contract, err := decodeAddress("verifying contract", domain.VerifyingContract)
	if err != nil {
		return voucher.Domain{}, err
	}
	return voucher.Domain{ChainID: big.NewInt(int64(domain.ChainId)), VerifyingContract: contract}, nil
}

func decodeSigned(signed apiclient.MachineSignedVoucher) (signedVoucher, error) {
	channelID, err := decodeChannelID(signed.ChannelId)
	if err != nil {
		return signedVoucher{}, err
	}
	decoded := signedVoucher{voucher: escrow.Voucher{ChannelId: channelID}}
	if decoded.voucher.Customer, err = decodeAddress("customer", signed.Customer); err != nil {
		return signedVoucher{}, err
	}
	if decoded.voucher.Host, err = decodeAddress("host", signed.Host); err != nil {
		return signedVoucher{}, err
	}
	if decoded.signer, err = decodeAddress("signer", signed.Signer); err != nil {
		return signedVoucher{}, err
	}
	if decoded.voucher.HostAmount, err = decodeUint256("host amount", signed.HostAmount); err != nil {
		return signedVoucher{}, err
	}
	if decoded.voucher.FeeAmount, err = decodeUint256("fee amount", signed.FeeAmount); err != nil {
		return signedVoucher{}, err
	}
	if decoded.voucher.ServiceAmount, err = decodeUint256("service amount", signed.ServiceAmount); err != nil {
		return signedVoucher{}, err
	}
	if decoded.voucher.Sequence, err = strconv.ParseUint(signed.Sequence, decimalBase, uint64Bits); err != nil {
		return signedVoucher{}, fmt.Errorf("invalid voucher sequence %q: %w", signed.Sequence, err)
	}
	if decoded.voucher.Expiry, err = strconv.ParseUint(signed.Expiry, decimalBase, uint64Bits); err != nil {
		return signedVoucher{}, fmt.Errorf("invalid voucher expiry %q: %w", signed.Expiry, err)
	}
	if decoded.signature, err = hexutil.Decode(signed.Signature); err != nil {
		return signedVoucher{}, fmt.Errorf("invalid voucher signature encoding: %w", err)
	}
	return decoded, nil
}

func decodeChannelID(value string) (common.Hash, error) {
	decoded, err := hexutil.Decode(value)
	if err != nil || len(decoded) != channelIDSize {
		return common.Hash{}, fmt.Errorf("invalid channel id %q", value)
	}
	return common.BytesToHash(decoded), nil
}

func decodeAddress(name, value string) (common.Address, error) {
	if !common.IsHexAddress(value) {
		return common.Address{}, fmt.Errorf("invalid %s address %q", name, value)
	}
	return common.HexToAddress(value), nil
}

func decodeUint256(name, value string) (*big.Int, error) {
	amount, valid := new(big.Int).SetString(value, decimalBase)
	if !valid || amount.Sign() < 0 || amount.BitLen() > uint256Bits {
		return nil, fmt.Errorf("invalid voucher %s %q", name, value)
	}
	return amount, nil
}
