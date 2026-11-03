// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package buildcache

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/distribution/distribution/v3"
	"github.com/distribution/distribution/v3/configuration"
	"github.com/distribution/distribution/v3/registry/storage"
	storagedriver "github.com/distribution/distribution/v3/registry/storage/driver"
	"github.com/distribution/distribution/v3/registry/storage/driver/factory"
)

type ExclusiveGate interface {
	Lock()
	Unlock()
}

type Janitor struct {
	storage configuration.Storage
	gate    ExclusiveGate
	options options
}

type store struct {
	driver   storagedriver.StorageDriver
	registry distribution.Namespace
}

func New(storageConfiguration configuration.Storage, gate ExclusiveGate, opts ...Option) (*Janitor, error) {
	if storageConfiguration.Type() == "" {
		return nil, errors.New("build cache janitor needs a storage driver")
	}
	if gate == nil {
		return nil, errors.New("build cache janitor needs the registry write gate")
	}
	return &Janitor{storage: storageConfiguration, gate: gate, options: newOptions(opts)}, nil
}

func (janitor *Janitor) Run(ctx context.Context) error {
	opened, err := janitor.open(ctx)
	if err != nil {
		return err
	}
	ticker := time.NewTicker(janitor.options.interval)
	defer ticker.Stop()
	for {
		if report, sweepErr := janitor.sweep(ctx, opened); sweepErr != nil {
			janitor.options.logger.WarnContext(ctx, "Build cache sweep failed", "error", sweepErr)
		} else {
			janitor.options.logger.InfoContext(ctx, "Build cache sweep finished",
				"repositories_removed", report.repositories, "blobs_removed", report.blobs)
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

func (janitor *Janitor) open(ctx context.Context) (store, error) {
	driver, err := factory.Create(ctx, janitor.storage.Type(), janitor.storage.Parameters())
	if err != nil {
		return store{}, fmt.Errorf("open build cache storage: %w", err)
	}
	namespace, err := storage.NewRegistry(ctx, driver, storage.EnableDelete)
	if err != nil {
		return store{}, fmt.Errorf("open build cache registry: %w", err)
	}
	return store{driver: driver, registry: namespace}, nil
}

type sweepReport struct {
	repositories int
	blobs        int
}

func (janitor *Janitor) sweep(ctx context.Context, opened store) (sweepReport, error) {
	caches, err := listCaches(ctx, opened)
	if err != nil {
		return sweepReport{}, err
	}
	candidates := evictionCandidates(caches, janitor.options.now())
	janitor.gate.Lock()
	defer janitor.gate.Unlock()
	removed, err := removeStaleCaches(ctx, opened, candidates)
	if err != nil {
		return sweepReport{repositories: removed}, err
	}
	blobs, err := sweepOrphanBlobs(ctx, opened)
	return sweepReport{repositories: removed, blobs: blobs}, err
}

func removeStaleCaches(ctx context.Context, opened store, candidates []cacheEntry) (int, error) {
	vacuum := storage.NewVacuum(ctx, opened.driver)
	removed := 0
	for _, candidate := range candidates {
		lastUsed, err := cacheLastUsed(ctx, opened.driver, candidate.repository)
		if err != nil {
			return removed, err
		}
		if !lastUsed.Equal(candidate.lastUsed) {
			continue
		}
		if err := vacuum.RemoveRepository(candidate.repository); err != nil {
			return removed, fmt.Errorf("remove build cache %s: %w", candidate.repository, err)
		}
		removed++
	}
	return removed, nil
}
