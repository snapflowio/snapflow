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
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"

	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/partial"
	"github.com/google/go-containerregistry/pkg/v1/types"
	"github.com/klauspost/compress/zstd"
)

const (
	DiskArtifactType                            = "application/vnd.snapflow.guest.disk.v1"
	DiskLayerMediaType          types.MediaType = "application/vnd.snapflow.guest.disk.erofs.v1+zstd"
	diskDigestAnnotation                        = "io.snapflow.disk.erofs.digest"
	diskSizeAnnotation                          = "io.snapflow.disk.erofs.size"
	diskSourceAnnotation                        = "io.snapflow.disk.source"
	emptyConfigMediaType        types.MediaType = "application/vnd.oci.empty.v1+json"
	ociManifestSchemaVersion                    = 2
	diskArtifactFileName                        = "disk.erofs"
	diskLayerFileName                           = "disk.erofs.zst"
	diskLayerEncoderConcurrency                 = 1
)

const emptyConfigJSON = "{}"

type DiskArtifactRequest struct {
	Source  gcr.Image
	WorkDir string
}

func (f *ErofsFormatter) BuildDiskArtifact(ctx context.Context, request DiskArtifactRequest) (Image, error) {
	sourceDigest, err := request.Source.Digest()
	if err != nil {
		return nil, fmt.Errorf("read source image digest: %w", err)
	}
	diskPath := filepath.Join(request.WorkDir, diskArtifactFileName)
	if _, err := f.Convert(ctx, ConvertRequest{
		Image: request.Source, DiskPath: diskPath, WorkDir: request.WorkDir, Identity: sourceDigest.String(),
	}); err != nil {
		return nil, fmt.Errorf("build EROFS filesystem: %w", err)
	}
	layer, diskDigest, diskSize, err := compressDisk(diskPath, filepath.Join(request.WorkDir, diskLayerFileName))
	if err != nil {
		return nil, err
	}
	manifest, err := json.Marshal(gcr.Manifest{
		SchemaVersion: ociManifestSchemaVersion,
		MediaType:     types.OCIManifestSchema1,
		ArtifactType:  DiskArtifactType,
		Config: gcr.Descriptor{
			MediaType: emptyConfigMediaType, Size: int64(len(emptyConfigJSON)), Digest: emptyConfigDigest(),
		},
		Layers: []gcr.Descriptor{{
			MediaType: DiskLayerMediaType, Size: layer.size, Digest: layer.digest,
			Annotations: map[string]string{
				diskDigestAnnotation: diskDigest.String(),
				diskSizeAnnotation:   strconv.FormatInt(diskSize, 10),
			},
		}},
		Annotations: map[string]string{diskSourceAnnotation: sourceDigest.String()},
	})
	if err != nil {
		return nil, fmt.Errorf("encode disk artifact manifest: %w", err)
	}
	return partial.CompressedToImage(&diskArtifact{manifest: manifest, layer: layer})
}

func compressDisk(diskPath, layerPath string) (layer *diskLayer, diskDigest gcr.Hash, diskSize int64, resultErr error) {
	source, err := os.Open(diskPath)
	if err != nil {
		return nil, gcr.Hash{}, 0, fmt.Errorf("open EROFS filesystem: %w", err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, wrapCloseError("close EROFS filesystem", source.Close()))
	}()
	target, err := os.Create(layerPath)
	if err != nil {
		return nil, gcr.Hash{}, 0, fmt.Errorf("create disk artifact layer: %w", err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, wrapCloseError("close disk artifact layer", target.Close()))
	}()
	layerHash := sha256.New()
	encoder, err := zstd.NewWriter(
		io.MultiWriter(target, layerHash),
		zstd.WithEncoderLevel(zstd.SpeedBetterCompression),
		zstd.WithEncoderConcurrency(diskLayerEncoderConcurrency),
	)
	if err != nil {
		return nil, gcr.Hash{}, 0, fmt.Errorf("create zstd encoder: %w", err)
	}
	diskHash := sha256.New()
	diskSize, err = io.Copy(encoder, io.TeeReader(source, diskHash))
	if err != nil {
		return nil, gcr.Hash{}, 0, errors.Join(fmt.Errorf("compress EROFS filesystem: %w", err), encoder.Close())
	}
	if err := encoder.Close(); err != nil {
		return nil, gcr.Hash{}, 0, fmt.Errorf("finish zstd stream: %w", err)
	}
	info, err := target.Stat()
	if err != nil {
		return nil, gcr.Hash{}, 0, fmt.Errorf("stat disk artifact layer: %w", err)
	}
	return &diskLayer{path: layerPath, digest: sha256Hash(layerHash.Sum(nil)), size: info.Size()},
		sha256Hash(diskHash.Sum(nil)), diskSize, nil
}

func sha256Hash(sum []byte) gcr.Hash {
	return gcr.Hash{Algorithm: sha256Algorithm, Hex: hex.EncodeToString(sum)}
}

func emptyConfigDigest() gcr.Hash {
	sum := sha256.Sum256([]byte(emptyConfigJSON))
	return sha256Hash(sum[:])
}

type diskArtifact struct {
	manifest []byte
	layer    *diskLayer
}

func (a *diskArtifact) RawConfigFile() ([]byte, error) {
	return []byte(emptyConfigJSON), nil
}

func (a *diskArtifact) MediaType() (types.MediaType, error) {
	return types.OCIManifestSchema1, nil
}

func (a *diskArtifact) RawManifest() ([]byte, error) {
	return bytes.Clone(a.manifest), nil
}

func (a *diskArtifact) LayerByDigest(digest gcr.Hash) (partial.CompressedLayer, error) {
	if digest == a.layer.digest {
		return a.layer, nil
	}
	return nil, fmt.Errorf("disk artifact has no blob %s", digest)
}

type diskLayer struct {
	path   string
	digest gcr.Hash
	size   int64
}

func (l *diskLayer) Digest() (gcr.Hash, error) {
	return l.digest, nil
}

func (l *diskLayer) Compressed() (io.ReadCloser, error) {
	return os.Open(l.path)
}

func (l *diskLayer) Size() (int64, error) {
	return l.size, nil
}

func (l *diskLayer) MediaType() (types.MediaType, error) {
	return DiskLayerMediaType, nil
}
