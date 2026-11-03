// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package doctor

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/snapflowio/snapflow/internal/state"
	"golang.org/x/sys/unix"
)

const (
	minimumSamples         = 5
	maximumSamples         = 100
	storageSampleBytes     = 8 * 1024 * 1024
	benchmarkHTTPTimeout   = 10 * time.Second
	benchmarkDirectoryMode = 0o700
	benchmarkReportMode    = 0o600
	medianPercentile       = 50
	tailPercentile         = 95
	extremePercentile      = 99
	percentScale           = 100
)

type Distribution struct {
	P50 int64 `json:"p50"`
	P95 int64 `json:"p95"`
	P99 int64 `json:"p99"`
}

type BenchmarkReport struct {
	Schema                   string       `json:"schema"`
	Profile                  string       `json:"profile"`
	RecordedAt               time.Time    `json:"recordedAt"`
	Architecture             string       `json:"architecture"`
	Kernel                   string       `json:"kernel"`
	LogicalCPUs              int          `json:"logicalCpus"`
	Samples                  int          `json:"samples"`
	ReleaseVersion           string       `json:"releaseVersion"`
	ReleaseBundleDigest      string       `json:"releaseBundleDigest"`
	ReleaseAssetBytes        int64        `json:"releaseAssetBytes"`
	CacheState               string       `json:"cacheState"`
	ReleaseVerificationNanos Distribution `json:"releaseVerificationNanos"`
	StorageWriteBytesPerSec  Distribution `json:"storageWriteBytesPerSecond"`
	StorageReadBytesPerSec   Distribution `json:"storageReadBytesPerSecond"`
	APIHealthLatencyNanos    Distribution `json:"apiHealthLatencyNanos"`
}

func Benchmark(ctx context.Context, cfg *config.Config, samples int) (BenchmarkReport, error) {
	if samples < minimumSamples || samples > maximumSamples {
		return BenchmarkReport{}, fmt.Errorf("benchmark samples must be between %d and %d", minimumSamples, maximumSamples)
	}
	active, err := release.LoadActive(cfg.Runtime.ReleaseRoot, true)
	if err != nil {
		return BenchmarkReport{}, err
	}
	inspection, err := state.Inspect(ctx, cfg.Machine.StateDirectory)
	if err != nil {
		return BenchmarkReport{}, fmt.Errorf("inspect registered API for benchmark: %w", err)
	}
	if err := cfg.Profile.ValidateAPIURL(inspection.APIURL); err != nil {
		return BenchmarkReport{}, fmt.Errorf("benchmark control-plane profile: %w", err)
	}
	benchmarkRoot := filepath.Join(cfg.Runtime.DataDirectory, "benchmarks")
	if err := os.MkdirAll(benchmarkRoot, benchmarkDirectoryMode); err != nil {
		return BenchmarkReport{}, fmt.Errorf("create benchmark directory: %w", err)
	}
	measured, err := collectBenchmarkSamples(ctx, cfg.Runtime.ReleaseRoot, inspection.APIURL, benchmarkRoot, samples)
	if err != nil {
		return BenchmarkReport{}, err
	}
	var assetBytes int64
	for _, file := range active.Manifest.Files {
		assetBytes += file.Size
	}
	report := BenchmarkReport{
		Schema: "snapflow.runtime-benchmark.v1", Profile: string(cfg.Profile.Name),
		RecordedAt: time.Now().UTC(), Architecture: runtime.GOARCH, Kernel: kernelVersion(),
		LogicalCPUs: runtime.NumCPU(), Samples: samples, ReleaseVersion: active.Manifest.Version,
		ReleaseBundleDigest: active.BundleDigest, ReleaseAssetBytes: assetBytes,
		CacheState:               "warm-installed-release",
		ReleaseVerificationNanos: distribution(measured.verification),
		StorageWriteBytesPerSec:  distribution(measured.writes), StorageReadBytesPerSec: distribution(measured.reads),
		APIHealthLatencyNanos: distribution(measured.apiLatency),
	}
	if err := writeReport(filepath.Join(benchmarkRoot, "latest.json"), report); err != nil {
		return BenchmarkReport{}, err
	}
	return report, nil
}

type benchmarkSamples struct {
	verification []int64
	writes       []int64
	reads        []int64
	apiLatency   []int64
}

