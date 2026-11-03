// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package snapshot

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/state"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	pullBackoffMinimum = 10 * time.Second
	pullBackoffMaximum = 5 * time.Minute
	pullBackoffFactor  = 2
	pullBackoffJitter  = 0.2
	maximumPercentage  = 100
)

type Runtime interface {
	sandboxruntime.Inventory
	sandboxruntime.Templates
	PullImage(context.Context, string, *machinev1alpha1.Registry) error
	ImageInfo(context.Context, string) (sandboxruntime.ImageInfo, error)
	RemoveImage(context.Context, string) error
}

type RecordStore interface {
	LoadSnapshotRecords(context.Context) ([]state.SnapshotRecord, error)
	SaveSnapshotRecord(context.Context, state.SnapshotRecord) error
	DeleteSnapshotRecord(context.Context, string) error
}

type ControlPlane interface {
	RegistryCredentials(context.Context, string) (*machinev1alpha1.Registry, error)
	ReportInventory(context.Context, *machinev1alpha1.MachineSnapshotInventory) error
}

type DiskUsage func(context.Context) (float64, error)

type GarbageCollectionPolicy struct {
	HighThresholdPercent float64
	LowThresholdPercent  float64
	GracePeriod          time.Duration
	Interval             time.Duration
}

func (policy GarbageCollectionPolicy) validate() error {
	if policy.LowThresholdPercent <= 0 || policy.HighThresholdPercent > maximumPercentage ||
		policy.LowThresholdPercent >= policy.HighThresholdPercent {
		return errors.New("snapshot garbage collection thresholds must satisfy 0 < low < high <= 100")
	}
	if policy.GracePeriod <= 0 || policy.Interval <= 0 {
		return errors.New("snapshot garbage collection grace period and interval must be positive")
	}
	return nil
}

type StoreConfig struct {
	Policy         GarbageCollectionPolicy
	ReportInterval time.Duration
	RequestTimeout time.Duration
}

type StoreDependencies struct {
	Runtime   Runtime
	Records   RecordStore
	Control   ControlPlane
	DiskUsage DiskUsage
}

type Store struct {
	log            *slog.Logger
	runtime        Runtime
	records        RecordStore
	control        ControlPlane
	diskUsage      DiskUsage
	policy         GarbageCollectionPolicy
	pullBackoff    reconnect.Backoff
	reportInterval time.Duration
	requestTimeout time.Duration
	now            func() time.Time
	started        chan struct{}
	wake           chan struct{}
	report         chan struct{}
	background     chan struct{}
	tasks          sync.WaitGroup

	mu       sync.Mutex
	runCtx   context.Context
	desired  map[string]*machinev1alpha1.DesiredSnapshot
	revision uint64
	applied  bool
	pressure bool
	entries  map[string]*entry
	demands  map[string]int
	busy     map[string]*task
}

func defaultPullBackoff() reconnect.Backoff {
	return reconnect.Backoff{
		Minimum: pullBackoffMinimum, Maximum: pullBackoffMaximum,
		Factor: pullBackoffFactor, Jitter: pullBackoffJitter,
	}
}

func NewStore(cfg StoreConfig, deps StoreDependencies, opts ...Option) (*Store, error) {
	if deps.Runtime == nil || deps.Records == nil || deps.Control == nil || deps.DiskUsage == nil {
		return nil, errors.New("snapshot store runtime, records, control plane and disk usage are required")
	}
	if err := cfg.Policy.validate(); err != nil {
		return nil, err
	}
	if cfg.ReportInterval <= 0 || cfg.RequestTimeout <= 0 {
		return nil, errors.New("snapshot inventory report interval and request timeout must be positive")
	}
	configured := newOptions(opts)
	if configured.pullBackoff.Minimum <= 0 || configured.pullBackoff.Maximum < configured.pullBackoff.Minimum {
		return nil, errors.New("snapshot pull backoff must be positive and bounded")
	}
	return &Store{
		log: configured.logger.With(slog.String("component", "snapshot_store")), runtime: deps.Runtime,
		records: deps.Records, control: deps.Control, diskUsage: deps.DiskUsage, policy: cfg.Policy,
		pullBackoff: configured.pullBackoff, reportInterval: cfg.ReportInterval, requestTimeout: cfg.RequestTimeout,
		now: configured.clock, started: make(chan struct{}), wake: make(chan struct{}, 1),
		report: make(chan struct{}, 1), background: make(chan struct{}, 1),
		desired: make(map[string]*machinev1alpha1.DesiredSnapshot), entries: make(map[string]*entry),
		demands: make(map[string]int), busy: make(map[string]*task),
	}, nil
}

func (store *Store) Run(ctx context.Context) error {
	if err := store.load(ctx); err != nil {
		if ctx.Err() != nil {
			return nil
		}
		return err
	}
	store.mu.Lock()
	store.runCtx = ctx
	store.mu.Unlock()
	close(store.started)
	defer store.tasks.Wait()

	collection := time.NewTicker(store.policy.Interval)
	defer collection.Stop()
	reporting := time.NewTicker(store.reportInterval)
	defer reporting.Stop()
	retry := time.NewTimer(store.policy.Interval)
	defer retry.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-store.wake:
		case <-retry.C:
		case <-collection.C:
			store.collectLogged(ctx)
		case <-reporting.C:
			store.reportLogged(ctx)
			continue
		case <-store.report:
			store.reportLogged(ctx)
			continue
		}
		retry.Reset(store.converge(ctx))
	}
}

func (store *Store) load(ctx context.Context) error {
	records, err := store.records.LoadSnapshotRecords(ctx)
	if err != nil {
		return err
	}
	for _, record := range records {
		if _, err := store.runtime.ImageInfo(ctx, record.Ref); err != nil {
			if deleteErr := store.records.DeleteSnapshotRecord(ctx, record.Ref); deleteErr != nil {
				return deleteErr
			}
			store.log.InfoContext(ctx, "Forgot a recorded snapshot whose image is gone", "ref", record.Ref, "error", err)
			continue
		}
		store.entries[record.Ref] = presentEntry(record)
	}
	return nil
}

func (store *Store) awaitStart(ctx context.Context) error {
	select {
	case <-store.started:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (store *Store) signal() {
	select {
	case store.wake <- struct{}{}:
	default:
	}
}

func (store *Store) requestReport() {
	select {
	case store.report <- struct{}{}:
	default:
	}
}
