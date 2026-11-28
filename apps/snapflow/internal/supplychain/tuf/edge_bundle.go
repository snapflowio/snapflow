// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"

	"golang.org/x/mod/semver"
)

const executableMask = 0o111

var edgeBundlePattern = regexp.MustCompile(`^snapflow-edge-(.+)-linux-([a-z0-9]+)\.tar\.gz$`)

func inspectEdgeBundle(path string) (bundle inspectedBundle, resultErr error) {
	path = filepath.Clean(path)
	matches := edgeBundlePattern.FindStringSubmatch(filepath.Base(path))
	if matches == nil {
		return inspectedBundle{}, fmt.Errorf("edge bundle %s is not named snapflow-edge-<version>-linux-<architecture>.tar.gz", path)
	}
	version, architecture := matches[1], matches[2]
	if !semver.IsValid("v"+version) || !supportedArchitecture(architecture) {
		return inspectedBundle{}, fmt.Errorf("edge bundle %s names an unsupported version or architecture", path)
	}
	file, err := os.Open(path)
	if err != nil {
		return inspectedBundle{}, fmt.Errorf("open edge bundle: %w", err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, file.Close())
	}()
	hash := sha256.New()
	counter := &countingWriter{}
	reader := io.TeeReader(file, io.MultiWriter(hash, counter))
	if err := ExtractEdgeBinary(reader, io.Discard); err != nil {
		return inspectedBundle{}, fmt.Errorf("verify edge bundle %s: %w", path, err)
	}
	if _, err := io.Copy(io.MultiWriter(hash, counter), file); err != nil {
		return inspectedBundle{}, fmt.Errorf("hash edge bundle %s: %w", path, err)
	}
	if counter.written <= 0 || counter.written > maximumEdgeBundleBytes {
		return inspectedBundle{}, fmt.Errorf("edge bundle %s has an invalid size", path)
	}
	return inspectedBundle{
		path: path, version: version, architecture: architecture,
		sha256: sha256Digest(hash.Sum(nil)), length: counter.written,
	}, nil
}

func ExtractEdgeBinary(bundle io.Reader, destination io.Writer) error {
	decompressed, err := gzip.NewReader(bundle)
	if err != nil {
		return fmt.Errorf("open edge bundle compression: %w", err)
	}
	archive := tar.NewReader(decompressed)
	header, err := archive.Next()
	if err != nil {
		return fmt.Errorf("read edge bundle entry: %w", err)
	}
	if header.Typeflag != tar.TypeReg || header.Name != EdgeBinaryName ||
		header.Mode&executableMask == 0 || header.Size <= 0 || header.Size > maximumEdgeBundleBytes {
		return fmt.Errorf("edge bundle must hold one executable named %s", EdgeBinaryName)
	}
	if _, err := io.CopyN(destination, archive, header.Size); err != nil {
		return fmt.Errorf("read the edge binary: %w", err)
	}
	if next, err := archive.Next(); !errors.Is(err, io.EOF) {
		return fmt.Errorf("edge bundle holds more than the edge binary: %v", next)
	}
	return decompressed.Close()
}
