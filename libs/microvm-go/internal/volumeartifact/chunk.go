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
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/binary"
	"fmt"

	"github.com/klauspost/compress/zstd"
)

const (
	DataKeyBytes = 32
	BlockSize    = 4 << 20

	// chunkOverheadBytes bounds the GCM nonce and tag plus the zstd framing
	// added to an incompressible block.
	chunkOverheadBytes = 64 << 10
	maxChunkBytes      = BlockSize + chunkOverheadBytes

	chunkAADDomain    = "snapflow.volume-backup.chunk.v1"
	manifestAADDomain = "snapflow.volume-backup.manifest.v1"
	aadSeparator      = byte(0)
	// aadSeparators joins the three fields of each additional data.
	aadSeparators = 2
)

// newAEAD returns AES-256-GCM that prepends a random 12-byte nonce to every
// sealed message, so callers never manage nonces themselves.
func newAEAD(encodedKey string) (cipher.AEAD, error) {
	key, err := base64.StdEncoding.DecodeString(encodedKey)
	if err != nil {
		return nil, fmt.Errorf("decode backup data key: %w", err)
	}
	if len(key) != DataKeyBytes {
		return nil, fmt.Errorf("backup data key must contain %d bytes", DataKeyBytes)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("initialize backup cipher: %w", err)
	}
	aead, err := cipher.NewGCMWithRandomNonce(block)
	if err != nil {
		return nil, fmt.Errorf("initialize backup AEAD: %w", err)
	}
	return aead, nil
}

// chunkAAD binds a chunk to its volume and block index so a chunk cannot be
// replayed into another block or another volume encrypted with the same key.
func chunkAAD(volumeID string, index int64) []byte {
	aad := make([]byte, 0, len(chunkAADDomain)+len(volumeID)+aadSeparators+binary.Size(uint64(0)))
	aad = append(aad, chunkAADDomain...)
	aad = append(aad, aadSeparator)
	aad = append(aad, volumeID...)
	aad = append(aad, aadSeparator)
	return binary.BigEndian.AppendUint64(aad, uint64(index))
}

func manifestAAD(volumeID, artifactID string) []byte {
	aad := make([]byte, 0, len(manifestAADDomain)+len(volumeID)+len(artifactID)+aadSeparators)
	aad = append(aad, manifestAADDomain...)
	aad = append(aad, aadSeparator)
	aad = append(aad, volumeID...)
	aad = append(aad, aadSeparator)
	return append(aad, artifactID...)
}

func newEncoder() (*zstd.Encoder, error) {
	encoder, err := zstd.NewWriter(nil)
	if err != nil {
		return nil, fmt.Errorf("initialize backup compressor: %w", err)
	}
	return encoder, nil
}

func newDecoder(maxDecodedBytes int64) (*zstd.Decoder, error) {
	decoder, err := zstd.NewReader(nil, zstd.WithDecoderConcurrency(1), zstd.WithDecoderMaxMemory(uint64(maxDecodedBytes)))
	if err != nil {
		return nil, fmt.Errorf("initialize backup decompressor: %w", err)
	}
	return decoder, nil
}

func sealChunk(aead cipher.AEAD, encoder *zstd.Encoder, volumeID string, index int64, block []byte) ([]byte, error) {
	sealed := aead.Seal(nil, nil, encoder.EncodeAll(block, nil), chunkAAD(volumeID, index))
	if len(sealed) > maxChunkBytes {
		return nil, fmt.Errorf("sealed block %d exceeds %d bytes", index, maxChunkBytes)
	}
	return sealed, nil
}

func openChunk(aead cipher.AEAD, decoder *zstd.Decoder, volumeID string, index int64, sealed []byte) ([]byte, error) {
	compressed, err := aead.Open(nil, nil, sealed, chunkAAD(volumeID, index))
	if err != nil {
		return nil, fmt.Errorf("authenticate block %d: %w", index, err)
	}
	block, err := decoder.DecodeAll(compressed, nil)
	if err != nil {
		return nil, fmt.Errorf("decompress block %d: %w", index, err)
	}
	return block, nil
}
