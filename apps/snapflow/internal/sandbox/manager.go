// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"context"
	"errors"
	"log/slog"
	"sync/atomic"
	"time"

	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const drainTimeout = time.Minute

type ManagerConfig struct {
	ReportInterval time.Duration
	RequestTimeout time.Duration
}

type ManagerDependencies struct {
	Control       ConvergenceAPI
	Converger     *Converger
	Runtime       sandboxruntime.Sandboxes
	Records       RecordStore
	LocalRuntimes *LocalRuntimes
	Snapshots     Snapshots
	Meter         UsageMeter
	PaymentHolds  *PaymentHolds
}

type Manager struct {
	log            *slog.Logger
	control        ConvergenceAPI
	runtime        sandboxruntime.Sandboxes
	converger      *Converger
	snapshots      Snapshots
	meter          UsageMeter
	records        *records
	activity       *activity
	local          *LocalRuntimes
	holds          *PaymentHolds
	reporter       *statusReporter
	current        atomic.Pointer[machinev1alpha1.MachineDesiredState]
	observedDigest string
	workers        *workerPool
}

func NewManager(cfg ManagerConfig, deps ManagerDependencies, opts ...Option) (*Manager, error) {
	if deps.Control == nil || deps.Converger == nil || deps.Runtime == nil || deps.Records == nil ||
		deps.LocalRuntimes == nil || deps.Snapshots == nil || deps.Meter == nil || deps.PaymentHolds == nil {
		return nil, errors.New("convergence control plane, converger, runtime, records, local runtimes, snapshots, meter and payment holds are required")
	}
	if cfg.ReportInterval <= 0 || cfg.RequestTimeout <= 0 {
		return nil, errors.New("convergence report interval and request timeout must be positive")
	}
	logger := newOptions(opts).logger.With(slog.String("component", "sandbox_convergence"))
	service := &Manager{
		log: logger, control: deps.Control, runtime: deps.Runtime, converger: deps.Converger, snapshots: deps.Snapshots, meter: deps.Meter,
		records: newRecords(deps.Records), activity: newActivity(), local: deps.LocalRuntimes, holds: deps.PaymentHolds,
	}
	service.reporter = &statusReporter{
		log: logger, control: deps.Control, runtime: deps.Runtime, records: service.records,
		activity: service.activity, local: deps.LocalRuntimes, document: service.currentDocument,
		interval: cfg.ReportInterval, timeout: cfg.RequestTimeout, trigger: make(chan struct{}, 1),
	}
	return service, nil
}

func (manager *Manager) Run(ctx context.Context) error {
	if err := manager.records.load(ctx); err != nil {
		return err
	}
	lifecycleContext, stopLifecycle := context.WithCancel(ctx)
	defer stopLifecycle()
	operationContext, cancelOperations := drainingContext(lifecycleContext, drainTimeout)
	defer cancelOperations()
	manager.workers = newWorkerPool(operationContext, manager.synchronize)

	reporterContext, stopReporter := context.WithCancel(context.WithoutCancel(ctx))
	reporterDone := make(chan struct{})
	go func() {
		defer close(reporterDone)
		manager.reporter.run(reporterContext)
	}()

	holdsDone := make(chan struct{})
	go func() {
		defer close(holdsDone)
		manager.followHolds(lifecycleContext)
	}()

	watchErr := manager.watch(lifecycleContext)
	stopLifecycle()
	<-holdsDone
	manager.workers.stop()
	stopReporter()
	<-reporterDone
	finalContext, cancelFinal := context.WithTimeout(context.WithoutCancel(ctx), manager.reporter.timeout)
	defer cancelFinal()
	manager.reporter.reportLogged(finalContext)
	manager.log.InfoContext(ctx, "Sandbox convergence stopped")
	return watchErr
}

// followHolds redispatches the desired state whenever a payment hold changes,
// because a hold alone does not change the document the watch loop waits on.
func (manager *Manager) followHolds(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-manager.holds.changed:
			manager.dispatch(ctx)
		}
	}
}

func drainingContext(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	draining, cancel := context.WithCancel(context.WithoutCancel(ctx))
	stop := context.AfterFunc(ctx, func() {
		time.AfterFunc(timeout, cancel)
	})
	return draining, func() {
		stop()
		cancel()
	}
}

func (manager *Manager) currentDocument() *machinev1alpha1.MachineDesiredState {
	return manager.current.Load()
}