func collectBenchmarkSamples(ctx context.Context, releaseRoot, apiURL, root string, samples int) (benchmarkSamples, error) {
	payload := make([]byte, storageSampleBytes)
	if _, err := rand.Read(payload); err != nil {
		return benchmarkSamples{}, fmt.Errorf("prepare storage benchmark payload: %w", err)
	}
	measured := benchmarkSamples{
		verification: make([]int64, 0, samples),
		writes:       make([]int64, 0, samples),
		reads:        make([]int64, 0, samples),
		apiLatency:   make([]int64, 0, samples),
	}
	for sample := 0; sample < samples; sample++ {
		started := time.Now()
		if _, err := release.LoadActive(releaseRoot, true); err != nil {
			return benchmarkSamples{}, err
		}
		measured.verification = append(measured.verification, time.Since(started).Nanoseconds())
		writeRate, readRate, err := storageSample(root, payload)
		if err != nil {
			return benchmarkSamples{}, err
		}
		measured.writes = append(measured.writes, writeRate)
		measured.reads = append(measured.reads, readRate)
		latency, err := healthSample(ctx, apiURL)
		if err != nil {
			return benchmarkSamples{}, err
		}
		measured.apiLatency = append(measured.apiLatency, latency)
	}
	return measured, nil
}

func storageSample(root string, payload []byte) (writeRate, readRate int64, resultErr error) {
	file, err := os.CreateTemp(root, ".storage-sample-")
	if err != nil {
		return 0, 0, err
	}
	path := file.Name()
	fileOpen := true
	defer func() {
		if fileOpen {
			resultErr = errors.Join(resultErr, file.Close())
		}
		if removeErr := os.Remove(path); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
			resultErr = errors.Join(resultErr, removeErr)
		}
	}()
	started := time.Now()
	if _, err := file.Write(payload); err != nil {
		return 0, 0, err
	}
	if err := file.Sync(); err != nil {
		return 0, 0, err
	}
	fileOpen = false
	if err := file.Close(); err != nil {
		return 0, 0, err
	}
	writeRate = bytesPerSecond(len(payload), time.Since(started))
	file, err = os.Open(path)
	if err != nil {
		return 0, 0, err
	}
	fileOpen = true
	started = time.Now()
	written, copyErr := io.Copy(io.Discard, file)
	fileOpen = false
	closeErr := file.Close()
	if err := errors.Join(copyErr, closeErr); err != nil {
		return 0, 0, err
	}
	if written != int64(len(payload)) {
		return 0, 0, errors.New("storage benchmark read was incomplete")
	}
	return writeRate, bytesPerSecond(len(payload), time.Since(started)), nil
}

func healthSample(ctx context.Context, apiURL string) (int64, error) {
	endpoint := strings.TrimRight(apiURL, "/") + "/health"
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, err
	}
	started := time.Now()
	response, err := (&http.Client{Timeout: benchmarkHTTPTimeout}).Do(request)
	if err != nil {
		return 0, err
	}
	closeErr := response.Body.Close()
	if closeErr != nil {
		return 0, closeErr
	}
	if response.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("the Snapflow API health benchmark returned HTTP %d", response.StatusCode)
	}
	return time.Since(started).Nanoseconds(), nil
}

func bytesPerSecond(bytes int, duration time.Duration) int64 {
	if duration <= 0 {
		return 0
	}
	return int64(float64(bytes) / duration.Seconds())
}

func distribution(values []int64) Distribution {
	ordered := slices.Clone(values)
	slices.Sort(ordered)
	return Distribution{
		P50: percentile(ordered, medianPercentile),
		P95: percentile(ordered, tailPercentile),
		P99: percentile(ordered, extremePercentile),
	}
}

func percentile(ordered []int64, percentage int) int64 {
	index := (len(ordered)*percentage + percentScale - 1) / percentScale
	return ordered[max(0, index-1)]
}

func kernelVersion() string {
	var value unix.Utsname
	if err := unix.Uname(&value); err != nil {
		return "unknown"
	}
	return unix.ByteSliceToString(value.Release[:])
}

func writeReport(path string, report BenchmarkReport) error {
	payload, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	return atomicfile.WriteFile(path, append(payload, '\n'), benchmarkReportMode)
}
