// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package release

import (
	"archive/tar"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/klauspost/compress/zstd"
)

const (
	maximumArchiveFiles        = 32
	maximumArchiveFileBytes    = 512 * 1024 * 1024
	maximumArchiveExpandedSize = 1024 * 1024 * 1024
	maximumArchiveWindowBytes  = 64 * 1024 * 1024
	manifestMode               = readOnlyFileMode
)

type BundleSources map[FileRole]string

func CreateBundle(destination io.Writer, manifest Manifest, sources BundleSources) (resultErr error) {
	encodedManifest, err := Marshal(manifest)
	if err != nil {
		return err
	}
	for _, file := range manifest.Files {
		sourcePath, exists := sources[file.Role]
		if !exists {
			return fmt.Errorf("source for Snapflow release role %q is missing", file.Role)
		}
		if err := verifySourceFile(sourcePath, file); err != nil {
			return fmt.Errorf("verify Snapflow release source for %q: %w", file.Role, err)
		}
	}
	compressor, err := zstd.NewWriter(
		destination,
		zstd.WithEncoderConcurrency(1),
		zstd.WithEncoderCRC(true),
		zstd.WithWindowSize(maximumArchiveWindowBytes),
	)
	if err != nil {
		return fmt.Errorf("create Snapflow release compressor: %w", err)
	}
	archive := tar.NewWriter(compressor)
	closeWriters := func() error {
		return errors.Join(archive.Close(), compressor.Close())
	}
	if err := writeArchiveBytes(archive, ManifestFileName, encodedManifest, manifestMode, manifest); err != nil {
		return errors.Join(err, closeWriters())
	}
	for _, file := range manifest.Files {
		if err := writeArchiveFile(archive, file, sources[file.Role], manifest); err != nil {
			return errors.Join(err, closeWriters())
		}
	}
	return closeWriters()
}

func verifySourceFile(sourcePath string, expected File) (resultErr error) {
	info, err := os.Lstat(sourcePath)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() || info.Size() != expected.Size {
		return fmt.Errorf("source must be a regular %d-byte file", expected.Size)
	}
	source, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer func() {
		if err := source.Close(); err != nil {
			resultErr = errors.Join(resultErr, err)
		}
	}()
	hash := sha256.New()
	written, err := io.Copy(hash, io.LimitReader(source, expected.Size+1))
	if err != nil {
		return err
	}
	actual := digestPrefix + hex.EncodeToString(hash.Sum(nil))
	if written != expected.Size || actual != expected.SHA256 {
		return errors.New("source content changed after manifest creation")
	}
	return nil
}

func ExtractBundle(source io.Reader, destination string) (VerifiedRelease, error) {
	return extractBundle(source, destination, VerifyConfig{})
}

func InspectBundle(source io.Reader, destination string) (VerifiedRelease, error) {
	return extractBundle(source, destination, VerifyConfig{AnyArchitecture: true})
}

func extractBundle(source io.Reader, destination string, cfg VerifyConfig) (VerifiedRelease, error) {
	if err := requireEmptyDirectory(destination); err != nil {
		return VerifiedRelease{}, err
	}
	decoder, err := zstd.NewReader(
		source,
		zstd.WithDecoderConcurrency(1),
		zstd.WithDecoderMaxMemory(maximumArchiveWindowBytes),
	)
	if err != nil {
		return VerifiedRelease{}, fmt.Errorf("open Snapflow release bundle: %w", err)
	}
	defer decoder.Close()
	if err := extractEntries(tar.NewReader(decoder), destination); err != nil {
		return VerifiedRelease{}, err
	}
	if err := requireArchiveEnd(decoder); err != nil {
		return VerifiedRelease{}, err
	}
	return LoadVerified(destination, cfg)
}

type archiveAdmission struct {
	seen     map[string]struct{}
	files    int
	expanded int64
}

func extractEntries(archive *tar.Reader, destination string) error {
	admission := archiveAdmission{seen: make(map[string]struct{}, maximumArchiveFiles)}
	for {
		header, err := archive.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return fmt.Errorf("read Snapflow release archive: %w", err)
		}
		relative, mode, err := admission.admit(header)
		if err != nil {
			return err
		}
		if err := extractRegularFile(archive, destination, relative, header.Size, mode); err != nil {
			return err
		}
	}
	if _, exists := admission.seen[ManifestFileName]; !exists {
		return errors.New("the Snapflow release archive has no manifest")
	}
	return nil
}

func (admission *archiveAdmission) admit(header *tar.Header) (string, os.FileMode, error) {
	admission.files++
	if admission.files > maximumArchiveFiles {
		return "", 0, fmt.Errorf("the Snapflow release archive exceeds %d-file limit", maximumArchiveFiles)
	}
	relative, err := archiveRelativePath(header.Name)
	if err != nil {
		return "", 0, err
	}
	if _, exists := admission.seen[relative]; exists {
		return "", 0, fmt.Errorf("the Snapflow release archive path %q is repeated", relative)
	}
	admission.seen[relative] = struct{}{}
	if err := validateEntryHeader(relative, header); err != nil {
		return "", 0, err
	}
	admission.expanded += header.Size
	if admission.expanded > maximumArchiveExpandedSize {
		return "", 0, fmt.Errorf("the Snapflow release archive exceeds %d-byte expanded limit", maximumArchiveExpandedSize)
	}
	mode, err := entryMode(relative, header)
	return relative, mode, err
}

