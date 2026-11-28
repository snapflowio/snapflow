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
	"log/slog"
	"math/big"
	"sync/atomic"
	"time"

	"github.com/snapflowio/snapflow/internal/foundation/state"
	sandboxruntime "github.com/snapflowio/snapflow/internal/workloads/runtime"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"golang.org/x/sync/errgroup"
)

const componentName = "settlement"

type Store interface {
	LoadSettlement(context.Context) (*state.SettlementEscrow, []state.SettlementChannel, error)
	ReplaceSettlement(context.Context, state.SettlementEscrow, []state.SettlementChannel) error
	LoadPaymentHolds(context.Context) ([]state.SandboxPaymentHold, error)
	SetPaymentHold(ctx context.Context, sandboxID string, hold state.PaymentHold) error
}

type Holds interface {
	Set(sandboxID string, held bool)
}

type Dependencies struct {
	Control ControlSource
	Store   Store
	Runtime sandboxruntime.Inventory
	Holds   Holds
	HostKey *state.HostKey
}

type Config struct {
	MaxUnclaimedFloat *big.Int
}

type Service struct {
	log            *slog.Logger
	chainOffset    atomic.Int64
	control        ControlSource
	store          Store
	runtime        sandboxruntime.Inventory
	holds          Holds
	host           *state.HostKey
	maxFloat       *big.Int
	accepted       chan struct{}
	watchdog       *watchdog
	observedDigest string
	settling       settleState
}

func New(cfg Config, deps Dependencies, opts ...Option) (*Service, error) {
	if deps.Control == nil || deps.Store == nil || deps.Runtime == nil || deps.Holds == nil || deps.HostKey == nil {
		return nil, errors.New("settlement control source, store, runtime, holds and host key are required")
	}
	if cfg.MaxUnclaimedFloat == nil || cfg.MaxUnclaimedFloat.Sign() <= 0 {
		return nil, errors.New("the maximum unclaimed float must be positive")
	}
	configured := newOptions(opts)
	return &Service{
		log:      configured.logger.With(slog.String("component", componentName)),
		control:  deps.Control,
		store:    deps.Store,
		runtime:  deps.Runtime,
		holds:    deps.Holds,
		host:     deps.HostKey,
		maxFloat: new(big.Int).Set(cfg.MaxUnclaimedFloat),
		accepted: make(chan struct{}, 1),
		watchdog: newWatchdog(),
	}, nil
}

func (service *Service) Restore(ctx context.Context) error {
	holds, err := service.store.LoadPaymentHolds(ctx)
	if err != nil {
		return err
	}
	for _, hold := range holds {
		service.watchdog.held[hold.SandboxID] = true
		service.holds.Set(hold.SandboxID, true)
		service.log.WarnContext(ctx, "Sandbox stays held for payment after restart", "sandbox_id", hold.SandboxID)
	}
	return nil
}

func (service *Service) Run(ctx context.Context) error {
	group, groupContext := errgroup.WithContext(ctx)
	group.Go(func() error { return service.watch(groupContext) })
	group.Go(func() error {
		service.enforceUntilDone(groupContext)
		return nil
	})
	return group.Wait()
}

func (service *Service) enforceUntilDone(ctx context.Context) {
	ticker := time.NewTicker(holdCheckInterval)
	defer ticker.Stop()
	for {
		service.enforce(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-service.accepted:
		}
	}
}

func (service *Service) chainNow() time.Time {
	return time.Now().Add(time.Duration(service.chainOffset.Load()))
}

func (service *Service) observeChainTime(document *apiclient.MachineSettlementDocument) {
	if quote := document.Relayer.Quote; quote != nil {
		service.chainOffset.Store(int64(time.Until(quote.QuotedAt)))
	}
}

func (service *Service) signalAccepted() {
	select {
	case service.accepted <- struct{}{}:
	default:
	}
}
