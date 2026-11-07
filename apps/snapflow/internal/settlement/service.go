// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

// Package settlement keeps the latest verified payment voucher of every
// sandbox this machine hosts for a customer and holds a sandbox whose customer
// stopped paying. The API stays the authoritative enforcer; this is the host's
// own protection when the API is unreachable or a customer stops signing.
package settlement

import (
	"context"
	"errors"
	"log/slog"
	"time"

	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/state"
)

const componentName = "settlement"

type Store interface {
	LoadPaymentChannels(context.Context) ([]state.PaymentChannel, error)
	ReplacePaymentChannels(context.Context, []state.PaymentChannel) error
	SetPaymentHold(ctx context.Context, sandboxID string, heldAt time.Time) error
}

// Holds receives the watchdog's decisions; sandbox.PaymentHolds applies them
// through convergence.
type Holds interface {
	Set(sandboxID string, held bool)
}

type Dependencies struct {
	Control VoucherSource
	Store   Store
	Runtime sandboxruntime.Inventory
	Holds   Holds
}

type Service struct {
	log            *slog.Logger
	now            func() time.Time
	control        VoucherSource
	store          Store
	runtime        sandboxruntime.Inventory
	holds          Holds
	observedDigest string
	accepted       chan struct{}
	watchdog       *watchdog
}

func New(deps Dependencies, opts ...Option) (*Service, error) {
	if deps.Control == nil || deps.Store == nil || deps.Runtime == nil || deps.Holds == nil {
		return nil, errors.New("settlement voucher source, store, runtime and holds are required")
	}
	configured := newOptions(opts)
	return &Service{
		log:      configured.logger.With(slog.String("component", componentName)),
		now:      configured.clock,
		control:  deps.Control,
		store:    deps.Store,
		runtime:  deps.Runtime,
		holds:    deps.Holds,
		accepted: make(chan struct{}, 1),
		watchdog: newWatchdog(),
	}, nil
}

// Restore reapplies the holds stored before a restart. The daemon calls it
// before convergence starts so a held sandbox is never resumed in between.
func (service *Service) Restore(ctx context.Context) error {
	channels, err := service.store.LoadPaymentChannels(ctx)
	if err != nil {
		return err
	}
	for sandboxID := range heldSandboxes(channels) {
		service.watchdog.held[sandboxID] = true
		service.holds.Set(sandboxID, true)
		service.log.WarnContext(ctx, "Sandbox stays held for payment after restart", "sandbox_id", sandboxID)
	}
	return nil
}

// Run watches vouchers and enforces holds until ctx ends; it fails only when
// the API permanently refuses the voucher document.
func (service *Service) Run(ctx context.Context) error {
	watchContext, stopWatching := context.WithCancel(ctx)
	watchFailure := make(chan error, 1)
	watchDone := make(chan struct{})
	go func() {
		defer close(watchDone)
		if err := service.watch(watchContext); err != nil {
			watchFailure <- err
		}
	}()
	defer func() {
		stopWatching()
		<-watchDone
	}()
	ticker := time.NewTicker(holdCheckInterval)
	defer ticker.Stop()
	for {
		service.enforce(ctx)
		select {
		case <-ctx.Done():
			return nil
		case err := <-watchFailure:
			return err
		case <-ticker.C:
		case <-service.accepted:
		}
	}
}

func (service *Service) signalAccepted() {
	select {
	case service.accepted <- struct{}{}:
	default:
	}
}
