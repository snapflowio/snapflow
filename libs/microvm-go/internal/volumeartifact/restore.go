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
	"context"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/klauspost/compress/zstd"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
)

// maxRangeBytes caps one coalesced pack read so a failed transfer only loses
// a bounded amount of progress.
const maxRangeBytes = 256 << 20

// RangeReader reads a byte range of a pack object.
type RangeReader interface {
	ReadRange(ctx context.Context, offset, length int64) (io.ReadCloser, error)
}

type Pack struct {
	DataKey string
	Ranges  RangeReader
}

type RestoreRequest struct {
	VolumeID                string
	Manifest                Manifest
	Packs                   map[string]Pack
	ExpectedVolumeSizeBytes int64
}

type packRange struct {
	artifactID string
	offset     int64
	length     int64
	entries    []Entry
}

type openedPack struct {
	aead   cipher.AEAD
	ranges RangeReader
}

// Restore rebuilds the volume described by the manifest into a new sparse
// file at destinationPath; blocks absent from the manifest stay holes.
func Restore(ctx context.Context, destinationPath string, request RestoreRequest) (returnErr error) {
	manifest := request.Manifest
	if manifest.VolumeID != request.VolumeID {
		return fmt.Errorf("backup manifest %s belongs to another volume", manifest.ArtifactID)
	}
	if manifest.VolumeSizeBytes != request.ExpectedVolumeSizeBytes {
		return fmt.Errorf("backup manifest describes %d bytes, expected %d", manifest.VolumeSizeBytes, request.ExpectedVolumeSizeBytes)
	}
	if err := manifest.validate(); err != nil {
		return err
	}
	packs, err := openPacks(manifest, request.Packs)
	if err != nil {
		return err
	}
	decoder, err := newDecoder(BlockSize)
	if err != nil {
		return err
	}
	defer decoder.Close()

	destination, err := os.OpenFile(destinationPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, filemode.PrivateFile)
	if err != nil {
		return fmt.Errorf("create restored volume image: %w", err)
	}
	defer func() {
		returnErr = errors.Join(returnErr, resourcecleanup.Close(destination, "restored volume image"))
		if returnErr != nil {
			returnErr = errors.Join(returnErr, resourcecleanup.Remove(destinationPath, "incomplete restored volume image"))
		}
	}()
	if err := destination.Truncate(manifest.VolumeSizeBytes); err != nil {
		return fmt.Errorf("size restored volume image: %w", err)
	}
	for _, span := range planRanges(manifest.Entries) {
		if err := restoreRange(ctx, destination, decoder, manifest, packs[span.artifactID], span); err != nil {
			return err
		}
	}
	return nil
}

// openPacks rejects a manifest that references a pack the caller did not
// provide before any data is written.
func openPacks(manifest Manifest, provided map[string]Pack) (map[string]openedPack, error) {
	referenced := manifest.ReferencedArtifactIDs()
	packs := make(map[string]openedPack, len(referenced))
	for _, artifactID := range referenced {
		pack, exists := provided[artifactID]
		if !exists || pack.Ranges == nil {
			return nil, fmt.Errorf("backup manifest references pack %s that was not provided", artifactID)
		}
		aead, err := newAEAD(pack.DataKey)
		if err != nil {
			return nil, fmt.Errorf("pack %s: %w", artifactID, err)
		}
		packs[artifactID] = openedPack{aead: aead, ranges: pack.Ranges}
	}
	return packs, nil
}

// planRanges coalesces consecutive entries stored back to back in the same
// pack into one read.
func planRanges(entries []Entry) []packRange {
	var ranges []packRange
	for _, entry := range entries {
		if count := len(ranges); count > 0 {
			last := &ranges[count-1]
			if last.artifactID == entry.PackArtifactID &&
				last.offset+last.length == entry.Offset &&
				last.length+entry.Length <= maxRangeBytes {
				last.length += entry.Length
				last.entries = append(last.entries, entry)
				continue
			}
		}
		ranges = append(ranges, packRange{
			artifactID: entry.PackArtifactID, offset: entry.Offset,
			length: entry.Length, entries: []Entry{entry},
		})
	}
	return ranges
}

func restoreRange(
	ctx context.Context,
	destination *os.File,
	decoder *zstd.Decoder,
	manifest Manifest,
	pack openedPack,
	span packRange,
) (returnErr error) {
	body, err := pack.ranges.ReadRange(ctx, span.offset, span.length)
	if err != nil {
		return fmt.Errorf("read pack %s range: %w", span.artifactID, err)
	}
	defer func() {
		returnErr = errors.Join(returnErr, resourcecleanup.Close(body, "pack range"))
	}()
	sealed := make([]byte, maxChunkBytes)
	for _, entry := range span.entries {
		if err := ctx.Err(); err != nil {
			return err
		}
		chunk := sealed[:entry.Length]
		if _, err := io.ReadFull(body, chunk); err != nil {
			return fmt.Errorf("read block %d from pack %s: %w", entry.Index, span.artifactID, err)
		}
		block, err := openChunk(pack.aead, decoder, manifest.VolumeID, entry.Index, chunk)
		if err != nil {
			return err
		}
		if int64(len(block)) != blockLength(manifest.VolumeSizeBytes, entry.Index) {
			return fmt.Errorf("block %d restored %d bytes, expected %d", entry.Index, len(block), blockLength(manifest.VolumeSizeBytes, entry.Index))
		}
		digest := sha256.Sum256(block)
		if hex.EncodeToString(digest[:]) != entry.SHA256 {
			return fmt.Errorf("block %d SHA-256 verification failed", entry.Index)
		}
		if _, err := destination.WriteAt(block, entry.Index*BlockSize); err != nil {
			return fmt.Errorf("write restored block %d: %w", entry.Index, err)
		}
	}
	return nil
}
