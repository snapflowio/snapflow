// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package volumeartifact

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/google/uuid"
)

const (
	testVolumeBlocks    = 4
	testPartialBlock    = 1 << 20
	testVolumeSizeBytes = testVolumeBlocks*BlockSize + testPartialBlock
	testLastBlock       = testVolumeBlocks
)

type memoryRanges struct {
	data []byte
}

func (m memoryRanges) ReadRange(_ context.Context, offset, length int64) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader(m.data[offset : offset+length])), nil
}

type backupFixture struct {
	volumeID string
	path     string
}

func newDataKey(t *testing.T) string {
	t.Helper()
	key := make([]byte, DataKeyBytes)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	return base64.StdEncoding.EncodeToString(key)
}

func randomBytes(t *testing.T, length int) []byte {
	t.Helper()
	data := make([]byte, length)
	if _, err := rand.Read(data); err != nil {
		t.Fatal(err)
	}
	return data
}

// newSparseVolume writes data to block 0, an explicit all-zero block 2 and the
// partial last block; blocks 1 and 3 stay holes.
func newSparseVolume(t *testing.T) backupFixture {
	t.Helper()
	path := filepath.Join(t.TempDir(), "volume.raw")
	file, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if err := file.Truncate(testVolumeSizeBytes); err != nil {
		t.Fatal(err)
	}
	writeBlock(t, path, 0, randomBytes(t, BlockSize))
	writeBlock(t, path, 2, make([]byte, BlockSize))
	writeBlock(t, path, testLastBlock, randomBytes(t, testPartialBlock))
	return backupFixture{volumeID: uuid.NewString(), path: path}
}

