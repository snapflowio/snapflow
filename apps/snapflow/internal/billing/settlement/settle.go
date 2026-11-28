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
	"math/big"
	"time"

	"github.com/snapflowio/snapflow/internal/foundation/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	settleInterval       = time.Minute
	settleRetryInterval  = 5 * time.Minute
	settleRequestTimeout = 30 * time.Second
)

type settleState struct {
	nextAt           time.Time
	signerCapReadyAt time.Time
	credited         *big.Int
}

func (service *Service) settleWhenDue(ctx context.Context) {
	now := time.Now()
	if now.Before(service.settling.nextAt) {
		return
	}
	service.settling.nextAt = now.Add(settleInterval)
	escrow, candidates := service.loadCandidates(ctx)
	if escrow == nil {
		return
	}
	everything := service.drainReason(ctx)
	plan, due := service.plan(ctx, *escrow, candidates, everything)
	if !due {
		return
	}
	err := service.settleThroughAPI(ctx, everything)
	switch {
	case err == nil:
		return
	case errors.Is(err, errUneconomic) && plan.urgent:
		service.log.InfoContext(ctx, "Carrying the earnings over; Snapflow claims the vouchers near their deadline into this host's escrow balance",
			"reason", plan.reason, "detail", err)
		return
	case errors.Is(err, errUneconomic):
		service.log.DebugContext(ctx, "Carrying the earnings over to a later payout", "reason", plan.reason, "detail", err)
		return
	}
	service.settling.nextAt = now.Add(settleRetryInterval)
	if plan.urgent {
		service.log.ErrorContext(ctx, "Failed to hand vouchers near their claim deadline to Snapflow's relayer; Snapflow claims them into this host's escrow balance before the deadline",
			"reason", plan.reason, "error", err)
		return
	}
	service.log.WarnContext(ctx, "Failed to settle through Snapflow's relayer; retrying later", "reason", plan.reason, "error", err)
}

func (service *Service) reportUnsettledOnRemoval(ctx context.Context) {
	_, candidates := service.loadCandidates(ctx)
	if len(candidates) == 0 {
		return
	}
	service.log.WarnContext(ctx, "This machine was removed with unsettled vouchers; Snapflow claims them into the host's escrow balance before their deadlines",
		"channels", len(candidates))
}

func (service *Service) settleThroughAPI(ctx context.Context, everything settleReason) error {
	requestContext, cancel := context.WithTimeout(ctx, settleRequestTimeout)
	defer cancel()
	document, _, err := service.control.FetchChannels(requestContext, "")
	if err != nil {
		return fmt.Errorf("read the settlement document: %w", err)
	}
	if err := service.merge(ctx, document); err != nil {
		return err
	}
	if latest := document.LatestSettlement; latest != nil && inFlight(latest.Status) {
		service.log.DebugContext(ctx, "A settlement is still in flight", "settlement_id", latest.Id, "status", latest.Status)
		return nil
	}
	escrow, candidates := service.loadCandidates(ctx)
	if escrow == nil {
		return nil
	}
	plan, due := service.plan(ctx, *escrow, candidates, everything)
	if !due {
		return nil
	}
	domain, err := decodeDomain(escrow.Domain)
	if err != nil {
		return err
	}
	minimum, err := decodeAmount("payout minimum", escrow.PayoutMinimum)
	if err != nil {
		return err
	}
	request, err := relayRequest(document, domain, service.host, plan, minimum)
	if err != nil {
		return fmt.Errorf("prepare the settlement: %w", err)
	}
	settlement, err := service.control.Settle(requestContext, request)
	if err != nil {
		return err
	}
	if plan.reason == reasonSignerCap {
		service.settling.signerCapReadyAt = service.chainNow().Add(signerCapCooldown)
	}
	service.log.InfoContext(ctx, "Handed a settlement to Snapflow's relayer", "settlement_id", settlement.Id,
		"reason", plan.reason, "channels", len(request.ChannelIds), "relay_fee", request.RelayFee, "payout", request.PayoutAddress)
	return nil
}

func inFlight(status apiclient.HostSettlementStatus) bool {
	return status == apiclient.HostSettlementStatusQueued || status == apiclient.HostSettlementStatusSent
}

func (service *Service) loadCandidates(ctx context.Context) (*state.SettlementEscrow, []claimable) {
	escrow, channels, err := service.store.LoadSettlement(ctx)
	if err != nil {
		if ctx.Err() == nil {
			service.log.WarnContext(ctx, "Failed to load settlement channels", "error", err)
		}
		return nil, nil
	}
	if escrow == nil {
		return nil, nil
	}
	claimWindow := time.Duration(escrow.Windows.ClaimWindowSeconds) * time.Second
	candidates, err := claimableChannels(channels, claimWindow)
	if err != nil {
		service.log.WarnContext(ctx, "Some payment channels cannot be settled", "error", err)
	}
	return escrow, candidates
}

func (service *Service) plan(
	ctx context.Context,
	escrow state.SettlementEscrow,
	candidates []claimable,
	everything settleReason,
) (settlePlan, bool) {
	minimum, err := decodeAmount("payout minimum", escrow.PayoutMinimum)
	if err != nil {
		service.log.WarnContext(ctx, "Cannot plan a settlement: the stored payout minimum is invalid", "error", err)
		return settlePlan{}, false
	}
	credited := new(big.Int)
	if service.settling.credited != nil {
		credited.Set(service.settling.credited)
	}
	terms := settleTerms{
		payoutMinimum: minimum, credited: credited, maxFloat: service.maxFloat,
		signerCapReadyAt: service.settling.signerCapReadyAt, everything: everything,
	}
	return planSettlement(candidates, terms, service.chainNow())
}

func (service *Service) drainReason(ctx context.Context) settleReason {
	requestContext, cancel := context.WithTimeout(ctx, settleRequestTimeout)
	defer cancel()
	draining, err := service.control.Draining(requestContext)
	if err != nil {
		service.log.WarnContext(ctx, "Failed to check whether the machine is draining", "error", err)
		return ""
	}
	if draining {
		return reasonDraining
	}
	return ""
}
