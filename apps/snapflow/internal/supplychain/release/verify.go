// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package release

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
)

const manifestReadLimit = maximumManifestBytes + 1

type VerifyConfig struct {
	RequireRootOwnership bool
	AnyArchitecture      bool
}

type VerifiedRelease struct {
	Root         string     `json:"root"`
	BundleDigest string     `json:"bundleDigest"`
	Manifest     Manifest   `json:"manifest"`
	Assets       AssetPaths `json:"assets"`
}

func LoadVerified(root string, cfg VerifyConfig) (VerifiedRelease, error) {
	cleanRoot, err := filepath.Abs(filepath.Clean(root))
	if err != nil {
		return VerifiedRelease{}, fmt.Errorf("resolve Snapflow release root: %w", err)
	}
	rootInfo, err := os.Lstat(cleanRoot)
	if err != nil {
		return VerifiedRelease{}, fmt.Errorf("inspect Snapflow release root: %w", err)
	}
	if !rootInfo.IsDir() || rootInfo.Mode()&os.ModeSymlink != 0 {
		return VerifiedRelease{}, errors.New("the Snapflow release root must be a real directory")
	}
	manifestPath := filepath.Join(cleanRoot, ManifestFileName)
	encoded, err := readBounded(manifestPath, manifestReadLimit)
	if err != nil {
		return VerifiedRelease{}, fmt.Errorf("read Snapflow release manifest: %w", err)
	}
	manifest, err := Decode(encoded)
	if err != nil {
		return VerifiedRelease{}, err
	}
	if manifest.OS != runtime.GOOS || (!cfg.AnyArchitecture && manifest.Architecture != runtime.GOARCH) {
		return VerifiedRelease{}, fmt.Errorf(
			"the Snapflow release targets %s/%s, this machine is %s/%s",
			manifest.OS,
			manifest.Architecture,
			runtime.GOOS,
			runtime.GOARCH,
		)
	}
	if err := verifyDirectory(cleanRoot, manifest, cfg); err != nil {
		return VerifiedRelease{}, err
	}
	return VerifiedRelease{Root: cleanRoot, Manifest: manifest, Assets: manifest.AssetPaths(cleanRoot)}, nil
}

func verifyDirectory(root string, manifest Manifest, cfg VerifyConfig) error {
	if cfg.RequireRootOwnership {
		if err := verifyRootOwnedPath(root, true); err != nil {
			return err
		}
	}
	declared := make(map[string]File, len(manifest.Files)+1)
	declared[ManifestFileName] = File{}
	for _, expected := range manifest.Files {
		declared[expected.Path] = expected
		filePath := filepath.Join(root, filepath.FromSlash(expected.Path))
		if err := verifyFile(filePath, expected, cfg); err != nil {
			return err
		}
	}
	return rejectUndeclaredFiles(root, declared)
}

func rejectUndeclaredFiles(root string, declared map[string]File) error {
	err := filepath.WalkDir(root, func(filePath string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if filePath == root || entry.IsDir() {
			return nil
		}
		relative, err := filepath.Rel(root, filePath)
		if err != nil {
			return err
		}
		relative = filepath.ToSlash(relative)
		if _, exists := declared[relative]; !exists {
			return fmt.Errorf("the Snapflow release contains undeclared file %q", relative)
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("inspect Snapflow release directory: %w", err)
	}
	return nil
}

func verifyFile(filePath string, expected File, cfg VerifyConfig) (resultErr error) {
	info, err := os.Lstat(filePath)
	if err != nil {
		return fmt.Errorf("inspect Snapflow release file %q: %w", expected.Path, err)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("the Snapflow release file %q is not a regular file", expected.Path)
	}
	if info.Size() != expected.Size {
		return fmt.Errorf("the Snapflow release file %q size %d does not match manifest %d", expected.Path, info.Size(), expected.Size)
	}
	if uint32(info.Mode().Perm()) != expected.Mode {
		return fmt.Errorf("the Snapflow release file %q mode %#o does not match manifest %#o", expected.Path, info.Mode().Perm(), expected.Mode)
	}
	if cfg.RequireRootOwnership {
		if err := verifyRootOwnedInfo(filePath, info); err != nil {
			return err
		}
	}
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("open Snapflow release file %q: %w", expected.Path, err)
	}
	defer func() {
		if err := file.Close(); err != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close Snapflow release file %q: %w", expected.Path, err))
		}
	}()
	hash := sha256.New()
	written, err := io.Copy(hash, io.LimitReader(file, expected.Size+1))
	if err != nil {
		return fmt.Errorf("hash Snapflow release file %q: %w", expected.Path, err)
	}
	if written != expected.Size {
		return fmt.Errorf("the Snapflow release file %q changed while being verified", expected.Path)
	}
	actual := digestPrefix + hex.EncodeToString(hash.Sum(nil))
	if actual != expected.SHA256 {
		return fmt.Errorf("the Snapflow release file %q digest %s does not match manifest %s", expected.Path, actual, expected.SHA256)
	}
	return nil
}

func verifyRootOwnedPath(path string, directory bool) error {
	info, err := os.Lstat(path)
	if err != nil {
		return fmt.Errorf("inspect trusted Snapflow release path %q: %w", path, err)
	}
	if directory && !info.IsDir() {
		return fmt.Errorf("trusted Snapflow release path %q is not a directory", path)
	}
	return verifyRootOwnedInfo(path, info)
}

func verifyRootOwnedInfo(path string, info fs.FileInfo) error {
	if err := verifyRootOwner(path, info); err != nil {
		return err
	}
	if info.Mode().Perm()&0o022 != 0 {
		return fmt.Errorf("trusted Snapflow release path %q must not be group- or other-writable", path)
	}
	return nil
}

func verifyRootOwner(path string, info fs.FileInfo) error {
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return fmt.Errorf("inspect trusted Snapflow release ownership for %q", path)
	}
	if stat.Uid != 0 {
		return fmt.Errorf("trusted Snapflow release path %q must be owned by root", path)
	}
	return nil
}

func readBounded(path string, limit int64) (result []byte, resultErr error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := file.Close(); err != nil {
			resultErr = errors.Join(resultErr, err)
		}
	}()
	data, err := io.ReadAll(io.LimitReader(file, limit))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) == limit {
		return nil, fmt.Errorf("file exceeds %d-byte limit", limit-1)
	}
	return data, nil
}
