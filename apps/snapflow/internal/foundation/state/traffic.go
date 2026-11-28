// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"time"
)

const (
	TrafficMonthLayout      = "2006-01"
	trafficMonthSingletonID = 1
	trafficCounterRetention = 62 * 24 * time.Hour
)

type TrafficMonth struct {
	Month      string
	Bytes      uint64
	ObservedAt time.Time
}

func recordTraffic(ctx context.Context, transaction *sql.Tx, reading UsageReading) error {
	sample := reading.Sample
	total := sample.TapEgressBytes + sample.TapIngressBytes
	if total > math.MaxInt64 || total < sample.TapEgressBytes {
		return fmt.Errorf("the traffic of sandbox %s exceeds the counter range", reading.SandboxID)
	}
	var (
		generationID string
		previous     int64
	)
	err := transaction.QueryRowContext(
		ctx,
		"SELECT generation_id, bytes FROM machine_traffic_counter WHERE sandbox_id = ?", reading.SandboxID,
	).Scan(&generationID, &previous)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("read the traffic counter of sandbox %s: %w", reading.SandboxID, err)
	}
	delta := total
	if err == nil && generationID == sample.GenerationID && uint64(previous) <= total {
		delta = total - uint64(previous)
	}
	sampledAt := sample.SampledAt.UTC()
	if _, err := transaction.ExecContext(ctx, `
		INSERT INTO machine_traffic_counter (sandbox_id, generation_id, bytes, updated_at) VALUES (?, ?, ?, ?)
		ON CONFLICT(sandbox_id) DO UPDATE SET
			generation_id = excluded.generation_id, bytes = excluded.bytes, updated_at = excluded.updated_at
	`, reading.SandboxID, sample.GenerationID, int64(total), sampledAt.UnixMilli()); err != nil {
		return fmt.Errorf("save the traffic counter of sandbox %s: %w", reading.SandboxID, err)
	}
	return addMonthTraffic(ctx, transaction, sampledAt, delta)
}

func addMonthTraffic(ctx context.Context, transaction *sql.Tx, sampledAt time.Time, delta uint64) error {
	stored, found, err := loadTrafficMonth(ctx, transaction)
	if err != nil {
		return err
	}
	month := sampledAt.Format(TrafficMonthLayout)
	next := TrafficMonth{Month: month, Bytes: delta, ObservedAt: sampledAt}
	switch {
	case found && month <= stored.Month:
		next = TrafficMonth{Month: stored.Month, Bytes: stored.Bytes + delta, ObservedAt: stored.ObservedAt}
		if sampledAt.After(stored.ObservedAt) {
			next.ObservedAt = sampledAt
		}
	case found:
		if _, err := transaction.ExecContext(ctx, "DELETE FROM machine_traffic_counter WHERE updated_at < ?",
			sampledAt.Add(-trafficCounterRetention).UnixMilli()); err != nil {
			return fmt.Errorf("forget stale traffic counters: %w", err)
		}
	}
	if next.Bytes > math.MaxInt64 || next.Bytes < delta {
		return fmt.Errorf("the traffic of month %s exceeds the counter range", next.Month)
	}
	if _, err := transaction.ExecContext(ctx, `
		INSERT INTO machine_traffic_month (singleton_id, month, bytes, observed_at) VALUES (?, ?, ?, ?)
		ON CONFLICT(singleton_id) DO UPDATE SET
			month = excluded.month, bytes = excluded.bytes, observed_at = excluded.observed_at
	`, trafficMonthSingletonID, next.Month, int64(next.Bytes), next.ObservedAt.UnixMilli()); err != nil {
		return fmt.Errorf("save the traffic of month %s: %w", next.Month, err)
	}
	return nil
}

type rowQuerier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func (database *Database) LoadTrafficMonth(ctx context.Context) (TrafficMonth, bool, error) {
	return loadTrafficMonth(ctx, database.sql)
}

func loadTrafficMonth(ctx context.Context, querier rowQuerier) (TrafficMonth, bool, error) {
	var (
		month      TrafficMonth
		bytes      int64
		observedAt int64
	)
	err := querier.QueryRowContext(
		ctx,
		"SELECT month, bytes, observed_at FROM machine_traffic_month WHERE singleton_id = ?", trafficMonthSingletonID,
	).Scan(&month.Month, &bytes, &observedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return TrafficMonth{}, false, nil
	}
	if err != nil {
		return TrafficMonth{}, false, fmt.Errorf("load the month's traffic: %w", err)
	}
	month.Bytes, month.ObservedAt = uint64(bytes), time.UnixMilli(observedAt).UTC()
	return month, true, nil
}
