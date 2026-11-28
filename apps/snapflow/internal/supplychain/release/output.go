// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package release

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/snapflowio/common-go/pkg/atomicfile"
)

const (
	releaseDirectoryMode   = 0o755
	bundleTemporaryPattern = "." + Product + "-*.tar.zst"
)

func BundleFileName(version, architecture string) string {
	return fmt.Sprintf("%s-%s-%s-%s.tar.zst", Product, version, manifestOS, architecture)
}

func BundleAssetPath(version, architecture string) string {
	return "v" + version + "/" + BundleFileName(version, architecture)
}

func WriteBundle(outputPath string, manifest Manifest, sources BundleSources) error {
	outputPath = filepath.Clean(strings.TrimSpace(outputPath))
	if outputPath == "." {
		return errors.New("bundle output path is required")
	}
	outputDirectory := filepath.Dir(outputPath)
	if err := os.MkdirAll(outputDirectory, releaseDirectoryMode); err != nil {
		return fmt.Errorf("create bundle output directory: %w", err)
	}
	temporary, err := os.CreateTemp(outputDirectory, bundleTemporaryPattern)
	if err != nil {
		return fmt.Errorf("create temporary bundle: %w", err)
	}
	err = writeBundleFile(temporary, manifest, sources)
	if err = errors.Join(err, temporary.Close()); err == nil {
		err = os.Rename(temporary.Name(), outputPath)
	}
	if err != nil {
		return errors.Join(fmt.Errorf("publish Snapflow release bundle: %w", err), os.Remove(temporary.Name()))
	}
	return atomicfile.SyncDirectory(outputDirectory)
}

func writeBundleFile(file *os.File, manifest Manifest, sources BundleSources) error {
	if err := CreateBundle(file, manifest, sources); err != nil {
		return err
	}
	if err := file.Sync(); err != nil {
		return fmt.Errorf("sync Snapflow release bundle: %w", err)
	}
	return nil
}

func ExtractBundleFile(bundlePath, outputPath string) (resultErr error) {
	outputPath = filepath.Clean(strings.TrimSpace(outputPath))
	if outputPath == "." {
		return errors.New("output path is required")
	}
	if err := os.Mkdir(outputPath, releaseDirectoryMode); err != nil {
		return fmt.Errorf("create output: %w", err)
	}
	completed := false
	defer func() {
		if completed {
			return
		}
		if err := os.RemoveAll(outputPath); err != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove incomplete output: %w", err))
		}
	}()
	bundle, err := os.Open(filepath.Clean(strings.TrimSpace(bundlePath)))
	if err != nil {
		return fmt.Errorf("open bundle: %w", err)
	}
	_, extractErr := ExtractBundle(bundle, outputPath)
	closeErr := bundle.Close()
	if err := errors.Join(extractErr, closeErr); err != nil {
		return err
	}
	completed = true
	return nil
}
