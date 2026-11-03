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
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
)

const (
	FormatVersion = 1

	// maxManifestEntryBytes bounds one JSON-encoded entry; together with the
	// envelope it caps how much a manifest may decompress to for a volume.
	maxManifestEntryBytes = 256
	manifestEnvelopeBytes = 64 << 10
)

// Manifest lists every non-zero block of a volume and where its sealed chunk
// lives. Entries are sorted by block index; all-zero blocks are omitted and
// restore as holes.
type Manifest struct {
	FormatVersion   int     `json:"formatVersion"`
	VolumeID        string  `json:"volumeId"`
	ArtifactID      string  `json:"artifactId"`
	VolumeSizeBytes int64   `json:"volumeSizeBytes"`
	BlockSizeBytes  int64   `json:"blockSizeBytes"`
	Entries         []Entry `json:"entries"`
}

type Entry struct {
	Index          int64  `json:"index"`
	SHA256         string `json:"sha256"`
	PackArtifactID string `json:"packArtifactId"`
	Offset         int64  `json:"offset"`
	Length         int64  `json:"length"`
}

// ReferencedArtifactIDs returns the sorted distinct packs the manifest needs.
func (m Manifest) ReferencedArtifactIDs() []string {
	ids := make([]string, 0)
	seen := make(map[string]struct{})
	for _, entry := range m.Entries {
		if _, exists := seen[entry.PackArtifactID]; exists {
			continue
		}
		seen[entry.PackArtifactID] = struct{}{}
		ids = append(ids, entry.PackArtifactID)
	}
	slices.Sort(ids)
	return ids
}

func blockCount(volumeSizeBytes int64) int64 {
	return (volumeSizeBytes + BlockSize - 1) / BlockSize
}

func blockLength(volumeSizeBytes, index int64) int64 {
	return min(BlockSize, volumeSizeBytes-index*BlockSize)
}

// ManifestSizeLimit bounds both the sealed and the decompressed manifest of a
// volume of the given size.
func ManifestSizeLimit(volumeSizeBytes int64) int64 {
	return manifestEnvelopeBytes + blockCount(volumeSizeBytes)*maxManifestEntryBytes
}

// PackSizeLimit bounds the pack a single backup of the volume can produce.
func PackSizeLimit(volumeSizeBytes int64) int64 {
	return blockCount(volumeSizeBytes) * maxChunkBytes
}

func SealManifest(manifest Manifest, dataKey string) ([]byte, error) {
	if err := manifest.validate(); err != nil {
		return nil, err
	}
	aead, err := newAEAD(dataKey)
	if err != nil {
		return nil, err
	}
	encoded, err := json.Marshal(manifest)
	if err != nil {
		return nil, fmt.Errorf("encode backup manifest: %w", err)
	}
	encoder, err := newEncoder()
	if err != nil {
		return nil, err
	}
	compressed := encoder.EncodeAll(encoded, nil)
	if err := encoder.Close(); err != nil {
		return nil, fmt.Errorf("close backup manifest compressor: %w", err)
	}
	return aead.Seal(nil, nil, compressed, manifestAAD(manifest.VolumeID, manifest.ArtifactID)), nil
}

// OpenManifest authenticates a sealed manifest against the volume and backup
// it claims to describe and rejects manifests for volumes larger than
// maxVolumeSizeBytes.
func OpenManifest(sealed []byte, dataKey, volumeID, artifactID string, maxVolumeSizeBytes int64) (Manifest, error) {
	if maxVolumeSizeBytes <= 0 {
		return Manifest{}, errors.New("maximum backup volume size must be positive")
	}
	aead, err := newAEAD(dataKey)
	if err != nil {
		return Manifest{}, err
	}
	compressed, err := aead.Open(nil, nil, sealed, manifestAAD(volumeID, artifactID))
	if err != nil {
		return Manifest{}, fmt.Errorf("authenticate backup manifest %s: %w", artifactID, err)
	}
	decoder, err := newDecoder(ManifestSizeLimit(maxVolumeSizeBytes))
	if err != nil {
		return Manifest{}, err
	}
	defer decoder.Close()
	encoded, err := decoder.DecodeAll(compressed, nil)
	if err != nil {
		return Manifest{}, fmt.Errorf("decompress backup manifest %s: %w", artifactID, err)
	}
	jsonDecoder := json.NewDecoder(bytes.NewReader(encoded))
	jsonDecoder.DisallowUnknownFields()
	var manifest Manifest
	if err := jsonDecoder.Decode(&manifest); err != nil {
		return Manifest{}, fmt.Errorf("decode backup manifest %s: %w", artifactID, err)
	}
	if manifest.VolumeID != volumeID || manifest.ArtifactID != artifactID {
		return Manifest{}, fmt.Errorf("backup manifest %s does not describe the requested volume backup", artifactID)
	}
	if manifest.VolumeSizeBytes > maxVolumeSizeBytes {
		return Manifest{}, fmt.Errorf("backup manifest %s describes %d bytes, more than %d", artifactID, manifest.VolumeSizeBytes, maxVolumeSizeBytes)
	}
	if err := manifest.validate(); err != nil {
		return Manifest{}, err
	}
	return manifest, nil
}

func (m Manifest) validate() error {
	if m.FormatVersion != FormatVersion {
		return fmt.Errorf("backup manifest format %d is not supported", m.FormatVersion)
	}
	if m.VolumeID == "" || m.ArtifactID == "" {
		return errors.New("backup manifest must name its volume and artifact")
	}
	if m.BlockSizeBytes != BlockSize {
		return fmt.Errorf("backup manifest block size %d must be %d", m.BlockSizeBytes, BlockSize)
	}
	if m.VolumeSizeBytes <= 0 {
		return errors.New("backup manifest volume size must be positive")
	}
	blocks := blockCount(m.VolumeSizeBytes)
	previous := int64(-1)
	for _, entry := range m.Entries {
		if entry.Index <= previous || entry.Index >= blocks {
			return fmt.Errorf("backup manifest block index %d is out of order or range", entry.Index)
		}
		previous = entry.Index
		if err := entry.validate(); err != nil {
			return err
		}
	}
	return nil
}

func (e Entry) validate() error {
	if digest, err := hex.DecodeString(e.SHA256); err != nil || len(digest) != sha256.Size {
		return fmt.Errorf("backup manifest block %d has an invalid SHA-256", e.Index)
	}
	if e.PackArtifactID == "" {
		return fmt.Errorf("backup manifest block %d names no pack", e.Index)
	}
	if e.Offset < 0 || e.Length <= 0 || e.Length > maxChunkBytes {
		return fmt.Errorf("backup manifest block %d has an invalid pack range", e.Index)
	}
	return nil
}
