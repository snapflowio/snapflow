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

package builds

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/transferpolicy"
	"github.com/snapflowio/microvm-go/types"
)

const (
	bytesPerMiB          int64 = 1024 * 1024
	maxContextRedirects        = 3
	contextParentDirMode       = 0o755
	gzipMagic                  = "\x1f\x8b"
)

func PrepareContext(
	ctx context.Context,
	root string,
	request types.BuildRequest,
	config Config,
	transfers transferpolicy.Policy,
) error {
	config = config.Normalize()
	if err := os.MkdirAll(root, filemode.PrivateDirectory); err != nil {
		return fmt.Errorf("create build context: %w", err)
	}
	if err := os.Chmod(root, filemode.PrivateDirectory); err != nil {
		return fmt.Errorf("secure build context: %w", err)
	}
	if len(request.Contexts) == 0 {
		return os.WriteFile(filepath.Join(root, "Dockerfile"), []byte(request.Dockerfile), filemode.SharedFile)
	}
	for _, archive := range request.Contexts {
		if err := downloadAndExtractContext(ctx, root, archive, config, transfers); err != nil {
			return err
		}
	}
	if strings.TrimSpace(request.Dockerfile) != "" {
		if err := os.WriteFile(filepath.Join(root, "Dockerfile"), []byte(request.Dockerfile), filemode.SharedFile); err != nil {
			return fmt.Errorf("write Dockerfile: %w", err)
		}
	}
	return nil
}

func downloadAndExtractContext(
	ctx context.Context,
	root string,
	archive types.BuildContextArchive,
	config Config,
	transfers transferpolicy.Policy,
) error {
	expectedHash, err := buildContextSHA256(archive.Hash)
	if err != nil {
		return err
	}
	target, err := transfers.Parse(archive.DownloadURL)
	if err != nil {
		return fmt.Errorf("build context URL: %w", err)
	}
	response, err := fetchContextArchive(ctx, target, transfers)
	if err != nil {
		return fmt.Errorf("download build context %s: %w", archive.Hash, err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("download build context %s returned %s", archive.Hash, response.Status)
	}
	maxArchiveBytes := config.MaxContextArchiveMiB * bytesPerMiB
	if response.ContentLength > maxArchiveBytes {
		return fmt.Errorf("build context archive exceeds %d MiB limit", config.MaxContextArchiveMiB)
	}
	archivePath, actualHash, err := storeContextArchive(response.Body, filepath.Dir(root), maxArchiveBytes, config.MaxContextArchiveMiB)
	if err != nil {
		return err
	}
	defer os.Remove(archivePath)
	if actualHash != expectedHash {
		return fmt.Errorf("build context checksum mismatch: expected %s got %s", expectedHash, actualHash)
	}
	return extractTarArchive(archivePath, root, config.WorkspaceGiB*bytesPerGiB, config.MaxContextEntries)
}

func fetchContextArchive(ctx context.Context, target *url.URL, transfers transferpolicy.Policy) (*http.Response, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create build context request: %w", err)
	}
	client := &http.Client{
		Transport:     buildContextTransport(target, transfers),
		CheckRedirect: sameOriginRedirect,
	}
	return client.Do(request)
}

func sameOriginRedirect(next *http.Request, via []*http.Request) error {
	if len(via) >= maxContextRedirects {
		return errors.New("too many build context redirects")
	}
	previous := via[len(via)-1].URL
	if !strings.EqualFold(next.URL.Scheme, previous.Scheme) || !strings.EqualFold(next.URL.Host, previous.Host) {
		return errors.New("build context redirect changed origin")
	}
	return nil
}

