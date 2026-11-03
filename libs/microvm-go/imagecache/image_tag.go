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
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/snapflowio/microvm-go/internal/filemode"
)

func (s *ImageStore) Tag(sourceRef, targetRef string) error {
	source, err := s.ReadReference(sourceRef)
	if err != nil {
		return err
	}
	target, err := ParseImageRef(targetRef)
	if err != nil {
		return err
	}
	if target.Tag() == "" {
		return fmt.Errorf("%w: target image %q must include a tag", ErrInvalidImageRef, targetRef)
	}
	record := source
	record.Reference = target.String()
	record.Repository = target.Repository()
	record.UpdatedAt = time.Now().UTC()
	if source.Status == ImageStatusReady {
		if err := s.linkPreparedDisk(source, record); err != nil {
			return err
		}
	}
	if err := s.Write(record); err != nil {
		return err
	}
	return s.LinkTag(record.Repository, target.Tag(), source.DigestHex())
}

func (s *ImageStore) linkPreparedDisk(source, target ImageRecord) (resultErr error) {
	sourcePath := s.paths.ImageDisk(source.Repository, source.DigestHex())
	targetPath := s.paths.ImageDisk(target.Repository, target.DigestHex())
	if sourcePath == targetPath {
		return nil
	}
	platform, err := ParsePlatform(source.Platform)
	if err != nil {
		return fmt.Errorf("parse source image platform before tagging: %w", err)
	}
	if _, err := s.validateReady(source, platform); err != nil {
		return fmt.Errorf("validate source image before tagging: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(targetPath), filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create target image directory: %w", err)
	}
	temporaryPath, err := reserveTemporaryPath(filepath.Dir(targetPath), ".rootfs-link-*")
	if err != nil {
		return err
	}
	defer func() {
		if err := os.Remove(temporaryPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove temporary image link: %w", err))
		}
	}()
	if err := os.Link(sourcePath, temporaryPath); err != nil {
		return fmt.Errorf("link prepared image filesystem: %w", err)
	}
	if err := os.Rename(temporaryPath, targetPath); err != nil {
		return fmt.Errorf("install tagged image filesystem: %w", err)
	}
	return nil
}

func reserveTemporaryPath(dir, pattern string) (string, error) {
	temporary, err := os.CreateTemp(dir, pattern)
	if err != nil {
		return "", fmt.Errorf("reserve temporary path in %s: %w", dir, err)
	}
	temporaryPath := temporary.Name()
	if err := temporary.Close(); err != nil {
		return "", errors.Join(
			fmt.Errorf("close temporary path reservation: %w", err),
			wrapRemoveError("remove temporary path reservation", temporaryPath),
		)
	}
	if err := os.Remove(temporaryPath); err != nil {
		return "", fmt.Errorf("remove temporary path reservation: %w", err)
	}
	return temporaryPath, nil
}

func wrapRemoveError(operation, path string) error {
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("%s: %w", operation, err)
	}
	return nil
}
