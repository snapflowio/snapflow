// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"time"

	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/doctor"
)

const bytesPerMebibyte = 1 << 20

func Benchmark(theme style.Theme, report doctor.BenchmarkReport) string {
	return Lines(
		Header(theme, text.LabelBenchmark, report.Profile),
		"",
		Row(theme, text.LabelRelease, theme.Value.Render(report.ReleaseVersion)),
		Row(theme, text.LabelSamples, theme.Value.Render(text.Count(report.Samples))),
		Row(theme, text.LabelVerification, theme.Value.Render(durations(report.ReleaseVerificationNanos))),
		Row(theme, text.LabelStorageWrite, theme.Value.Render(throughput(report.StorageWriteBytesPerSec))),
		Row(theme, text.LabelStorageRead, theme.Value.Render(throughput(report.StorageReadBytesPerSec))),
		Row(theme, text.LabelAPILatency, theme.Value.Render(durations(report.APIHealthLatencyNanos))),
	)
}

func durations(distribution doctor.Distribution) string {
	return text.Percentiles(
		time.Duration(distribution.P50).String(),
		time.Duration(distribution.P95).String(),
		time.Duration(distribution.P99).String(),
	)
}

func throughput(distribution doctor.Distribution) string {
	return text.Percentiles(
		text.MebibytesPerSecond(distribution.P50/bytesPerMebibyte),
		text.MebibytesPerSecond(distribution.P95/bytesPerMebibyte),
		text.MebibytesPerSecond(distribution.P99/bytesPerMebibyte),
	)
}