func storeContextArchive(body io.Reader, directory string, maxArchiveBytes, maxArchiveMiB int64) (string, string, error) {
	temp, err := os.CreateTemp(directory, ".snapflow-build-context-*.tar")
	if err != nil {
		return "", "", fmt.Errorf("create build context temp file: %w", err)
	}
	hasher := sha256.New()
	written, copyErr := io.Copy(io.MultiWriter(temp, hasher), io.LimitReader(body, maxArchiveBytes+1))
	closeErr := temp.Close()
	var storeErr error
	switch {
	case copyErr != nil:
		storeErr = errors.Join(fmt.Errorf("write build context archive: %w", copyErr), closeErr)
	case written > maxArchiveBytes:
		storeErr = errors.Join(fmt.Errorf("build context archive exceeds %d MiB limit", maxArchiveMiB), closeErr)
	case closeErr != nil:
		storeErr = fmt.Errorf("close build context archive: %w", closeErr)
	}
	if storeErr != nil {
		return "", "", errors.Join(storeErr, os.Remove(temp.Name()))
	}
	return temp.Name(), hex.EncodeToString(hasher.Sum(nil)), nil
}

func buildContextTransport(target *url.URL, transfers transferpolicy.Policy) *http.Transport {
	dialContext := dialPublicContext
	if transfers.Trusts(target) {
		dialContext = (&net.Dialer{}).DialContext
	}
	return &http.Transport{DialContext: dialContext, DisableKeepAlives: true}
}

func buildContextSHA256(value string) (string, error) {
	normalized := strings.TrimPrefix(strings.TrimSpace(strings.ToLower(value)), "sha256:")
	if len(normalized) != sha256.Size*2 {
		return "", errors.New("build context hash must be a SHA-256 digest")
	}
	decoded, err := hex.DecodeString(normalized)
	if err != nil || len(decoded) != sha256.Size {
		return "", errors.New("build context hash must be a SHA-256 digest")
	}
	return normalized, nil
}

func nonPublicContextNetworks() []netip.Prefix {
	return []netip.Prefix{
		netip.MustParsePrefix("100.64.0.0/10"),
		netip.MustParsePrefix("192.0.0.0/24"),
		netip.MustParsePrefix("192.0.2.0/24"),
		netip.MustParsePrefix("198.18.0.0/15"),
		netip.MustParsePrefix("198.51.100.0/24"),
		netip.MustParsePrefix("203.0.113.0/24"),
		netip.MustParsePrefix("240.0.0.0/4"),
		netip.MustParsePrefix("64:ff9b:1::/48"),
		netip.MustParsePrefix("100::/64"),
		netip.MustParsePrefix("2001:db8::/32"),
	}
}

func dialPublicContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, fmt.Errorf("parse build context address: %w", err)
	}
	addresses, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
	if err != nil {
		return nil, fmt.Errorf("resolve build context host: %w", err)
	}
	dialer := net.Dialer{}
	for _, candidate := range addresses {
		if !isPublicContextAddress(candidate) {
			continue
		}
		connection, dialErr := dialer.DialContext(ctx, network, net.JoinHostPort(candidate.String(), port))
		if dialErr == nil {
			return connection, nil
		}
		err = errors.Join(err, dialErr)
	}
	if err == nil {
		err = fmt.Errorf("host resolved only to non-public addresses")
	}
	return nil, fmt.Errorf("dial build context host: %w", err)
}

func isPublicContextAddress(address netip.Addr) bool {
	address = address.Unmap()
	if !address.IsValid() || !address.IsGlobalUnicast() || address.IsPrivate() {
		return false
	}
	for _, blocked := range nonPublicContextNetworks() {
		if blocked.Contains(address) {
			return false
		}
	}
	return true
}

func extractTarArchive(archivePath, root string, maxExpandedBytes int64, maxEntries int) (returnErr error) {
	file, err := os.Open(archivePath)
	if err != nil {
		return fmt.Errorf("open build context archive: %w", err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			returnErr = errors.Join(returnErr, fmt.Errorf("close build context archive: %w", closeErr))
		}
	}()
	archiveReader, closeStream, err := openArchiveStream(file)
	if err != nil {
		return err
	}
	defer func() {
		returnErr = errors.Join(returnErr, closeStream())
	}()
	rootFS, err := os.OpenRoot(root)
	if err != nil {
		return fmt.Errorf("open build context root: %w", err)
	}
	defer func() {
		if closeErr := rootFS.Close(); closeErr != nil {
			returnErr = errors.Join(returnErr, fmt.Errorf("close build context root: %w", closeErr))
		}
	}()
	extractor := contextExtractor{
		root:             rootFS,
		reader:           tar.NewReader(archiveReader),
		maxExpandedBytes: maxExpandedBytes,
		maxEntries:       maxEntries,
	}
	return extractor.extractAll()
}