func writeBlock(t *testing.T, path string, index int64, data []byte) {
	t.Helper()
	file, err := os.OpenFile(path, os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if _, err := file.WriteAt(data, index*BlockSize); err != nil {
		t.Fatal(err)
	}
}

func runBackup(t *testing.T, fixture backupFixture, dataKey string, base *Manifest) (BackupResult, []byte) {
	t.Helper()
	source, err := os.Open(fixture.path)
	if err != nil {
		t.Fatal(err)
	}
	defer source.Close()
	var pack bytes.Buffer
	result, err := Backup(t.Context(), source, &pack, BackupRequest{
		VolumeID: fixture.volumeID, ArtifactID: uuid.NewString(), DataKey: dataKey, Base: base,
	})
	if err != nil {
		t.Fatal(err)
	}
	if int64(pack.Len()) != result.PackSizeBytes {
		t.Fatalf("pack has %d bytes, result reports %d", pack.Len(), result.PackSizeBytes)
	}
	return result, pack.Bytes()
}

func restoreToFile(t *testing.T, fixture backupFixture, manifest Manifest, packs map[string]Pack) (string, error) {
	t.Helper()
	destination := filepath.Join(t.TempDir(), "restored.raw")
	return destination, Restore(t.Context(), destination, RestoreRequest{
		VolumeID: fixture.volumeID, Manifest: manifest, Packs: packs,
		ExpectedVolumeSizeBytes: testVolumeSizeBytes,
	})
}

func assertSameContent(t *testing.T, expectedPath, actualPath string) {
	t.Helper()
	expected, err := os.ReadFile(expectedPath)
	if err != nil {
		t.Fatal(err)
	}
	actual, err := os.ReadFile(actualPath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(expected, actual) {
		t.Fatal("restored volume does not match its source")
	}
}

func entryIndexes(manifest Manifest) []int64 {
	indexes := make([]int64, 0, len(manifest.Entries))
	for _, entry := range manifest.Entries {
		indexes = append(indexes, entry.Index)
	}
	return indexes
}

func TestBackupRoundTripSkipsZeroBlocks(t *testing.T) {
	fixture := newSparseVolume(t)
	dataKey := newDataKey(t)
	result, pack := runBackup(t, fixture, dataKey, nil)

	if got := entryIndexes(result.Manifest); !slices.Equal(got, []int64{0, testLastBlock}) {
		t.Fatalf("manifest blocks = %v, want only the non-zero blocks", got)
	}
	if result.ChangedBytes != BlockSize+testPartialBlock {
		t.Fatalf("changed bytes = %d", result.ChangedBytes)
	}
	if got := result.Manifest.ReferencedArtifactIDs(); !slices.Equal(got, []string{result.Manifest.ArtifactID}) {
		t.Fatalf("referenced artifacts = %v", got)
	}
	restored, err := restoreToFile(t, fixture, result.Manifest, map[string]Pack{
		result.Manifest.ArtifactID: {DataKey: dataKey, Ranges: memoryRanges{data: pack}},
	})
	if err != nil {
		t.Fatal(err)
	}
	assertSameContent(t, fixture.path, restored)
	// One block of slack covers filesystem allocation granularity; a dense
	// restore would allocate the whole volume.
	assertSparse(t, restored, 2*BlockSize+testPartialBlock)
}

func TestIncrementalBackupPacksOnlyChangedBlocks(t *testing.T) {
	fixture := newSparseVolume(t)
	firstKey := newDataKey(t)
	first, firstPack := runBackup(t, fixture, firstKey, nil)

	writeBlock(t, fixture.path, 1, randomBytes(t, BlockSize))
	secondKey := newDataKey(t)
	second, secondPack := runBackup(t, fixture, secondKey, &first.Manifest)

	if second.ChangedBytes != BlockSize || len(secondPack) == 0 || len(secondPack) > maxChunkBytes {
		t.Fatalf("incremental backup packed %d changed bytes into %d bytes", second.ChangedBytes, len(secondPack))
	}
	for _, entry := range second.Manifest.Entries {
		wantPack := first.Manifest.ArtifactID
		if entry.Index == 1 {
			wantPack = second.Manifest.ArtifactID
		}
		if entry.PackArtifactID != wantPack {
			t.Fatalf("block %d references pack %s, want %s", entry.Index, entry.PackArtifactID, wantPack)
		}
	}
	wantReferenced := []string{first.Manifest.ArtifactID, second.Manifest.ArtifactID}
	slices.Sort(wantReferenced)
	if got := second.Manifest.ReferencedArtifactIDs(); !slices.Equal(got, wantReferenced) {
		t.Fatalf("referenced artifacts = %v, want %v", got, wantReferenced)
	}
	restored, err := restoreToFile(t, fixture, second.Manifest, map[string]Pack{
		first.Manifest.ArtifactID:  {DataKey: firstKey, Ranges: memoryRanges{data: firstPack}},
		second.Manifest.ArtifactID: {DataKey: secondKey, Ranges: memoryRanges{data: secondPack}},
	})
	if err != nil {
		t.Fatal(err)
	}
	assertSameContent(t, fixture.path, restored)

	unchanged, unchangedPack := runBackup(t, fixture, newDataKey(t), &second.Manifest)
	if len(unchangedPack) != 0 || unchanged.ChangedBytes != 0 {
		t.Fatalf("unchanged backup packed %d bytes", len(unchangedPack))
	}
	if got := unchanged.Manifest.ReferencedArtifactIDs(); !slices.Equal(got, wantReferenced) {
		t.Fatalf("unchanged backup references %v, want %v", got, wantReferenced)
	}
}

func TestRestoreRejectsTamperedChunk(t *testing.T) {
	fixture := newSparseVolume(t)
	dataKey := newDataKey(t)
	result, pack := runBackup(t, fixture, dataKey, nil)
	tampered := slices.Clone(pack)
	tampered[len(tampered)/2] ^= 0xff

	destination, err := restoreToFile(t, fixture, result.Manifest, map[string]Pack{
		result.Manifest.ArtifactID: {DataKey: dataKey, Ranges: memoryRanges{data: tampered}},
	})
	if err == nil || !strings.Contains(err.Error(), "authenticate block") {
		t.Fatalf("tampered chunk error = %v, want an authentication failure", err)
	}
	if _, statErr := os.Stat(destination); !os.IsNotExist(statErr) {
		t.Fatalf("incomplete restore was left behind: %v", statErr)
	}
}

func TestRestoreRejectsChunkMovedToAnotherBlock(t *testing.T) {
	fixture := newSparseVolume(t)
	dataKey := newDataKey(t)
	result, pack := runBackup(t, fixture, dataKey, nil)
	moved := result.Manifest
	moved.Entries = slices.Clone(result.Manifest.Entries)
	moved.Entries[0].Index = 1

	_, err := restoreToFile(t, fixture, moved, map[string]Pack{
		result.Manifest.ArtifactID: {DataKey: dataKey, Ranges: memoryRanges{data: pack}},
	})
	if err == nil || !strings.Contains(err.Error(), "authenticate block 1") {
		t.Fatalf("moved chunk error = %v, want an authentication failure", err)
	}
}

func TestRestoreRejectsUnknownPack(t *testing.T) {
	fixture := newSparseVolume(t)
	result, _ := runBackup(t, fixture, newDataKey(t), nil)

	_, err := restoreToFile(t, fixture, result.Manifest, map[string]Pack{})
	if err == nil || !strings.Contains(err.Error(), "was not provided") {
		t.Fatalf("unknown pack error = %v", err)
	}
}

func TestRestoreRejectsOutOfRangeBlock(t *testing.T) {
	fixture := newSparseVolume(t)
	dataKey := newDataKey(t)
	result, pack := runBackup(t, fixture, dataKey, nil)
	outOfRange := result.Manifest
	outOfRange.Entries = slices.Clone(result.Manifest.Entries)
	outOfRange.Entries[len(outOfRange.Entries)-1].Index = blockCount(testVolumeSizeBytes)

	_, err := restoreToFile(t, fixture, outOfRange, map[string]Pack{
		result.Manifest.ArtifactID: {DataKey: dataKey, Ranges: memoryRanges{data: pack}},
	})
	if err == nil || !strings.Contains(err.Error(), "out of order or range") {
		t.Fatalf("out of range block error = %v", err)
	}
}

func TestSealedManifestIsBoundToItsBackup(t *testing.T) {
	fixture := newSparseVolume(t)
	dataKey := newDataKey(t)
	result, _ := runBackup(t, fixture, dataKey, nil)
	sealed, err := SealManifest(result.Manifest, dataKey)
	if err != nil {
		t.Fatal(err)
	}

	opened, err := OpenManifest(sealed, dataKey, fixture.volumeID, result.Manifest.ArtifactID, testVolumeSizeBytes)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(opened.Entries, result.Manifest.Entries) {
		t.Fatal("opened manifest differs from the sealed one")
	}
	if _, err := OpenManifest(sealed, dataKey, fixture.volumeID, uuid.NewString(), testVolumeSizeBytes); err == nil {
		t.Fatal("manifest opened under another backup artifact id")
	}
	if _, err := OpenManifest(sealed, dataKey, uuid.NewString(), result.Manifest.ArtifactID, testVolumeSizeBytes); err == nil {
		t.Fatal("manifest opened for another volume")
	}
	if _, err := OpenManifest(sealed, newDataKey(t), fixture.volumeID, result.Manifest.ArtifactID, testVolumeSizeBytes); err == nil {
		t.Fatal("manifest opened with another data key")
	}
	if _, err := OpenManifest(sealed, dataKey, fixture.volumeID, result.Manifest.ArtifactID, BlockSize); err == nil {
		t.Fatal("manifest larger than the allowed volume size was accepted")
	}
}

func TestPlanRangesCoalescesContiguousChunksOfOnePack(t *testing.T) {
	entries := []Entry{
		{Index: 0, PackArtifactID: "a", Offset: 0, Length: 10},
		{Index: 1, PackArtifactID: "a", Offset: 10, Length: 5},
		{Index: 2, PackArtifactID: "b", Offset: 0, Length: 7},
		{Index: 3, PackArtifactID: "a", Offset: 15, Length: 3},
		{Index: 4, PackArtifactID: "a", Offset: 40, Length: 3},
	}
	ranges := planRanges(entries)
	got := make([][3]int64, 0, len(ranges))
	for _, span := range ranges {
		got = append(got, [3]int64{span.offset, span.length, int64(len(span.entries))})
	}
	want := [][3]int64{{0, 15, 2}, {0, 7, 1}, {15, 3, 1}, {40, 3, 1}}
	if !slices.Equal(got, want) {
		t.Fatalf("planned ranges = %v, want %v", got, want)
	}
}
