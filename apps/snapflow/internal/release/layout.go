// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package release

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	ReleasesDirectoryName = "releases"
	CurrentLinkName       = "current"
)

func LoadActive(installationRoot string, requireRootOwnership bool) (VerifiedRelease, error) {
	root := filepath.Clean(strings.TrimSpace(installationRoot))
	if !filepath.IsAbs(root) {
		return VerifiedRelease{}, errors.New("the Snapflow installation root must be absolute")
	}
	current := filepath.Join(root, CurrentLinkName)
	info, err := os.Lstat(current)
	if errors.Is(err, os.ErrNotExist) {
		return VerifiedRelease{}, errors.New(
			"no active Snapflow release is installed; run `sudo snapflow setup`",
		)
	}
	if err != nil {
		return VerifiedRelease{}, fmt.Errorf("inspect active Snapflow release: %w", err)
	}
	name, err := activeReleaseName(root, current, info)
	if err != nil {
		return VerifiedRelease{}, err
	}
	if requireRootOwnership {
		if err := verifyTrustedInstallation(root, current, info); err != nil {
			return VerifiedRelease{}, err
		}
	}
	release, err := LoadVerified(
		filepath.Join(root, ReleasesDirectoryName, name),
		VerifyConfig{RequireRootOwnership: requireRootOwnership},
	)
	if err != nil {
		return VerifiedRelease{}, err
	}
	release.BundleDigest = digestPrefix + name
	return release, nil
}

func activeReleaseName(root, current string, info os.FileInfo) (string, error) {
	if info.Mode()&os.ModeSymlink == 0 {
		return "", errors.New("active Snapflow release pointer is not a symbolic link")
	}
	target, err := os.Readlink(current)
	if err != nil {
		return "", fmt.Errorf("read active Snapflow release pointer: %w", err)
	}
	if filepath.IsAbs(target) || filepath.Clean(target) != target {
		return "", errors.New("active Snapflow release pointer is not a canonical relative link")
	}
	relative, err := filepath.Rel(filepath.Join(root, ReleasesDirectoryName), filepath.Join(root, target))
	if err != nil || relative == "." || relative != filepath.Base(relative) || !validReleaseDirectory(relative) {
		return "", errors.New("active Snapflow release pointer is outside the release directory")
	}
	return relative, nil
}

func verifyTrustedInstallation(root, current string, info os.FileInfo) error {
	if err := verifyTrustedAncestors(root); err != nil {
		return err
	}
	if err := verifyRootOwnedPath(filepath.Join(root, ReleasesDirectoryName), true); err != nil {
		return err
	}
	return verifyRootOwner(current, info)
}

func verifyTrustedAncestors(path string) error {
	for candidate := filepath.Clean(path); ; candidate = filepath.Dir(candidate) {
		if err := verifyRootOwnedPath(candidate, true); err != nil {
			return err
		}
		parent := filepath.Dir(candidate)
		if parent == candidate {
			return nil
		}
	}
}

func validReleaseDirectory(value string) bool {
	if len(value) != 2*sha256.Size {
		return false
	}
	return validSHA256(digestPrefix + value)
}
