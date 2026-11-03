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

package template

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"slices"
)

type artifactVerification int

const (
	verifyArtifactIdentity artifactVerification = iota
	verifyArtifactContent
)

const (
	artifactSnapshotState = iota
	artifactSnapshotMemory
	artifactOverlayDisk
	artifactConfigDisk
	artifactRootFilesystem
	artifactPlatformBundles
)

type artifact struct {
	Size               int64  `json:"size"`
	SHA256             string `json:"sha256"`
	ModifiedAtUnixNano int64  `json:"modifiedAtUnixNano"`
	Inode              uint64 `json:"inode"`
}

type artifactValidation struct {
	label    string
	path     string
	expected artifact
	current  artifact
}

type artifactIdentity struct {
	size       int64
	modifiedAt int64
	inode      uint64
}

type cachedDigest struct {
	identity artifactIdentity
	digest   string
}

func statArtifact(path string) (artifactIdentity, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return artifactIdentity{}, err
	}
	if !info.Mode().IsRegular() {
		return artifactIdentity{}, fmt.Errorf("artifact %s is not a regular file", path)
	}
	inode, err := fileInode(info)
	if err != nil {
		return artifactIdentity{}, fmt.Errorf("identify artifact %s: %w", path, err)
	}
	return artifactIdentity{size: info.Size(), modifiedAt: info.ModTime().UnixNano(), inode: inode}, nil
}

func (identity artifactIdentity) matches(recorded artifact) bool {
	return identity.size == recorded.Size &&
		identity.modifiedAt == recorded.ModifiedAtUnixNano &&
		identity.inode == recorded.Inode
}

func (c *Cache) Digest(path string) (string, error) {
	identity, err := statArtifact(path)
	if err != nil {
		return "", err
	}
	if value, exists := c.digests.Load(path); exists {
		if cached, valid := value.(cachedDigest); valid && cached.identity == identity {
			return cached.digest, nil
		}
	}
	return c.hashAndCache(path, identity)
}

func (c *Cache) hashAndCache(path string, identity artifactIdentity) (string, error) {
	digest, err := hashArtifact(path, identity.size)
	if err != nil {
		return "", err
	}
	after, err := statArtifact(path)
	if err != nil {
		return "", err
	}
	if after != identity {
		return "", fmt.Errorf("artifact %s changed while it was hashed", path)
	}
	c.digests.Store(path, cachedDigest{identity: identity, digest: digest})
	return digest, nil
}

func hashArtifact(path string, size int64) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	hasher := sha256.New()
	copiedBytes, copyErr := io.Copy(hasher, file)
	closeErr := file.Close()
	if err := errors.Join(copyErr, closeErr); err != nil {
		return "", err
	}
	if copiedBytes != size {
		return "", fmt.Errorf("digest artifact %s: read %d bytes, expected %d", path, copiedBytes, size)
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

func (c *Cache) captureArtifact(label, path string) (artifact, error) {
	identity, err := statArtifact(path)
	if err != nil {
		return artifact{}, fmt.Errorf("inspect template seed %s: %w", label, err)
	}
	if identity.size <= 0 {
		return artifact{}, fmt.Errorf("template seed %s is empty", label)
	}
	digest, err := c.Digest(path)
	if err != nil {
		return artifact{}, fmt.Errorf("digest template seed %s: %w", label, err)
	}
	return recordedArtifact(identity, digest), nil
}

func recordedArtifact(identity artifactIdentity, digest string) artifact {
	return artifact{
		Size:               identity.size,
		SHA256:             digest,
		ModifiedAtUnixNano: identity.modifiedAt,
		Inode:              identity.inode,
	}
}

func (c *Cache) verifyArtifacts(validations []artifactValidation, verification artifactVerification) error {
	for index := range validations {
		if err := c.verifyArtifact(&validations[index], verification); err != nil {
			return err
		}
	}
	return nil
}

func (c *Cache) verifyArtifact(validation *artifactValidation, verification artifactVerification) error {
	if validation.expected.Size <= 0 || validation.expected.SHA256 == "" {
		return fmt.Errorf("template seed %s has no recorded digest", validation.label)
	}
	identity, err := statArtifact(validation.path)
	if err != nil {
		return fmt.Errorf("inspect template seed %s: %w", validation.label, err)
	}
	if identity.size != validation.expected.Size {
		return fmt.Errorf(
			"template seed %s size changed: expected %d bytes, got %d",
			validation.label, validation.expected.Size, identity.size,
		)
	}
	if identity.matches(validation.expected) && verification == verifyArtifactIdentity {
		validation.current = validation.expected
		return nil
	}
	digest, err := c.verifiedDigest(validation.path, identity, verification)
	if err != nil {
		return fmt.Errorf("digest template seed %s: %w", validation.label, err)
	}
	if digest != validation.expected.SHA256 {
		return fmt.Errorf("template seed %s digest changed", validation.label)
	}
	validation.current = recordedArtifact(identity, digest)
	return nil
}

func (c *Cache) verifiedDigest(path string, identity artifactIdentity, verification artifactVerification) (string, error) {
	if verification == verifyArtifactContent {
		return c.hashAndCache(path, identity)
	}
	return c.Digest(path)
}

func verifiedArtifacts(validations []artifactValidation) artifacts {
	bundles := make([]artifact, 0, len(validations)-artifactPlatformBundles)
	for _, bundle := range validations[artifactPlatformBundles:] {
		bundles = append(bundles, bundle.current)
	}
	return artifacts{
		SnapshotState:   validations[artifactSnapshotState].current,
		SnapshotMemory:  validations[artifactSnapshotMemory].current,
		OverlayDisk:     validations[artifactOverlayDisk].current,
		ConfigDisk:      validations[artifactConfigDisk].current,
		RootFilesystem:  validations[artifactRootFilesystem].current,
		PlatformBundles: bundles,
	}
}

func sameArtifacts(left, right artifacts) bool {
	return left.SnapshotState == right.SnapshotState &&
		left.SnapshotMemory == right.SnapshotMemory &&
		left.OverlayDisk == right.OverlayDisk &&
		left.ConfigDisk == right.ConfigDisk &&
		left.RootFilesystem == right.RootFilesystem &&
		slices.Equal(left.PlatformBundles, right.PlatformBundles)
}
