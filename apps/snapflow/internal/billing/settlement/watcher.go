// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/contracts-go/escrowhash"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	"github.com/snapflowio/snapflow/internal/network/control"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	documentSchemaVersion       = 5
	documentReadMargin          = 10 * time.Second
	documentReadTimeout         = documentWait + documentReadMargin
	minimumDocumentReadInterval = time.Second
)

type rejectedDocumentError struct {
	cause error
}

func (failure *rejectedDocumentError) Error() string {
	return fmt.Sprintf("reject machine settlement document: %v", failure.cause)
}

func (failure *rejectedDocumentError) Unwrap() error { return failure.cause }

func (service *Service) watch(ctx context.Context) error {
	failures := reconnect.DefaultBackoff()
	for {
		startedAt := time.Now()
		err := service.refresh(ctx)
		if ctx.Err() != nil {
			return nil
		}
		if errors.Is(err, control.ErrMachineRemoved) {
			service.reportUnsettledOnRemoval(ctx)
			return err
		}
		service.settleWhenDue(ctx)
		delay := minimumDocumentReadInterval - time.Since(startedAt)
		var rejected *rejectedDocumentError
		switch {
		case err == nil:
			failures.Reset()
		case errors.As(err, &rejected):
			service.log.WarnContext(ctx, "Rejected machine settlement document; keeping the accepted vouchers", "error", err)
		case apierror.IsPermanent(err):
			return err
		default:
			service.log.WarnContext(ctx, "Machine settlement refresh failed", "error", err)
			delay = failures.Next()
		}
		if !reconnect.Wait(ctx, delay) {
			return nil
		}
	}
}

func (service *Service) refresh(ctx context.Context) error {
	readContext, cancel := context.WithTimeout(ctx, documentReadTimeout)
	defer cancel()
	document, changed, err := service.control.FetchChannels(readContext, service.observedDigest)
	if err != nil || !changed {
		return err
	}
	return service.merge(ctx, document)
}

func (service *Service) merge(ctx context.Context, document *apiclient.MachineSettlementDocument) error {
	escrow, domain, err := service.documentEscrow(document)
	if err != nil {
		service.observedDigest = document.Digest
		return &rejectedDocumentError{cause: err}
	}
	credited, err := decodeAmount("credited amount", document.CreditedAmount)
	if err != nil {
		service.observedDigest = document.Digest
		return &rejectedDocumentError{cause: err}
	}
	service.observeChainTime(document)
	_, stored, err := service.store.LoadSettlement(ctx)
	if err != nil {
		return err
	}
	channels, accepted := service.accept(ctx, document, domain, stored)
	if err := service.store.ReplaceSettlement(ctx, escrow, channels); err != nil {
		return err
	}
	service.observedDigest = document.Digest
	service.settling.credited = credited
	if accepted > 0 {
		service.log.DebugContext(ctx, "Accepted machine vouchers", "accepted", accepted, "channels", len(channels))
		service.signalAccepted()
	}
	return nil
}

func (service *Service) accept(
	ctx context.Context,
	document *apiclient.MachineSettlementDocument,
	domain escrowhash.Domain,
	stored []state.SettlementChannel,
) ([]state.SettlementChannel, int) {
	previous := make(map[string]state.SettlementChannel, len(stored))
	for _, channel := range stored {
		previous[channel.ID()] = channel
	}
	now := service.chainNow()
	claimWindow := time.Duration(document.Windows.ClaimWindowSeconds) * time.Second
	channels := make([]state.SettlementChannel, 0, len(document.Channels))
	accepted := 0
	for _, listed := range document.Channels {
		record, known := previous[listed.PaymentChannelId.String()]
		if known && !sameChannel(record.Channel, listed) {
			service.log.WarnContext(ctx, "Rejected a payment channel that changed its escrow channel or host",
				"payment_channel_id", listed.PaymentChannelId, "channel_id", listed.ChannelId)
			channels = append(channels, record)
			continue
		}
		next := state.SettlementChannel{Channel: listed, AcceptedAt: record.AcceptedAt}
		next.Channel.Voucher, next.Channel.Signer = record.Channel.Voucher, record.Channel.Signer
		if listed.Voucher != nil {
			switch _, err := verify(verification{
				domain: domain, host: service.host.Address(), channel: listed, accepted: record.Channel.Voucher,
				claimWindow: claimWindow, now: now,
			}); {
			case err == nil:
				next.Channel.Voucher, next.Channel.Signer, next.AcceptedAt = listed.Voucher, listed.Signer, time.Now()
				accepted++
			case errors.Is(err, errUnchanged):
				refreshSigner(&next.Channel, listed)
			default:
				refreshSigner(&next.Channel, listed)
				service.log.WarnContext(ctx, "Rejected a payment voucher; keeping the accepted one",
					"payment_channel_id", listed.PaymentChannelId, "error", err)
			}
		}
		channels = append(channels, next)
	}
	return channels, accepted
}

func (service *Service) documentEscrow(
	document *apiclient.MachineSettlementDocument,
) (state.SettlementEscrow, escrowhash.Domain, error) {
	if document.SchemaVersion != documentSchemaVersion {
		return state.SettlementEscrow{}, escrowhash.Domain{}, fmt.Errorf(
			"settlement document schema %d is not supported (want %d)", document.SchemaVersion, documentSchemaVersion,
		)
	}
	window := time.Duration(document.VoucherIntervalSeconds) * time.Second * time.Duration(document.VoucherGraceIntervals)
	if document.VoucherIntervalSeconds <= 0 || window <= 0 {
		return state.SettlementEscrow{}, escrowhash.Domain{}, fmt.Errorf("voucher interval %ds and grace %d leave no payment window",
			document.VoucherIntervalSeconds, document.VoucherGraceIntervals)
	}
	if document.HostAddress != nil && common.HexToAddress(*document.HostAddress) != service.host.Address() {
		return state.SettlementEscrow{}, escrowhash.Domain{}, fmt.Errorf(
			"the document lists host key %s, not this machine's %s", *document.HostAddress, service.host,
		)
	}
	domain, err := decodeDomain(document.Domain)
	if err != nil {
		return state.SettlementEscrow{}, escrowhash.Domain{}, err
	}
	if _, err := decodeAmount("payout minimum", document.PayoutMinimumMicroUsd); err != nil {
		return state.SettlementEscrow{}, escrowhash.Domain{}, err
	}
	return state.SettlementEscrow{
		Domain: document.Domain, Windows: document.Windows, HoldWindow: window,
		PayoutMinimum: document.PayoutMinimumMicroUsd,
	}, domain, nil
}

func decodePayout(value string) (common.Address, error) {
	payout, err := decodeAddress("payout", value)
	if err != nil {
		return common.Address{}, err
	}
	if payout == (common.Address{}) {
		return common.Address{}, errors.New("the payout wallet is the zero address")
	}
	return payout, nil
}

func sameChannel(stored, listed apiclient.MachineSettlementChannel) bool {
	return common.HexToHash(stored.ChannelId) == common.HexToHash(listed.ChannelId) &&
		common.HexToAddress(stored.HostAddress) == common.HexToAddress(listed.HostAddress)
}

func refreshSigner(channel *apiclient.MachineSettlementChannel, listed apiclient.MachineSettlementChannel) {
	if channel.Signer == nil || listed.Signer == nil {
		return
	}
	if common.HexToAddress(channel.Signer.SignerAddress) == common.HexToAddress(listed.Signer.SignerAddress) {
		channel.Signer = listed.Signer
	}
}