func openArchiveStream(file *os.File) (io.Reader, func() error, error) {
	magic := make([]byte, len(gzipMagic))
	read, err := io.ReadFull(file, magic)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) {
		return nil, nil, fmt.Errorf("read build context archive header: %w", err)
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, nil, fmt.Errorf("rewind build context archive: %w", err)
	}
	if read != len(gzipMagic) || string(magic) != gzipMagic {
		return file, func() error { return nil }, nil
	}
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return nil, nil, fmt.Errorf("open compressed build context stream: %w", err)
	}
	return gzipReader, func() error {
		return wrapCloseError("close compressed build context stream", gzipReader.Close())
	}, nil
}

func wrapCloseError(message string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", message, err)
}

type contextExtractor struct {
	root             *os.Root
	reader           *tar.Reader
	maxExpandedBytes int64
	maxEntries       int
	expandedBytes    int64
	entries          int
}

func (extractor *contextExtractor) extractAll() error {
	for {
		header, err := extractor.reader.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read build context tar entry: %w", err)
		}
		if err := extractor.extractEntry(header); err != nil {
			return err
		}
	}
}

func (extractor *contextExtractor) extractEntry(header *tar.Header) error {
	extractor.entries++
	if extractor.entries > extractor.maxEntries {
		return fmt.Errorf("build context contains more than %d entries", extractor.maxEntries)
	}
	name, err := safeArchivePath(header.Name)
	if err != nil {
		return err
	}
	mode := os.FileMode(header.Mode).Perm()
	switch header.Typeflag {
	case tar.TypeDir:
		if err := extractor.root.MkdirAll(name, mode); err != nil {
			return fmt.Errorf("create context directory %s: %w", name, err)
		}
		return nil
	case tar.TypeReg:
		return extractor.extractRegular(name, mode, header.Size)
	case tar.TypeSymlink:
		return fmt.Errorf("build context symlinks are not supported: %s", header.Name)
	default:
		return fmt.Errorf("unsupported build context entry %s type %d", header.Name, header.Typeflag)
	}
}

func (extractor *contextExtractor) extractRegular(name string, mode os.FileMode, size int64) error {
	if size < 0 || size > extractor.maxExpandedBytes-extractor.expandedBytes {
		return fmt.Errorf("build context exceeds %d byte expanded limit", extractor.maxExpandedBytes)
	}
	if parent := path.Dir(name); parent != "." {
		if err := extractor.root.MkdirAll(parent, contextParentDirMode); err != nil {
			return fmt.Errorf("create context file parent %s: %w", name, err)
		}
	}
	file, err := extractor.root.OpenFile(name, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
	if err != nil {
		return fmt.Errorf("create context file %s: %w", name, err)
	}
	written, copyErr := io.CopyN(file, extractor.reader, size)
	if copyErr != nil {
		return errors.Join(fmt.Errorf("write context file %s: %w", name, copyErr), file.Close())
	}
	if written != size {
		return errors.Join(fmt.Errorf("write context file %s: expected %d bytes, wrote %d", name, size, written), file.Close())
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close context file %s: %w", name, err)
	}
	extractor.expandedBytes += written
	return nil
}

func safeArchivePath(name string) (string, error) {
	if strings.ContainsRune(name, '\x00') || strings.Contains(name, `\`) || strings.HasPrefix(name, "/") {
		return "", fmt.Errorf("unsafe build context path %q", name)
	}
	clean := path.Clean(name)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", fmt.Errorf("unsafe build context path %q", name)
	}
	return clean, nil
}
