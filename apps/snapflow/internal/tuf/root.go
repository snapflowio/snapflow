// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"crypto/ed25519"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/theupdateframework/go-tuf/v2/metadata"
)

var versionedRootName = regexp.MustCompile(`^([1-9][0-9]*)\.root\.json$`)

type RotateRootConfig struct {
	RepositoryRoot string
	CurrentKeys    []string
	NewKeys        []string
	Now            time.Time
}

func GenerateRootKeys(output string) error {
	output = strings.TrimSpace(output)
	if output == "" {
		return errors.New("new root key directory is required")
	}
	absOutput, err := filepath.Abs(filepath.Clean(output))
	if err != nil {
		return fmt.Errorf("resolve new root key directory: %w", err)
	}
	if _, err := os.Stat(absOutput); !errors.Is(err, os.ErrNotExist) {
		if err == nil {
			return errors.New("new root key directory already exists")
		}
		return fmt.Errorf("inspect new root key directory: %w", err)
	}
	for index := 1; index <= rootKeyCount; index++ {
		path := filepath.Join(absOutput, privateKeyName(metadata.ROOT, index))
		if _, err := generatePrivateKey(path); err != nil {
			return err
		}
	}
	return atomicfile.SyncDirectory(absOutput)
}

func RotateRoot(cfg RotateRootConfig) error {
	root := strings.TrimSpace(cfg.RepositoryRoot)
	if root == "" || !filepath.IsAbs(root) {
		return errors.New("release TUF repository root must be an absolute path")
	}
	if cfg.Now.IsZero() {
		return errors.New("root rotation time is required")
	}
	metadataRoot := filepath.Join(filepath.Clean(root), metadataDirectoryName)
	current, err := loadLatestTrustedRoot(metadataRoot)
	if err != nil {
		return err
	}
	currentKeys, newKeys, err := loadRotationKeys(current, cfg)
	if err != nil {
		return err
	}
	next, err := rotatedRoot(current, newKeys, cfg.Now.UTC())
	if err != nil {
		return err
	}
	if err := sign(next, append(append([]ed25519.PrivateKey(nil), currentKeys...), newKeys...)); err != nil {
		return err
	}
	if err := current.VerifyDelegate(metadata.ROOT, next); err != nil {
		return fmt.Errorf("verify new root with current threshold: %w", err)
	}
	if err := next.VerifyDelegate(metadata.ROOT, next); err != nil {
		return fmt.Errorf("verify new root with new threshold: %w", err)
	}
	if err := writeMetadata(metadataRoot, versionedName(next.Signed.Version, metadata.ROOT), next); err != nil {
		return err
	}
	return syncDirectories(metadataRoot, filepath.Clean(root))
}

func loadRotationKeys(
	current *metadata.Metadata[metadata.RootType],
	cfg RotateRootConfig,
) (currentKeys, newKeys []ed25519.PrivateKey, err error) {
	currentRole := current.Signed.Roles[metadata.ROOT]
	if currentRole == nil {
		return nil, nil, errors.New("release TUF root role is missing")
	}
	if len(cfg.CurrentKeys) < currentRole.Threshold {
		return nil, nil, fmt.Errorf("root rotation requires at least %d current root keys", currentRole.Threshold)
	}
	if len(cfg.NewKeys) < currentRole.Threshold {
		return nil, nil, fmt.Errorf("root rotation requires at least %d new root keys", currentRole.Threshold)
	}
	if currentKeys, err = loadKeys("current root", cfg.CurrentKeys...); err != nil {
		return nil, nil, err
	}
	if newKeys, err = loadKeys("new root", cfg.NewKeys...); err != nil {
		return nil, nil, err
	}
	return currentKeys, newKeys, nil
}

func rotatedRoot(
	current *metadata.Metadata[metadata.RootType],
	newKeys []ed25519.PrivateKey,
	now time.Time,
) (*metadata.Metadata[metadata.RootType], error) {
	encoded, err := current.ToBytes(false)
	if err != nil {
		return nil, fmt.Errorf("encode current TUF root: %w", err)
	}
	next, err := metadata.Root().FromBytes(encoded)
	if err != nil {
		return nil, fmt.Errorf("copy current TUF root: %w", err)
	}
	threshold := next.Signed.Roles[metadata.ROOT].Threshold
	for _, keyID := range slices.Clone(next.Signed.Roles[metadata.ROOT].KeyIDs) {
		if err := next.Signed.RevokeKey(keyID, metadata.ROOT); err != nil {
			return nil, fmt.Errorf("revoke current root key: %w", err)
		}
	}
	if err := authorizeKeys(next, metadata.ROOT, newKeys); err != nil {
		return nil, err
	}
	next.Signed.Roles[metadata.ROOT].Threshold = threshold
	next.Signed.Version++
	next.Signed.Expires = now.Add(rootValidity)
	return next, nil
}

func loadLatestTrustedRoot(metadataRoot string) (*metadata.Metadata[metadata.RootType], error) {
	highest, err := highestRootVersion(metadataRoot)
	if err != nil {
		return nil, err
	}
	trusted, err := metadata.Root().FromFile(versionedPath(metadataRoot, initialVersion, metadata.ROOT))
	if err != nil {
		return nil, fmt.Errorf("load bootstrap root: %w", err)
	}
	if trusted.Signed.Version != initialVersion {
		return nil, errors.New("bootstrap root metadata must have version 1")
	}
	if err := trusted.VerifyDelegate(metadata.ROOT, trusted); err != nil {
		return nil, fmt.Errorf("verify bootstrap root: %w", err)
	}
	for version := int64(initialVersion + 1); version <= highest; version++ {
		if trusted, err = nextTrustedRoot(metadataRoot, trusted, version); err != nil {
			return nil, err
		}
	}
	return trusted, nil
}

func highestRootVersion(metadataRoot string) (int64, error) {
	entries, err := os.ReadDir(metadataRoot)
	if err != nil {
		return 0, fmt.Errorf("read TUF metadata directory: %w", err)
	}
	highest := int64(0)
	for _, entry := range entries {
		matches := versionedRootName.FindStringSubmatch(entry.Name())
		if entry.IsDir() || matches == nil {
			continue
		}
		version, err := strconv.ParseInt(matches[1], 10, 64)
		if err != nil {
			return 0, fmt.Errorf("parse TUF root version: %w", err)
		}
		highest = max(highest, version)
	}
	if highest == 0 {
		return 0, errors.New("release TUF repository has no root metadata")
	}
	return highest, nil
}

func nextTrustedRoot(
	metadataRoot string,
	trusted *metadata.Metadata[metadata.RootType],
	version int64,
) (*metadata.Metadata[metadata.RootType], error) {
	next, err := metadata.Root().FromFile(versionedPath(metadataRoot, version, metadata.ROOT))
	if err != nil {
		return nil, fmt.Errorf("load TUF root version %d: %w", version, err)
	}
	if next.Signed.Version != version {
		return nil, fmt.Errorf("release TUF root filename version %d does not match signed version %d", version, next.Signed.Version)
	}
	if err := trusted.VerifyDelegate(metadata.ROOT, next); err != nil {
		return nil, fmt.Errorf("verify TUF root version %d with previous root: %w", version, err)
	}
	if err := next.VerifyDelegate(metadata.ROOT, next); err != nil {
		return nil, fmt.Errorf("verify TUF root version %d with new root: %w", version, err)
	}
	return next, nil
}
