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
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/snapflowio/contracts-go/escrowhash"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const maximumClockSkew = 2 * time.Minute

var errUnchanged = errors.New("the voucher is already accepted")

type verification struct {
	domain      escrowhash.Domain
	host        common.Address
	channel     apiclient.MachineSettlementChannel
	accepted    *apiclient.MachineSignedVoucher
	claimWindow time.Duration
	now         time.Time
}

func verify(check verification) (signedVoucher, error) {
	if check.channel.Voucher == nil {
		return signedVoucher{}, errors.New("the channel has no signed voucher")
	}
	terms, err := decodeTerms(check.channel)
	if err != nil {
		return signedVoucher{}, err
	}
	if err := verifyTerms(check, terms); err != nil {
		return signedVoucher{}, err
	}
	received, err := decodeSigned(*check.channel.Voucher)
	if err != nil {
		return signedVoucher{}, err
	}
	if !sameTerms(received.voucher, terms) {
		return signedVoucher{}, fmt.Errorf("the voucher does not name the terms of channel %s", check.channel.ChannelId)
	}
	if err := verifySignature(check, terms, received); err != nil {
		return signedVoucher{}, err
	}
	if latest := uint64(check.now.Add(maximumClockSkew).Unix()); received.voucher.Timestamp > latest {
		return signedVoucher{}, fmt.Errorf("the voucher is stamped %d, in the future", received.voucher.Timestamp)
	}
	if check.accepted != nil {
		if err := verifyProgress(*check.accepted, *check.channel.Voucher, received); err != nil {
			return signedVoucher{}, err
		}
	}
	return received, nil
}

func verifyTerms(check verification, terms escrowhash.Voucher) error {
	if terms.Host != check.host {
		return fmt.Errorf("the channel pays host %s, not this machine's host key %s", terms.Host, check.host)
	}
	if terms.Customer == (common.Address{}) {
		return errors.New("the channel names no customer")
	}
	if terms.FeeBps > escrowhash.MaxFeeBps {
		return fmt.Errorf("the channel's fee of %d bps is above the escrow's %d", terms.FeeBps, escrowhash.MaxFeeBps)
	}
	if terms.FeeBps != 0 && terms.FeeReceiver == (common.Address{}) {
		return errors.New("the channel carries a fee without a fee receiver")
	}
	derived, err := escrowhash.ChannelID(check.domain, terms)
	if err != nil {
		return fmt.Errorf("derive the channel id: %w", err)
	}
	listed, err := decodeHash("channel id", check.channel.ChannelId)
	if err != nil {
		return err
	}
	if derived != listed {
		return fmt.Errorf("channel %s does not commit to its terms (derived %s)", listed, derived)
	}
	return nil
}

func sameTerms(voucher, terms escrowhash.Voucher) bool {
	return voucher.Customer == terms.Customer && voucher.Host == terms.Host && voucher.FeeReceiver == terms.FeeReceiver &&
		voucher.FeeBps == terms.FeeBps && voucher.Salt == terms.Salt
}

func verifySignature(check verification, terms escrowhash.Voucher, received signedVoucher) error {
	recovered, err := escrowhash.RecoverVoucherSigner(check.domain, received.voucher, received.signature)
	if err != nil {
		return fmt.Errorf("recover the voucher signer: %w", err)
	}
	if recovered != received.signer {
		return fmt.Errorf("the voucher is signed by %s, not the reported signer %s", recovered, received.signer)
	}
	signer := check.channel.Signer
	if signer == nil || !common.IsHexAddress(signer.SignerAddress) || common.HexToAddress(signer.SignerAddress) != recovered {
		return fmt.Errorf("the API reports no signer state for %s", recovered)
	}
	if signer.CustomerWallet {
		if recovered != terms.Customer {
			return fmt.Errorf("signer %s is reported as the wallet of customer %s", recovered, terms.Customer)
		}
		return nil
	}
	return verifyDelegatedSigner(*signer, received.voucher.Timestamp, check.claimWindow, check.now)
}

func verifyDelegatedSigner(signer apiclient.MachineVoucherSigner, timestamp uint64, claimWindow time.Duration, now time.Time) error {
	if signer.RevokedAt != nil {
		return fmt.Errorf("signer %s was revoked at %s", signer.SignerAddress, signer.RevokedAt.UTC())
	}
	if expiresAt := signer.ExpiresAt; expiresAt != nil {
		if timestamp >= uint64(expiresAt.Unix()) {
			return fmt.Errorf("the voucher is stamped after signer %s expired at %s", signer.SignerAddress, expiresAt.UTC())
		}
		if !now.Before(expiresAt.Add(claimWindow)) {
			return fmt.Errorf("the claim window of expired signer %s has ended", signer.SignerAddress)
		}
	}
	if thawEndsAt := signer.ThawEndsAt; thawEndsAt != nil && !now.Before(*thawEndsAt) {
		return fmt.Errorf("signer %s finished thawing at %s and may be revoked", signer.SignerAddress, thawEndsAt.UTC())
	}
	return nil
}

func verifyProgress(accepted, listed apiclient.MachineSignedVoucher, received signedVoucher) error {
	if listed.Sequence == accepted.Sequence && listed.Signature == accepted.Signature {
		return errUnchanged
	}
	if listed.Sequence <= accepted.Sequence {
		return fmt.Errorf("sequence %d does not follow the accepted sequence %d", listed.Sequence, accepted.Sequence)
	}
	previous, err := decodeSigned(accepted)
	if err != nil {
		return fmt.Errorf("decode the accepted voucher: %w", err)
	}
	if !sameTerms(previous.voucher, received.voucher) {
		return errors.New("the voucher moved to another channel")
	}
	if received.voucher.CumulativeAmount.Cmp(previous.voucher.CumulativeAmount) < 0 {
		return fmt.Errorf("the cumulative amount fell from %s to %s",
			previous.voucher.CumulativeAmount, received.voucher.CumulativeAmount)
	}
	return nil
}
