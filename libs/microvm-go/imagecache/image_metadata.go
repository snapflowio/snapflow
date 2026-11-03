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
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/snapflowio/microvm-go/internal/filemode"
)

const imageMetadataFile = "metadata.json"

func (s *ImageStore) Write(record ImageRecord) (resultErr error) {
	if record.Repository == "" || record.Digest == "" {
		return errors.New("image record repository and digest are required")
	}
	record.UpdatedAt = time.Now().UTC()
	if record.CreatedAt.IsZero() {
		record.CreatedAt = record.UpdatedAt
	}

	target := s.paths.ImageMetadata(record.Repository, digestHex(record.Digest))
	if err := os.MkdirAll(filepath.Dir(target), filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create image metadata directory: %w", err)
	}

	data, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		return fmt.Errorf("encode image metadata: %w", err)
	}

	temp, err := os.CreateTemp(filepath.Dir(target), ".image-*.json")
	if err != nil {
		return fmt.Errorf("create temporary image metadata: %w", err)
	}
	tempPath := temp.Name()
	cleanup := true
	defer func() {
		if cleanup {
			if removeErr := os.Remove(tempPath); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
				resultErr = errors.Join(resultErr, fmt.Errorf("remove temporary image metadata: %w", removeErr))
			}
		}
	}()

	if _, err := temp.Write(data); err != nil {
		return errors.Join(
			fmt.Errorf("write temporary image metadata: %w", err),
			wrapCloseError("close temporary image metadata", temp.Close()),
		)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("close temporary image metadata: %w", err)
	}
	if err := os.Rename(tempPath, target); err != nil {
		return fmt.Errorf("install image metadata: %w", err)
	}
	cleanup = false
	return nil
}

func (s *ImageStore) Read(repository, digest string) (ImageRecord, error) {
	data, err := os.ReadFile(s.paths.ImageMetadata(repository, digestHex(digest)))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return ImageRecord{}, os.ErrNotExist
		}
		return ImageRecord{}, fmt.Errorf("read image metadata: %w", err)
	}
	var record ImageRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return ImageRecord{}, fmt.Errorf("decode image metadata: %w", err)
	}
	return record, nil
}

func (s *ImageStore) ReadReference(imageRef string) (ImageRecord, error) {
	ref, err := ParseImageRef(imageRef)
	if err != nil {
		return ImageRecord{}, err
	}
	if ref.IsDigest() {
		record, err := s.Read(ref.Repository(), ref.Digest())
		if !errors.Is(err, os.ErrNotExist) {
			return record, err
		}
		return s.readLinked(ref.Repository(), s.paths.ImageDigestAliasLink(ref.Repository(), ref.DigestHex()))
	}
	if ref.Tag() == "" {
		return ImageRecord{}, os.ErrNotExist
	}
	return s.readLinked(ref.Repository(), s.paths.ImageTagLink(ref.Repository(), ref.Tag()))
}

func (s *ImageStore) readLinked(repository, link string) (ImageRecord, error) {
	digestHexValue, err := os.Readlink(link)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return ImageRecord{}, os.ErrNotExist
		}
		return ImageRecord{}, fmt.Errorf("read image reference link: %w", err)
	}
	return s.Read(repository, digestHexValue)
}

func (s *ImageStore) LoadImage(imageRef string) (ImageRecord, Image, error) {
	record, err := s.ReadReference(imageRef)
	if err != nil {
		return ImageRecord{}, nil, err
	}
	image, err := s.layout.Image(record.DigestHex())
	if err != nil {
		return ImageRecord{}, nil, err
	}
	return record, image, nil
}

func (s *ImageStore) Count() (int, error) {
	count := 0
	err := filepath.WalkDir(s.paths.ImagesDir(), func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || entry.Name() != imageMetadataFile {
			return nil
		}
		count++
		return nil
	})
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	return count, err
}

func (s *ImageStore) ReadyDigests() ([]string, error) {
	if _, err := os.Stat(s.paths.ImagesDir()); errors.Is(err, os.ErrNotExist) {
		return []string{}, nil
	} else if err != nil {
		return nil, fmt.Errorf("inspect prepared image directory: %w", err)
	}
	digests := make(map[string]struct{})
	err := filepath.WalkDir(s.paths.ImagesDir(), func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() || entry.Name() != imageMetadataFile {
			return nil
		}
		record, ready, err := s.readyRecordAt(path)
		if err != nil || !ready {
			return err
		}
		digests[record.Digest] = struct{}{}
		return nil
	})
	if err != nil {
		return nil, err
	}
	result := make([]string, 0, len(digests))
	for digest := range digests {
		result = append(result, digest)
	}
	sort.Strings(result)
	return result, nil
}