func validateEntryHeader(relative string, header *tar.Header) error {
	switch {
	case header.Typeflag != tar.TypeReg:
		return fmt.Errorf("the Snapflow release archive path %q is not a regular file", relative)
	case header.Uid != 0 || header.Gid != 0:
		return fmt.Errorf("the Snapflow release archive path %q is not root-owned", relative)
	case header.Size <= 0 || header.Size > maximumArchiveFileBytes:
		return fmt.Errorf("the Snapflow release archive path %q has invalid size %d", relative, header.Size)
	default:
		return nil
	}
}

func entryMode(relative string, header *tar.Header) (os.FileMode, error) {
	mode := os.FileMode(header.Mode).Perm()
	if relative == ManifestFileName && mode != manifestMode {
		return 0, fmt.Errorf("the Snapflow release manifest has invalid mode %#o", mode)
	}
	if mode != readOnlyFileMode && mode != executableFileMode {
		return 0, fmt.Errorf("the Snapflow release archive path %q has unsafe mode %#o", relative, mode)
	}
	return mode, nil
}

func requireArchiveEnd(decoder io.Reader) error {
	trailing := make([]byte, 1)
	count, err := decoder.Read(trailing)
	if err != nil && !errors.Is(err, io.EOF) {
		return fmt.Errorf("validate Snapflow release archive end: %w", err)
	}
	if count != 0 {
		return errors.New("the Snapflow release archive contains trailing content")
	}
	return nil
}

func writeArchiveBytes(archive *tar.Writer, name string, data []byte, mode int64, manifest Manifest) error {
	header := &tar.Header{
		Name:       path.Join(ReleaseRootDirectory, name),
		Mode:       mode,
		Size:       int64(len(data)),
		ModTime:    manifest.BuiltAt,
		AccessTime: manifest.BuiltAt,
		ChangeTime: manifest.BuiltAt,
		Uid:        0,
		Gid:        0,
		Uname:      "root",
		Gname:      "root",
		Format:     tar.FormatPAX,
	}
	if err := archive.WriteHeader(header); err != nil {
		return fmt.Errorf("write Snapflow release archive header %q: %w", name, err)
	}
	if _, err := archive.Write(data); err != nil {
		return fmt.Errorf("write Snapflow release archive file %q: %w", name, err)
	}
	return nil
}

func writeArchiveFile(archive *tar.Writer, file File, sourcePath string, manifest Manifest) (resultErr error) {
	source, err := os.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("open Snapflow release source %q: %w", file.Role, err)
	}
	defer func() {
		if err := source.Close(); err != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close Snapflow release source %q: %w", file.Role, err))
		}
	}()
	header := &tar.Header{
		Name:       path.Join(ReleaseRootDirectory, file.Path),
		Mode:       int64(file.Mode),
		Size:       file.Size,
		ModTime:    manifest.BuiltAt,
		AccessTime: manifest.BuiltAt,
		ChangeTime: manifest.BuiltAt,
		Uid:        0,
		Gid:        0,
		Uname:      "root",
		Gname:      "root",
		Format:     tar.FormatPAX,
	}
	if err := archive.WriteHeader(header); err != nil {
		return fmt.Errorf("write Snapflow release archive header %q: %w", file.Path, err)
	}
	written, err := io.Copy(archive, io.LimitReader(source, file.Size+1))
	if err != nil {
		return fmt.Errorf("write Snapflow release archive file %q: %w", file.Path, err)
	}
	if written != file.Size {
		return fmt.Errorf("the Snapflow release source %q changed while archiving", file.Role)
	}
	return nil
}

func archiveRelativePath(name string) (string, error) {
	if strings.Contains(name, "\\") || strings.HasPrefix(name, "/") || path.Clean(name) != name {
		return "", fmt.Errorf("the Snapflow release archive contains unsafe path %q", name)
	}
	prefix := ReleaseRootDirectory + "/"
	relative, ok := strings.CutPrefix(name, prefix)
	if !ok || !validRelativePath(relative) {
		return "", fmt.Errorf("the Snapflow release archive path %q is outside %s", name, ReleaseRootDirectory)
	}
	return relative, nil
}

func extractRegularFile(archive io.Reader, destination, relative string, size int64, mode os.FileMode) (resultErr error) {
	target := filepath.Join(destination, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(target), releaseDirectoryMode); err != nil {
		return fmt.Errorf("create Snapflow release archive directory: %w", err)
	}
	file, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode)
	if err != nil {
		return fmt.Errorf("create Snapflow release archive file %q: %w", relative, err)
	}
	defer func() {
		if err := file.Close(); err != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close Snapflow release archive file %q: %w", relative, err))
		}
	}()
	written, err := io.Copy(file, io.LimitReader(archive, size+1))
	if err != nil {
		return fmt.Errorf("extract Snapflow release archive file %q: %w", relative, err)
	}
	if written != size {
		return fmt.Errorf("the Snapflow release archive file %q ended after %d of %d bytes", relative, written, size)
	}
	if err := file.Sync(); err != nil {
		return fmt.Errorf("sync Snapflow release archive file %q: %w", relative, err)
	}
	return nil
}

func requireEmptyDirectory(directory string) error {
	entries, err := os.ReadDir(directory)
	if errors.Is(err, os.ErrNotExist) {
		if err := os.MkdirAll(directory, releaseDirectoryMode); err != nil {
			return fmt.Errorf("create Snapflow release extraction directory: %w", err)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("inspect Snapflow release extraction directory: %w", err)
	}
	if len(entries) != 0 {
		return errors.New("the Snapflow release extraction directory must be empty")
	}
	return nil
}
