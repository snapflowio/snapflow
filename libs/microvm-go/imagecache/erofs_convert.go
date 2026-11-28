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
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"time"

	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/types"
	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/internal/hosttool"
)

const (
	erofsCompression           = "-zlz4"
	erofsBuildTimestamp        = "-T0"
	formatterStreamBufferBytes = 1 << 20
	formatterOutputLimit       = 64 << 10
	rootfsLayersType           = "layers"
)

type ConvertRequest struct {
	Image    gcr.Image
	DiskPath string
	WorkDir  string
	Identity string
}

type LayerConversion struct {
	Digest            string
	MediaType         string
	CompressedBytes   int64
	UncompressedBytes int64
	Duration          time.Duration
}

type ConversionReport struct {
	Layers         []LayerConversion
	StreamDuration time.Duration
	MergeDuration  time.Duration
	DiskBytes      int64
}

func (f *ErofsFormatter) Convert(ctx context.Context, request ConvertRequest) (ConversionReport, error) {
	layers, diffIDs, err := rootfsLayers(request.Image)
	if err != nil {
		return ConversionReport{}, err
	}
	filesystemUUID, err := filesystemUUID(request.Identity)
	if err != nil {
		return ConversionReport{}, err
	}
	commandContext, cancel := context.WithCancel(ctx)
	defer cancel()
	command := exec.CommandContext(commandContext, f.path, f.arguments(filesystemUUID, request.DiskPath)...)
	command.Env = []string{"TMPDIR=" + request.WorkDir}
	diagnostics := &boundedBuffer{limit: formatterOutputLimit}
	command.Stdout, command.Stderr = diagnostics, diagnostics
	stdin, err := command.StdinPipe()
	if err != nil {
		return ConversionReport{}, fmt.Errorf("open mkfs.erofs input: %w", err)
	}
	if err := command.Start(); err != nil {
		return ConversionReport{}, fmt.Errorf("start mkfs.erofs: %w", err)
	}
	startedAt := time.Now()
	report := ConversionReport{}
	report.Layers, err = streamLayers(stdin, layers, diffIDs)
	err = errors.Join(err, wrapCloseError("close mkfs.erofs input", stdin.Close()))
	report.StreamDuration = time.Since(startedAt)
	if err != nil {
		cancel()
	}
	if waitErr := command.Wait(); waitErr != nil {
		err = errors.Join(err, fmt.Errorf("mkfs.erofs: %w", hosttool.Failure(waitErr, diagnostics.String())))
	}
	if err != nil {
		return ConversionReport{}, err
	}
	report.MergeDuration = time.Since(startedAt) - report.StreamDuration
	if report.DiskBytes, err = alignDiskFile(request.DiskPath); err != nil {
		return ConversionReport{}, err
	}
	return report, nil
}

func (f *ErofsFormatter) arguments(filesystemUUID, diskPath string) []string {
	return []string{
		"--tar=f", "--aufs", "--ovlfs-strip=1", "--quiet",
		erofsCompression, erofsBuildTimestamp, "--mkfs-time", "-U", filesystemUUID,
		diskPath,
	}
}

func streamLayers(output io.Writer, layers []gcr.Layer, diffIDs []gcr.Hash) ([]LayerConversion, error) {
	buffered := bufio.NewWriterSize(output, formatterStreamBufferBytes)
	flattener := newLayerFlattener(buffered)
	if err := flattener.writeRoot(); err != nil {
		return nil, fmt.Errorf("write image root: %w", err)
	}
	reports := make([]LayerConversion, 0, len(layers))
	for index, layer := range layers {
		report, err := streamLayer(flattener, layer, diffIDs[index])
		if err != nil {
			return nil, fmt.Errorf("layer %d: %w", index, err)
		}
		reports = append(reports, report)
	}
	if err := flattener.close(); err != nil {
		return nil, fmt.Errorf("finish image stream: %w", err)
	}
	if err := buffered.Flush(); err != nil {
		return nil, fmt.Errorf("flush image stream: %w", err)
	}
	return reports, nil
}

func streamLayer(flattener *layerFlattener, layer gcr.Layer, diffID gcr.Hash) (report LayerConversion, resultErr error) {
	startedAt := time.Now()
	digest, err := layer.Digest()
	if err != nil {
		return LayerConversion{}, fmt.Errorf("read layer digest: %w", err)
	}
	mediaType, err := layer.MediaType()
	if err != nil {
		return LayerConversion{}, fmt.Errorf("read layer media type: %w", err)
	}
	size, err := layer.Size()
	if err != nil {
		return LayerConversion{}, fmt.Errorf("read layer size: %w", err)
	}
	stream, err := openLayer(layer)
	if err != nil {
		return LayerConversion{}, err
	}
	defer func() {
		resultErr = errors.Join(resultErr, stream.Close())
	}()
	if err := flattener.apply(stream); err != nil {
		return LayerConversion{}, err
	}
	if err := stream.verify(diffID); err != nil {
		return LayerConversion{}, err
	}
	return LayerConversion{
		Digest: digest.String(), MediaType: string(mediaType),
		CompressedBytes: size, UncompressedBytes: stream.read,
		Duration: time.Since(startedAt),
	}, nil
}

func rootfsLayers(image gcr.Image) ([]gcr.Layer, []gcr.Hash, error) {
	manifest, err := image.Manifest()
	if err != nil {
		return nil, nil, fmt.Errorf("read image manifest: %w", err)
	}
	config, err := image.ConfigFile()
	if err != nil {
		return nil, nil, fmt.Errorf("read image config: %w", err)
	}
	if manifest.Config.MediaType != types.OCIConfigJSON && manifest.Config.MediaType != types.DockerConfigJSON {
		return nil, nil, fmt.Errorf("image config has unsupported media type %s", manifest.Config.MediaType)
	}
	if config.RootFS.Type != rootfsLayersType {
		return nil, nil, fmt.Errorf("image has unsupported rootfs type %s", config.RootFS.Type)
	}
	if len(config.RootFS.DiffIDs) != len(manifest.Layers) {
		return nil, nil, fmt.Errorf("image rootfs diff_ids has %d entries but manifest has %d layers", len(config.RootFS.DiffIDs), len(manifest.Layers))
	}
	layers, err := image.Layers()
	if err != nil {
		return nil, nil, fmt.Errorf("read image layers: %w", err)
	}
	return layers, config.RootFS.DiffIDs, nil
}

func filesystemUUID(identity string) (string, error) {
	digest, err := gcr.NewHash(identity)
	if err != nil {
		return "", fmt.Errorf("parse image identity %q: %w", identity, err)
	}
	raw, err := hex.DecodeString(digest.Hex)
	if err != nil || len(raw) < len(uuid.UUID{}) {
		return "", fmt.Errorf("image identity %q is not a hexadecimal digest", identity)
	}
	value, err := uuid.FromBytes(raw[:len(uuid.UUID{})])
	if err != nil {
		return "", fmt.Errorf("derive filesystem UUID: %w", err)
	}
	return value.String(), nil
}

type boundedBuffer struct {
	limit int
	data  []byte
}

func (b *boundedBuffer) Write(content []byte) (int, error) {
	if remaining := b.limit - len(b.data); remaining > 0 {
		b.data = append(b.data, content[:min(len(content), remaining)]...)
	}
	return len(content), nil
}

func (b *boundedBuffer) String() string {
	return string(b.data)
}
