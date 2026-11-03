// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"testing"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	testSnapshotRef    = "registry.example.com/snapflow/base:1.0"
	testSnapshotDigest = "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
	testSnapshotSize   = 1 << 30
	testTemplateKey    = "template-key"
)

func TestSnapshotRecordsRoundTrip(t *testing.T) {
	database := openTestDatabase(t)
	unwantedSince := time.Date(2026, time.October, 4, 12, 0, 0, 0, time.UTC)
	record := SnapshotRecord{
		Ref: testSnapshotRef, Digest: testSnapshotDigest, SizeBytes: testSnapshotSize,
		Template:      &machinev1alpha1.PreparedTemplate{Key: testTemplateKey, CpuQuota: 1},
		UnwantedSince: unwantedSince,
	}
	if err := database.SaveSnapshotRecord(t.Context(), record); err != nil {
		t.Fatalf("save record: %v", err)
	}
	loaded, err := database.LoadSnapshotRecords(t.Context())
	if err != nil || len(loaded) != 1 {
		t.Fatalf("load records = %v, %v", loaded, err)
	}
	got := loaded[0]
	if got.Digest != testSnapshotDigest || got.SizeBytes != testSnapshotSize ||
		got.Template.GetKey() != testTemplateKey || !got.UnwantedSince.Equal(unwantedSince) {
		t.Fatalf("loaded record = %+v", got)
	}
	record.UnwantedSince = time.Time{}
	if err := database.SaveSnapshotRecord(t.Context(), record); err != nil {
		t.Fatalf("save wanted record: %v", err)
	}
	if loaded, err := database.LoadSnapshotRecords(t.Context()); err != nil || !loaded[0].UnwantedSince.IsZero() {
		t.Fatalf("wanted record = %v, %v", loaded, err)
	}
	if err := database.DeleteSnapshotRecord(t.Context(), testSnapshotRef); err != nil {
		t.Fatalf("delete record: %v", err)
	}
	if loaded, err := database.LoadSnapshotRecords(t.Context()); err != nil || len(loaded) != 0 {
		t.Fatalf("records after delete = %v, %v", loaded, err)
	}
}
