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

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	voucherReadTimeout         = voucherWait + 10*time.Second
	minimumVoucherReadInterval = time.Second
)

type rejectedDocumentError struct {
	cause error
}

func (failure *rejectedDocumentError) Error() string {
	return fmt.Sprintf("reject machine voucher document: %v", failure.cause)
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
		delay := minimumVoucherReadInterval - time.Since(startedAt)
		var rejected *rejectedDocumentError
		switch {
		case err == nil:
			failures.Reset()
		case errors.As(err, &rejected):
			service.log.WarnContext(ctx, "Rejected machine voucher document; keeping the accepted vouchers", "error", err)
		case apierror.IsPermanent(err):
			return err
		default:
			service.log.WarnContext(ctx, "Machine voucher refresh failed", "error", err)
			delay = failures.Next()
		}
		if !reconnect.Wait(ctx, delay) {
			return nil
		}
	}
}

func (service *Service) refresh(ctx context.Context) error {
	readContext, cancel := context.WithTimeout(ctx, voucherReadTimeout)
	defer cancel()
	document, changed, err := service.control.FetchVouchers(readContext, service.observedDigest)
	if err != nil || !changed {
		return err
	}
	stored, err := service.store.LoadPaymentChannels(ctx)
	if err != nil {
		return err
	}
	channels, accepted, err := service.accept(ctx, document, stored)
	if err != nil {
		service.observedDigest = document.Digest
		return &rejectedDocumentError{cause: err}
	}
	// The digest is remembered only once the document is stored, so a failed
	// write is fetched and merged again instead of being skipped as unchanged.
	if err := service.store.ReplacePaymentChannels(ctx, channels); err != nil {
		return err
	}
	service.observedDigest = document.Digest
	if accepted > 0 {
		service.log.DebugContext(ctx, "Accepted machine vouchers", "accepted", accepted, "channels", len(channels))
		service.signalAccepted()
	}
	return nil
}

// accept merges the document into the stored channels: a voucher that fails
// verification is logged and the previously accepted one is kept.
func (service *Service) accept(
	ctx context.Context,
	document *apiclient.MachineVoucherRelay,
	stored []state.PaymentChannel,
) ([]state.PaymentChannel, int, error) {
	window := time.Duration(document.VoucherIntervalSeconds) * time.Duration(document.VoucherGraceIntervals) * time.Second
	if window <= 0 {
		return nil, 0, fmt.Errorf("voucher interval %ds and grace %d leave no payment window",
			document.VoucherIntervalSeconds, document.VoucherGraceIntervals)
	}
	previous := make(map[string]state.PaymentChannel, len(stored))
	for _, channel := range stored {
		previous[channel.ChannelID] = channel
	}
	now := service.now()
	channels := make([]state.PaymentChannel, 0, len(document.Channels))
	accepted := 0
	for _, listed := range document.Channels {
		channel, known := previous[listed.ChannelId]
		if known && (channel.SandboxID != listed.SandboxId || channel.LeaseID != listed.LeaseId.String()) {
			service.log.WarnContext(ctx, "Rejected a payment channel that moved to another sandbox or lease",
				"channel_id", listed.ChannelId, "sandbox_id", listed.SandboxId)
			channels = append(channels, channel)
			continue
		}
		if !known {
			channel = state.PaymentChannel{ChannelID: listed.ChannelId, SandboxID: listed.SandboxId, LeaseID: listed.LeaseId.String()}
		}
		channel.State, channel.HoldWindow = listed.State, window
		if listed.Voucher != nil {
			switch err := verify(listed, document.Domain, channel.Voucher, now); {
			case err == nil:
				domain := document.Domain
				channel.Voucher, channel.Domain, channel.AcceptedAt = listed.Voucher, &domain, now
				accepted++
			case errors.Is(err, errUnchanged):
			default:
				service.log.WarnContext(ctx, "Rejected a payment voucher; keeping the accepted one",
					"channel_id", listed.ChannelId, "sandbox_id", listed.SandboxId, "error", err)
			}
		}
		channels = append(channels, channel)
	}
	return channels, accepted, nil
}
