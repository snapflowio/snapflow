// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
)

const (
	testPlacementID  = "placement-1"
	testGenerationID = "generation-1"
)

func testAcceptedAt() time.Time {
	return time.Date(2026, 10, 4, 16, 42, 48, 0, time.UTC)
}

func testNextDigest() string {
	return strings.Repeat("b", hex.EncodedLen(sha256.Size))
}

func testFirstDigest() string {
	return strings.Repeat("a", hex.EncodedLen(sha256.Size))
}

func testChainKey() UsageChainKey {
	return UsageChainKey{PlacementID: testPlacementID, GenerationID: testGenerationID}
}

func saveTestReading(t *testing.T, database *Database, sequence uint64) UsageReading {
	t.Helper()
	if err := database.SaveUsageReading(t.Context(), UsageReading{
		SandboxID: testSandboxID, AssignmentGeneration: testUsageGeneration,
		Sample: microvmtypes.RuntimeUsageSample{Sequence: sequence, GenerationID: testGenerationID, SampledAt: testAcceptedAt()},
	}); err != nil {
		t.Fatalf("save reading %d: %v", sequence, err)
	}
	readings, quarantined, err := database.LoadUsageReadings(t.Context())
	if err != nil || len(quarantined) != 0 || len(readings) == 0 {
		t.Fatalf("load readings = %v, %v, %v", readings, quarantined, err)
	}
	return readings[len(readings)-1]
}

func assertChainHead(t *testing.T, database *Database, wantDigest string, wantFound bool) {
	t.Helper()
	digest, found, err := database.LoadUsageChainHead(t.Context(), testChainKey())
	if err != nil || found != wantFound || digest != wantDigest {
		t.Fatalf("chain head = %q, %v, %v; want %q, %v", digest, found, err, wantDigest, wantFound)
	}
}

func TestAcceptingAReadingForgetsItAndAdvancesItsChain(t *testing.T) {
	database := openTestDatabase(t)
	assertChainHead(t, database, "", false)
	first := saveTestReading(t, database, 1)
	if err := database.AcceptUsageReading(t.Context(), first.ID, UsageChainHead{Key: testChainKey(), Digest: testFirstDigest(), UpdatedAt: testAcceptedAt()}); err != nil {
		t.Fatalf("accept first reading: %v", err)
	}
	assertChainHead(t, database, testFirstDigest(), true)
	next := saveTestReading(t, database, 2)
	if err := database.AcceptUsageReading(t.Context(), next.ID, UsageChainHead{Key: testChainKey(), Digest: testNextDigest(), UpdatedAt: testAcceptedAt()}); err != nil {
		t.Fatalf("accept next reading: %v", err)
	}
	assertChainHead(t, database, testNextDigest(), true)
	if readings, quarantined, err := database.LoadUsageReadings(t.Context()); err != nil || len(quarantined) != 0 || len(readings) != 0 {
		t.Fatalf("readings after acceptance = %v, %v", readings, err)
	}
}

func TestAFailedAcceptanceKeepsTheReadingAndTheHead(t *testing.T) {
	database := openTestDatabase(t)
	reading := saveTestReading(t, database, 1)
	if err := database.AcceptUsageReading(t.Context(), reading.ID, UsageChainHead{Key: testChainKey(), Digest: "short", UpdatedAt: testAcceptedAt()}); err == nil {
		t.Fatal("accepted a reading with an invalid digest")
	}
	assertChainHead(t, database, "", false)
	if readings, quarantined, err := database.LoadUsageReadings(t.Context()); err != nil || len(quarantined) != 0 || len(readings) != 1 {
		t.Fatalf("readings after the failed acceptance = %v, %v; want the reading kept", readings, err)
	}
}

func TestPruningForgetsOnlyStaleChainHeads(t *testing.T) {
	database := openTestDatabase(t)
	staleKey := UsageChainKey{PlacementID: testPlacementID, GenerationID: "generation-stale"}
	cutoff := testAcceptedAt().Add(-time.Hour)
	for _, head := range []UsageChainHead{
		{Key: staleKey, Digest: testFirstDigest(), UpdatedAt: cutoff.Add(-time.Millisecond)},
		{Key: testChainKey(), Digest: testNextDigest(), UpdatedAt: cutoff},
	} {
		reading := saveTestReading(t, database, 1)
		if err := database.AcceptUsageReading(t.Context(), reading.ID, head); err != nil {
			t.Fatalf("accept reading: %v", err)
		}
	}
	if err := database.PruneUsageChainHeads(t.Context(), cutoff); err != nil {
		t.Fatalf("prune chain heads: %v", err)
	}
	if digest, found, err := database.LoadUsageChainHead(t.Context(), staleKey); err != nil || found {
		t.Fatalf("stale head = %q, %v, %v; want it pruned", digest, found, err)
	}
	assertChainHead(t, database, testNextDigest(), true)
}
