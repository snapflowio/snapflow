// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"io"
	"log/slog"
	"net/http"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type runtimeGone struct{}

func (runtimeGone) Error() string       { return "the sandbox runtime does not exist" }
func (runtimeGone) HTTPStatusCode() int { return http.StatusNotFound }
func (runtimeGone) ErrorCode() string   { return runtimeNotFound }

type fakeSampler struct {
	mu           sync.Mutex
	err          error
	generationID string
	sequence     uint64
	sampled      time.Time
}

func (sampler *fakeSampler) RuntimeUsageSample(context.Context, string) (microvmtypes.RuntimeUsageSample, error) {
	sampler.mu.Lock()
	defer sampler.mu.Unlock()
	if sampler.err != nil {
		return microvmtypes.RuntimeUsageSample{}, sampler.err
	}
	if sampler.sampled.IsZero() {
		sampler.sampled = time.Now().Add(-time.Minute)
	}
	if sampler.generationID == "" {
		sampler.generationID = testRuntimeGenerationID
	}
	sampler.sequence++
	sampler.sampled = sampler.sampled.Add(testRunningStep * time.Millisecond)
	return microvmtypes.RuntimeUsageSample{
		Sequence: sampler.sequence, SampledAt: sampler.sampled, GenerationID: sampler.generationID,
		State:         string(apiclient.MachineUsageRuntimeStateStarted),
		RunningMillis: sampler.sequence * testRunningStep, CPUVCPUs: testCPU,
	}, nil
}

func (sampler *fakeSampler) restart(generationID string) {
	sampler.mu.Lock()
	defer sampler.mu.Unlock()
	sampler.generationID = generationID
	sampler.sequence = 0
}

func (sampler *fakeSampler) fail(err error) {
	sampler.mu.Lock()
	defer sampler.mu.Unlock()
	sampler.err = err
}

type fakeUsageAPI struct {
	mu         sync.Mutex
	placements []apiclient.MachineReportablePlacementDto
	failures   []error
	attempts   []apiclient.MachineUsageReceiptDto
	receipts   []apiclient.MachineUsageReceiptDto
}

func (control *fakeUsageAPI) ListPlacements(ctx context.Context) ([]apiclient.MachineReportablePlacementDto, error) {
	control.mu.Lock()
	defer control.mu.Unlock()
	return slices.Clone(control.placements), ctx.Err()
}

func (control *fakeUsageAPI) Submit(ctx context.Context, receipt apiclient.MachineUsageReceiptDto) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	control.mu.Lock()
	defer control.mu.Unlock()
	control.attempts = append(control.attempts, receipt)
	if len(control.failures) > 0 {
		failure := control.failures[0]
		control.failures = control.failures[1:]
		return failure
	}
	control.receipts = append(control.receipts, receipt)
	return nil
}

func (control *fakeUsageAPI) list(placements ...apiclient.MachineReportablePlacementDto) {
	control.mu.Lock()
	defer control.mu.Unlock()
	control.placements = placements
}

type memoryReadings struct {
	mu       sync.Mutex
	nextID   int64
	readings []state.UsageReading
	heads    map[state.UsageChainKey]state.UsageChainHead
}

func (store *memoryReadings) LoadUsageChainHead(ctx context.Context, key state.UsageChainKey) (string, bool, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	head, found := store.heads[key]
	return head.Digest, found, ctx.Err()
}

func (store *memoryReadings) AcceptUsageReading(ctx context.Context, id int64, head state.UsageChainHead) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.readings = slices.DeleteFunc(store.readings, func(reading state.UsageReading) bool { return reading.ID == id })
	if store.heads == nil {
		store.heads = make(map[state.UsageChainKey]state.UsageChainHead)
	}
	store.heads[head.Key] = head
	return ctx.Err()
}

func (store *memoryReadings) PruneUsageChainHeads(ctx context.Context, cutoff time.Time) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	for key, head := range store.heads {
		if head.UpdatedAt.Before(cutoff) {
			delete(store.heads, key)
		}
	}
	return ctx.Err()
}

func (store *memoryReadings) SaveUsageReading(ctx context.Context, reading state.UsageReading) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.nextID++
	reading.ID = store.nextID
	store.readings = append(store.readings, reading)
	return ctx.Err()
}

func (store *memoryReadings) DeleteUsageReading(ctx context.Context, id int64) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.readings = slices.DeleteFunc(store.readings, func(reading state.UsageReading) bool { return reading.ID == id })
	return ctx.Err()
}

func (store *memoryReadings) LoadUsageReadings(ctx context.Context) ([]state.UsageReading, []state.DeadLetter, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	return slices.Clone(store.readings), nil, ctx.Err()
}

func (store *memoryReadings) pending() int {
	store.mu.Lock()
	defer store.mu.Unlock()
	return len(store.readings)
}

func testUsageIdentity(t *testing.T) *state.Identity {
	t.Helper()
	publicKey, signingKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate signing key: %v", err)
	}
	keyID, err := state.KeyID(publicKey)
	if err != nil {
		t.Fatalf("derive key ID: %v", err)
	}
	return &state.Identity{
		APIURL: testAPIURL, MachineID: testMachineID, OwnerID: testOwnerID,
		KeyID: keyID, SigningKey: signingKey,
	}
}

func newTestReporter(
	t *testing.T,
	identity *state.Identity,
	sampler *fakeSampler,
	control *fakeUsageAPI,
	store ReadingStore,
) *Reporter {
	t.Helper()
	reporter, err := newReporter(
		Config{}, sampler, identity, store, control,
		WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
	)
	if err != nil {
		t.Fatalf("newReporter() error = %v", err)
	}
	return reporter
}

func testPlacement(released bool) apiclient.MachineReportablePlacementDto {
	placement := apiclient.MachineReportablePlacementDto{
		PlacementId: uuid.MustParse(testPlacementID), SandboxId: testUsageSandboxID,
		AssignmentGeneration: testGeneration, FencingToken: uuid.MustParse(testFencingToken), PlacedAt: time.Now(),
	}
	if released {
		releasedAt := time.Now()
		placement.ReleasedAt = &releasedAt
	}
	return placement
}
