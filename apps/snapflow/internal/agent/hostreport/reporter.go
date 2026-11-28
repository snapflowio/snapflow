// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package hostreport

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/snapflowio/snapflow/internal/agent/doctor"
	"github.com/snapflowio/snapflow/internal/foundation/state"
)

const (
	CheckInterval       = 30 * time.Second
	DiagnosticsInterval = 15 * time.Minute
	RefreshInterval     = time.Hour
	diagnosticsTimeout  = 2 * time.Minute
)

type Store interface {
	LoadPaymentHolds(ctx context.Context) ([]state.SandboxPaymentHold, error)
	LoadTrafficMonth(ctx context.Context) (state.TrafficMonth, bool, error)
}

type Dependencies struct {
	Control       Control
	Store         Store
	Diagnose      func(context.Context) doctor.Diagnosis
	LoadBenchmark func() (*doctor.BenchmarkReport, error)
	Logger        *slog.Logger
	Now           func() time.Time
}

type sent struct {
	fingerprint string
	at          time.Time
}

func (last sent) due(fingerprint string, now time.Time, refresh bool) bool {
	return fingerprint != last.fingerprint || (refresh && now.Sub(last.at) >= RefreshInterval)
}

type Reporter struct {
	deps        Dependencies
	diagnosedAt time.Time
	diagnostics sent
	holds       sent
	benchmark   sent
	traffic     sent
}

func New(deps Dependencies) (*Reporter, error) {
	if deps.Control == nil || deps.Store == nil || deps.Diagnose == nil || deps.LoadBenchmark == nil {
		return nil, errors.New("the host reporter needs its control plane, store, doctor and benchmark")
	}
	if deps.Logger == nil {
		deps.Logger = slog.Default()
	}
	if deps.Now == nil {
		deps.Now = time.Now
	}
	return &Reporter{deps: deps}, nil
}

func (reporter *Reporter) Run(ctx context.Context) error {
	ticker := time.NewTicker(CheckInterval)
	defer ticker.Stop()
	for {
		reporter.Report(ctx)
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

func (reporter *Reporter) Report(ctx context.Context) {
	now := reporter.deps.Now()
	reporter.warn(ctx, "payment holds", reporter.reportHolds(ctx, now))
	reporter.warn(ctx, "benchmark", reporter.reportBenchmark(ctx, now))
	reporter.warn(ctx, "traffic", reporter.reportTraffic(ctx, now))
	if reporter.diagnosedAt.IsZero() || now.Sub(reporter.diagnosedAt) >= DiagnosticsInterval {
		err := reporter.reportDiagnostics(ctx, now)
		if err == nil {
			reporter.diagnosedAt = now
		}
		reporter.warn(ctx, "diagnostics", err)
	}
}

func (reporter *Reporter) reportHolds(ctx context.Context, now time.Time) error {
	holds, err := reporter.deps.Store.LoadPaymentHolds(ctx)
	if err != nil {
		return err
	}
	fingerprint, err := fingerprintOf(holds)
	if err != nil || !reporter.holds.due(fingerprint, now, true) {
		return err
	}
	payload, err := PaymentHoldsReport(holds, now)
	if err != nil {
		return err
	}
	if err := reporter.deps.Control.ReportPaymentHolds(ctx, payload); err != nil {
		return err
	}
	reporter.holds = sent{fingerprint: fingerprint, at: now}
	return nil
}

func (reporter *Reporter) reportBenchmark(ctx context.Context, now time.Time) error {
	report, err := reporter.deps.LoadBenchmark()
	if err != nil || report == nil {
		return err
	}
	fingerprint, err := fingerprintOf(report)
	if err != nil || !reporter.benchmark.due(fingerprint, now, false) {
		return err
	}
	if err := reporter.deps.Control.ReportLocalBenchmark(ctx, BenchmarkReport(*report)); err != nil {
		return err
	}
	reporter.benchmark = sent{fingerprint: fingerprint, at: now}
	return nil
}

func (reporter *Reporter) reportDiagnostics(ctx context.Context, now time.Time) error {
	diagnoseContext, cancel := context.WithTimeout(ctx, diagnosticsTimeout)
	diagnosis := reporter.deps.Diagnose(diagnoseContext)
	cancel()
	fingerprint, err := fingerprintOf(diagnosis)
	if err != nil || !reporter.diagnostics.due(fingerprint, now, true) {
		return err
	}
	payload, err := DiagnosticsReport(diagnosis, now)
	if err != nil {
		return err
	}
	if err := reporter.deps.Control.ReportDiagnostics(ctx, payload); err != nil {
		return err
	}
	reporter.diagnostics = sent{fingerprint: fingerprint, at: now}
	return nil
}

func (reporter *Reporter) warn(ctx context.Context, report string, err error) {
	if err != nil && ctx.Err() == nil {
		reporter.deps.Logger.WarnContext(ctx, "Failed to report the machine's "+report, "error", err)
	}
}

func fingerprintOf(content any) (string, error) {
	encoded, err := json.Marshal(content)
	if err != nil {
		return "", fmt.Errorf("fingerprint a host report: %w", err)
	}
	return string(encoded), nil
}
