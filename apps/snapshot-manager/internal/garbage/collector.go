// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package garbage

import (
	"context"
	"errors"
	"time"

	"github.com/distribution/distribution/v3/configuration"
)

type ExclusiveGate interface {
	Lock()
	Unlock()
}

type Collector struct {
	storage  configuration.Storage
	gate     ExclusiveGate
	schedule Schedule
	options  options
}

type report struct {
	blobs      int
	bytes      int64
	layerLinks int
}

func New(storageConfiguration configuration.Storage, gate ExclusiveGate, schedule Schedule, opts ...Option) (*Collector, error) {
	if storageConfiguration.Type() == "" {
		return nil, errors.New("registry garbage collector needs a storage driver")
	}
	if gate == nil {
		return nil, errors.New("registry garbage collector needs the registry write gate")
	}
	if !schedule.Valid() {
		return nil, errors.New("registry garbage collector needs a positive interval and grace period")
	}
	return &Collector{storage: storageConfiguration, gate: gate, schedule: schedule, options: newOptions(opts)}, nil
}

func (collector *Collector) Run(ctx context.Context) error {
	opened, err := openStore(ctx, collector.storage)
	if err != nil {
		return err
	}
	ticker := time.NewTicker(collector.schedule.Interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
		collector.collectAndReport(ctx, opened)
	}
}

func (collector *Collector) collectAndReport(ctx context.Context, opened store) {
	started := time.Now()
	collected, err := collector.collect(ctx, opened, started.Add(-collector.schedule.GracePeriod))
	attributes := []any{
		"blobs_removed", collected.blobs,
		"bytes_freed", collected.bytes,
		"layer_links_removed", collected.layerLinks,
		"duration", time.Since(started),
	}
	if err != nil {
		collector.options.logger.ErrorContext(ctx, "Registry garbage collection failed", append(attributes, "error", err)...)
		return
	}
	collector.options.logger.InfoContext(ctx, "Registry garbage collection finished", attributes...)
}

func (collector *Collector) collect(ctx context.Context, opened store, cutoff time.Time) (report, error) {
	collector.gate.Lock()
	defer collector.gate.Unlock()
	marked, err := mark(ctx, opened, cutoff)
	if err != nil {
		return report{}, err
	}
	links, err := removeLayerLinks(ctx, opened, marked.staleLinks)
	if err != nil {
		return report{layerLinks: links}, err
	}
	blobs, bytes, err := sweepBlobs(ctx, opened, marked.blobs, cutoff)
	return report{blobs: blobs, bytes: bytes, layerLinks: links}, err
}
