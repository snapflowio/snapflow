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

package imagecache

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"hash"
	"io"

	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/types"
	"github.com/klauspost/compress/zstd"
	"github.com/klauspost/pgzip"
)

const (
	sha256Algorithm      = "sha256"
	layerReadBufferBytes = 1 << 20
)

type layerCompression uint8

const (
	layerUncompressed layerCompression = iota
	layerGzip
	layerZstd
)

func layerCompressions() map[types.MediaType]layerCompression {
	return map[types.MediaType]layerCompression{
		types.OCIUncompressedLayer:           layerUncompressed,
		types.OCIUncompressedRestrictedLayer: layerUncompressed,
		types.DockerUncompressedLayer:        layerUncompressed,
		types.OCILayer:                       layerGzip,
		types.OCIRestrictedLayer:             layerGzip,
		types.DockerLayer:                    layerGzip,
		types.DockerForeignLayer:             layerGzip,
		types.OCILayerZStd:                   layerZstd,
	}
}

type layerStream struct {
	reader       io.Reader
	decompressor io.Closer
	compressed   io.Closer
	hash         hash.Hash
	read         int64
}

func openLayer(layer gcr.Layer) (*layerStream, error) {
	mediaType, err := layer.MediaType()
	if err != nil {
		return nil, fmt.Errorf("read layer media type: %w", err)
	}
	compression, supported := layerCompressions()[mediaType]
	if !supported {
		return nil, fmt.Errorf("unsupported layer media type %q", mediaType)
	}
	compressed, err := layer.Compressed()
	if err != nil {
		return nil, fmt.Errorf("open layer blob: %w", err)
	}
	buffered := bufio.NewReaderSize(compressed, layerReadBufferBytes)
	stream := &layerStream{compressed: compressed, hash: sha256.New()}
	var decompressed io.Reader
	switch compression {
	case layerGzip:
		reader, err := pgzip.NewReader(buffered)
		if err != nil {
			return nil, errors.Join(fmt.Errorf("open gzip layer: %w", err), compressed.Close())
		}
		decompressed, stream.decompressor = reader, reader
	case layerZstd:
		reader, err := zstd.NewReader(buffered)
		if err != nil {
			return nil, errors.Join(fmt.Errorf("open zstd layer: %w", err), compressed.Close())
		}
		closer := reader.IOReadCloser()
		decompressed, stream.decompressor = closer, closer
	default:
		decompressed = buffered
	}
	stream.reader = io.TeeReader(decompressed, stream.hash)
	return stream, nil
}

func (s *layerStream) Read(buffer []byte) (int, error) {
	count, err := s.reader.Read(buffer)
	s.read += int64(count)
	return count, err
}

func (s *layerStream) verify(diffID gcr.Hash) error {
	if _, err := io.Copy(io.Discard, s); err != nil {
		return fmt.Errorf("read layer padding: %w", err)
	}
	if diffID.Algorithm != sha256Algorithm {
		return fmt.Errorf("unsupported layer diff ID algorithm %q", diffID.Algorithm)
	}
	if actual := hex.EncodeToString(s.hash.Sum(nil)); actual != diffID.Hex {
		return fmt.Errorf("layer diff ID is %s:%s, expected %s", sha256Algorithm, actual, diffID)
	}
	return nil
}

func (s *layerStream) Close() error {
	var closeErrors []error
	if s.decompressor != nil {
		closeErrors = append(closeErrors, wrapCloseError("close layer decompressor", s.decompressor.Close()))
	}
	closeErrors = append(closeErrors, wrapCloseError("close layer blob", s.compressed.Close()))
	return errors.Join(closeErrors...)
}
