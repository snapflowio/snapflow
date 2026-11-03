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
	"crypto/cipher"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/klauspost/compress/zstd"
)

type BackupRequest struct {
	VolumeID   string
	ArtifactID string
	DataKey    string
	// Base is the previous backup of the same volume; blocks whose digest
	// matches its entry keep pointing at the previous pack.
	Base *Manifest
}

type BackupResult struct {
	Manifest      Manifest
	PackSizeBytes int64
	ChangedBytes  int64
}

// Backup writes every changed non-zero block of source to pack as
// nonce||ciphertext chunks and returns the manifest describing the volume.
func Backup(ctx context.Context, source *os.File, pack io.Writer, request BackupRequest) (BackupResult, error) {
	sizeBytes, err := backupSize(source, request)
	if err != nil {
		return BackupResult{}, err
	}
	aead, err := newAEAD(request.DataKey)
	if err != nil {
		return BackupResult{}, err
	}
	encoder, err := newEncoder()
	if err != nil {
		return BackupResult{}, err
	}
	writer := &blockWriter{
		source: source, pack: pack, request: request, aead: aead, encoder: encoder,
		base: baseEntries(request.Base), sizeBytes: sizeBytes,
		buffer: make([]byte, BlockSize), zero: make([]byte, BlockSize),
		result: BackupResult{Manifest: Manifest{
			FormatVersion: FormatVersion, VolumeID: request.VolumeID, ArtifactID: request.ArtifactID,
			VolumeSizeBytes: sizeBytes, BlockSizeBytes: BlockSize, Entries: make([]Entry, 0),
		}},
	}
	walkErr := forEachDataBlock(source, sizeBytes, func(index int64) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		return writer.writeBlock(index)
	})
	if closeErr := encoder.Close(); walkErr != nil || closeErr != nil {
		return BackupResult{}, errors.Join(walkErr, closeErr)
	}
	return writer.result, nil
}

// backupSize validates the request against source and returns the volume size.
func backupSize(source *os.File, request BackupRequest) (int64, error) {
	if request.VolumeID == "" || request.ArtifactID == "" {
		return 0, errors.New("backup volume and artifact identities are required")
	}
	if request.Base != nil && request.Base.VolumeID != request.VolumeID {
		return 0, fmt.Errorf("base backup %s belongs to another volume", request.Base.ArtifactID)
	}
	info, err := source.Stat()
	if err != nil {
		return 0, fmt.Errorf("stat volume snapshot: %w", err)
	}
	if info.Size() <= 0 {
		return 0, errors.New("volume snapshot is empty")
	}
	return info.Size(), nil
}

// baseEntries indexes the previous backup's entries by block.
func baseEntries(base *Manifest) map[int64]Entry {
	entries := make(map[int64]Entry)
	if base != nil {
		for _, entry := range base.Entries {
			entries[entry.Index] = entry
		}
	}
	return entries
}

// blockWriter seals the changed blocks of one backup into its pack and
// records every non-zero block in the manifest.
type blockWriter struct {
	source    *os.File
	pack      io.Writer
	request   BackupRequest
	aead      cipher.AEAD
	encoder   *zstd.Encoder
	base      map[int64]Entry
	sizeBytes int64
	buffer    []byte
	zero      []byte
	result    BackupResult
}

func (w *blockWriter) writeBlock(index int64) error {
	block := w.buffer[:blockLength(w.sizeBytes, index)]
	if _, err := w.source.ReadAt(block, index*BlockSize); err != nil {
		return fmt.Errorf("read volume block %d: %w", index, err)
	}
	if bytes.Equal(block, w.zero[:len(block)]) {
		return nil
	}
	digest := sha256.Sum256(block)
	sum := hex.EncodeToString(digest[:])
	if previous, exists := w.base[index]; exists && previous.SHA256 == sum {
		w.result.Manifest.Entries = append(w.result.Manifest.Entries, previous)
		return nil
	}
	sealed, err := sealChunk(w.aead, w.encoder, w.request.VolumeID, index, block)
	if err != nil {
		return err
	}
	if _, err := w.pack.Write(sealed); err != nil {
		return fmt.Errorf("write volume block %d to pack: %w", index, err)
	}
	w.result.Manifest.Entries = append(w.result.Manifest.Entries, Entry{
		Index: index, SHA256: sum, PackArtifactID: w.request.ArtifactID,
		Offset: w.result.PackSizeBytes, Length: int64(len(sealed)),
	})
	w.result.PackSizeBytes += int64(len(sealed))
	w.result.ChangedBytes += int64(len(block))
	return nil
}
