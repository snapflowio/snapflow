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

package configdrive

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/filemode"
)

const (
	payloadMagic       = "SFCONFIG"
	payloadVersion     = uint32(1)
	headerBytes        = len(payloadMagic) + 4 + 4 + 4 + sha256.Size
	diskAlignmentBytes = 4096
	maxSectionBytes    = 16 * 1024 * 1024
	driveFileMode      = 0o644
)

var ErrInvalidPayload = errors.New("invalid config drive payload")

type header struct {
	Magic       [len(payloadMagic)]byte
	Version     uint32
	ConfigBytes uint32
	FileBytes   uint32
	PayloadSHA  [sha256.Size]byte
}

func Write(path string, cfg Config) error {
	encoded, err := json.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("encode guest config: %w", err)
	}
	image, err := encodePayload(encoded, cfg.InjectedFile)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create config-drive directory: %w", err)
	}
	if err := atomicfile.Replace(path, image, driveFileMode); err != nil {
		return fmt.Errorf("write config drive: %w", err)
	}
	if err := atomicfile.Commit(path); err != nil {
		return fmt.Errorf("commit config drive: %w", err)
	}
	return nil
}

func Read(reader io.ReaderAt) (Config, []byte, error) {
	raw := make([]byte, headerBytes)
	if _, err := reader.ReadAt(raw, 0); err != nil {
		return Config{}, nil, fmt.Errorf("read config drive header: %w", err)
	}
	var decoded header
	if err := binary.Read(bytes.NewReader(raw), binary.BigEndian, &decoded); err != nil {
		return Config{}, nil, fmt.Errorf("decode config drive header: %w", err)
	}
	if string(decoded.Magic[:]) != payloadMagic || decoded.Version != payloadVersion {
		return Config{}, nil, fmt.Errorf("%w: unsupported header", ErrInvalidPayload)
	}
	if decoded.ConfigBytes == 0 || decoded.ConfigBytes > maxSectionBytes || decoded.FileBytes > maxSectionBytes {
		return Config{}, nil, fmt.Errorf("%w: section sizes out of range", ErrInvalidPayload)
	}
	payload := make([]byte, int(decoded.ConfigBytes)+int(decoded.FileBytes))
	if _, err := reader.ReadAt(payload, int64(headerBytes)); err != nil {
		return Config{}, nil, fmt.Errorf("read config drive payload: %w", err)
	}
	if sha256.Sum256(payload) != decoded.PayloadSHA {
		return Config{}, nil, fmt.Errorf("%w: checksum mismatch", ErrInvalidPayload)
	}
	var cfg Config
	if err := json.Unmarshal(payload[:decoded.ConfigBytes], &cfg); err != nil {
		return Config{}, nil, fmt.Errorf("decode guest config: %w", err)
	}
	return cfg, payload[decoded.ConfigBytes:], nil
}

func encodePayload(config, file []byte) ([]byte, error) {
	if len(config) == 0 || len(config) > maxSectionBytes || len(file) > maxSectionBytes {
		return nil, fmt.Errorf("%w: section sizes out of range", ErrInvalidPayload)
	}
	payload := append(append(make([]byte, 0, len(config)+len(file)), config...), file...)
	encoded := header{
		Version:     payloadVersion,
		ConfigBytes: uint32(len(config)),
		FileBytes:   uint32(len(file)),
		PayloadSHA:  sha256.Sum256(payload),
	}
	copy(encoded.Magic[:], payloadMagic)
	var image bytes.Buffer
	if err := binary.Write(&image, binary.BigEndian, encoded); err != nil {
		return nil, fmt.Errorf("encode config drive header: %w", err)
	}
	image.Write(payload)
	padding := (diskAlignmentBytes - image.Len()%diskAlignmentBytes) % diskAlignmentBytes
	image.Write(make([]byte, padding))
	return image.Bytes(), nil
}