func (s *ImageStore) readyRecordAt(path string) (ImageRecord, bool, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return ImageRecord{}, false, fmt.Errorf("read prepared image metadata %s: %w", path, err)
	}
	record := ImageRecord{}
	if err := json.Unmarshal(data, &record); err != nil {
		return ImageRecord{}, false, fmt.Errorf("decode prepared image metadata %s: %w", path, err)
	}
	if record.Status != ImageStatusReady {
		return record, false, nil
	}
	platform, err := ParsePlatform(record.Platform)
	if err != nil {
		return ImageRecord{}, false, fmt.Errorf("parse prepared image platform %s: %w", path, err)
	}
	if _, err := s.validateReady(record, platform); err != nil {
		slog.Debug("prepared image metadata is not ready", "path", path, "error", err)
		return record, false, nil
	}
	return record, true, nil
}

func (s *ImageStore) Remove(imageRef string) error {
	ref, err := ParseImageRef(imageRef)
	if err != nil {
		return err
	}

	if ref.IsDigest() {
		alias := s.paths.ImageDigestAliasLink(ref.Repository(), ref.DigestHex())
		if err := os.Remove(alias); !errors.Is(err, os.ErrNotExist) {
			return err
		}
		return os.RemoveAll(s.paths.ImageDigestDir(ref.Repository(), ref.DigestHex()))
	}
	if ref.Tag() != "" {
		return os.Remove(s.paths.ImageTagLink(ref.Repository(), ref.Tag()))
	}
	return nil
}

func (s *ImageStore) LinkTag(repository, tag, digestHexValue string) error {
	return writeReferenceLink(s.paths.ImageTagLink(repository, tag), digestHexValue)
}

func (s *ImageStore) linkReference(reference string, record ImageRecord) error {
	if tag := tagFromReference(reference); tag != "" {
		return s.LinkTag(record.Repository, tag, record.DigestHex())
	}
	ref, err := ParseImageRef(reference)
	if err != nil {
		return err
	}
	if !ref.IsDigest() || ref.DigestHex() == record.DigestHex() {
		return nil
	}
	return writeReferenceLink(s.paths.ImageDigestAliasLink(record.Repository, ref.DigestHex()), record.DigestHex())
}

func writeReferenceLink(link, digestHexValue string) error {
	if err := os.MkdirAll(filepath.Dir(link), filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create image reference directory: %w", err)
	}
	if err := os.Remove(link); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove existing image reference link: %w", err)
	}
	if err := os.Symlink(digestHexValue, link); err != nil {
		return fmt.Errorf("write image reference link: %w", err)
	}
	return nil
}

func (s *ImageStore) cachedReady(imageRef, platform string) (ImageRecord, error) {
	record, err := s.ReadReference(imageRef)
	if err != nil {
		return ImageRecord{}, err
	}
	wanted, err := ResolvePlatform(platform)
	if err != nil {
		return ImageRecord{}, err
	}
	return s.validateReady(record, wanted)
}

func (s *ImageStore) cachedDigest(repository, digest string, platform Platform) (ImageRecord, error) {
	record, err := s.Read(repository, digest)
	if err != nil {
		return ImageRecord{}, err
	}
	return s.validateReady(record, platform)
}

func (s *ImageStore) validateReady(record ImageRecord, wanted Platform) (ImageRecord, error) {
	if record.Status != ImageStatusReady {
		return ImageRecord{}, fmt.Errorf("image %s is %s, not ready: %w", record.Digest, record.Status, os.ErrNotExist)
	}
	actual, err := ParsePlatform(record.Platform)
	if err != nil {
		return ImageRecord{}, fmt.Errorf("cached image %s has invalid platform: %w", record.Digest, err)
	}
	if !wanted.Matches(actual) {
		return ImageRecord{}, fmt.Errorf("cached image platform is %s, requested %s: %w", actual, wanted, ErrInvalidPlatform)
	}
	diskPath := s.paths.ImageDisk(record.Repository, record.DigestHex())
	info, err := os.Stat(diskPath)
	if err != nil {
		return ImageRecord{}, fmt.Errorf("stat prepared rootfs disk: %w", err)
	}
	if !info.Mode().IsRegular() || info.Size() == 0 {
		return ImageRecord{}, fmt.Errorf("prepared rootfs disk %s is not a non-empty regular file: %w", diskPath, os.ErrNotExist)
	}
	return record, nil
}
