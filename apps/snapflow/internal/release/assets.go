// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package release

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/atomicfile"
)

const (
	FirecrackerVersion     = "v1.16.1"
	CloudHypervisorVersion = "v51.1"
	ErofsUtilsVersion      = "1.9.4"
	KernelVersion          = "ch-6.12.8-kernel-3.0-202605291"
	maximumDownloadBytes   = 64 * 1024 * 1024
	downloadTimeout        = 10 * time.Minute
	maximumRedirects       = 5
)

type upstreamAsset struct {
	URL    string
	SHA256 string
}

type platformAssets struct {
	FirecrackerArchive upstreamAsset
	FirecrackerName    string
	FirecrackerSHA256  string
	CloudHypervisor    upstreamAsset
	Kernel             upstreamAsset
}

type FetchedAssets struct {
	Firecracker     string
	CloudHypervisor string
	Kernel          string
}

func supportedPlatforms() map[string]platformAssets {
	return map[string]platformAssets{
		"amd64": {
			FirecrackerArchive: upstreamAsset{
				URL:    "https://github.com/firecracker-microvm/firecracker/releases/download/v1.16.1/firecracker-v1.16.1-x86_64.tgz",
				SHA256: "382a02a869e4d6d5cb14c40577f9545e8458021ea8b0b2d3fc10ec14d9c242e6",
			},
			FirecrackerName:   "firecracker-v1.16.1-x86_64",
			FirecrackerSHA256: "2fd0171309af7e24cf8dafc8a6f921c1434c49b5f9349bb996b7ed0a4deb8aa7",
			CloudHypervisor: upstreamAsset{
				URL:    "https://github.com/cloud-hypervisor/cloud-hypervisor/releases/download/v51.1/cloud-hypervisor-static",
				SHA256: "a153dafae80bae92545c4a9165782454b6c03958dae5b128ca9b6e9f5102397d",
			},
			Kernel: upstreamAsset{
				URL:    "https://github.com/kernel/linux/releases/download/ch-6.12.8-kernel-3.0-202605291/vmlinux-x86_64",
				SHA256: "95589ae328b6e52fffd6a6e2bf98ed6702d6327bcb2f59bfa7bd87bb9dab825e",
			},
		},
		"arm64": {
			FirecrackerArchive: upstreamAsset{
				URL:    "https://github.com/firecracker-microvm/firecracker/releases/download/v1.16.1/firecracker-v1.16.1-aarch64.tgz",
				SHA256: "8d0e69f6d6f9a1724551f607f18504052c16c1828ee3d4d7b6e6c73380871e0e",
			},
			FirecrackerName:   "firecracker-v1.16.1-aarch64",
			FirecrackerSHA256: "71ca0733576579a75cef268a8fd0ae0629b761b9844559c611f144132ac6038a",
			CloudHypervisor: upstreamAsset{
				URL:    "https://github.com/cloud-hypervisor/cloud-hypervisor/releases/download/v51.1/cloud-hypervisor-static-aarch64",
				SHA256: "9b40547644a60036ba8b6815878dee2c16359e4337e41d7c161e8ed51d330bf7",
			},
			Kernel: upstreamAsset{
				URL:    "https://github.com/kernel/linux/releases/download/ch-6.12.8-kernel-3.0-202605291/Image-arm64",
				SHA256: "12d676bf3726bcc3a2c213de0712b1ab56fd5833848e875a5edf9c0de542aed7",
			},
		},
	}
}

func FetchAssets(ctx context.Context, architecture, outputRoot string) (FetchedAssets, error) {
	assets, exists := supportedPlatforms()[strings.TrimSpace(architecture)]
	if !exists {
		return FetchedAssets{}, fmt.Errorf("unsupported Snapflow release architecture %q", architecture)
	}
	output := strings.TrimSpace(outputRoot)
	if output == "" {
		return FetchedAssets{}, errors.New("release asset output directory is required")
	}
	root, err := filepath.Abs(filepath.Clean(output))
	if err != nil {
		return FetchedAssets{}, fmt.Errorf("resolve release asset output directory: %w", err)
	}
	if err := os.MkdirAll(root, releaseDirectoryMode); err != nil {
		return FetchedAssets{}, fmt.Errorf("create release asset directory: %w", err)
	}
	client := &http.Client{
		Timeout: downloadTimeout,
		CheckRedirect: func(request *http.Request, via []*http.Request) error {
			if len(via) >= maximumRedirects {
				return errors.New("too many upstream release redirects")
			}
			return validateUpstreamURL(request.URL)
		},
	}
	archive, err := downloadAsset(ctx, client, assets.FirecrackerArchive)
	if err != nil {
		return FetchedAssets{}, fmt.Errorf("fetch Firecracker release: %w", err)
	}
	firecracker, err := extractFirecracker(archive, assets)
	if err != nil {
		return FetchedAssets{}, err
	}
	cloudHypervisor, err := downloadAsset(ctx, client, assets.CloudHypervisor)
	if err != nil {
		return FetchedAssets{}, fmt.Errorf("fetch Cloud Hypervisor release: %w", err)
	}
	kernel, err := downloadAsset(ctx, client, assets.Kernel)
	if err != nil {
		return FetchedAssets{}, fmt.Errorf("fetch guest kernel release: %w", err)
	}
	paths := FetchedAssets{
		Firecracker:     filepath.Join(root, "firecracker"),
		CloudHypervisor: filepath.Join(root, "cloud-hypervisor"),
		Kernel:          filepath.Join(root, "kernel"),
	}
	for _, file := range []struct {
		path string
		data []byte
		mode os.FileMode
	}{
		{path: paths.Firecracker, data: firecracker, mode: executableFileMode},
		{path: paths.CloudHypervisor, data: cloudHypervisor, mode: executableFileMode},
		{path: paths.Kernel, data: kernel, mode: readOnlyFileMode},
	} {
		if err := atomicfile.WriteFile(file.path, file.data, file.mode); err != nil {
			return FetchedAssets{}, err
		}
	}
	return paths, nil
}

func downloadAsset(ctx context.Context, client *http.Client, asset upstreamAsset) (result []byte, resultErr error) {
	parsed, err := url.Parse(asset.URL)
	if err != nil || validateUpstreamURL(parsed) != nil {
		return nil, errors.New("upstream release URL is invalid")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create upstream release request: %w", err)
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer func() {
		if closeErr := response.Body.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, closeErr)
		}
	}()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("upstream release returned HTTP %d", response.StatusCode)
	}
	if response.ContentLength > maximumDownloadBytes {
		return nil, errors.New("upstream release exceeds download limit")
	}
	result, err = io.ReadAll(io.LimitReader(response.Body, maximumDownloadBytes+1))
	if err != nil {
		return nil, err
	}
	if len(result) == 0 || len(result) > maximumDownloadBytes {
		return nil, errors.New("upstream release has an invalid size")
	}
	if assetDigest(result) != asset.SHA256 {
		return nil, errors.New("upstream release digest does not match the pinned identity")
	}
	return result, nil
}

func extractFirecracker(archive []byte, assets platformAssets) ([]byte, error) {
	members, err := readArchiveMembers(archive, assets.FirecrackerName)
	if err != nil {
		return nil, err
	}
	firecracker := members[assets.FirecrackerName]
	if assetDigest(firecracker) != assets.FirecrackerSHA256 {
		return nil, errors.New("firecracker digest does not match its pinned identity")
	}
	return firecracker, nil
}

func readArchiveMembers(archive []byte, names ...string) (members map[string][]byte, resultErr error) {
	gzipReader, err := gzip.NewReader(bytes.NewReader(archive))
	if err != nil {
		return nil, fmt.Errorf("open Firecracker archive: %w", err)
	}
	defer func() {
		if closeErr := gzipReader.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close Firecracker archive: %w", closeErr))
		}
	}()
	members = make(map[string][]byte, len(names))
	tarReader := tar.NewReader(gzipReader)
	for {
		header, err := tarReader.Next()
		if errors.Is(err, io.EOF) {
			return members, nil
		}
		if err != nil {
			return nil, fmt.Errorf("read Firecracker archive: %w", err)
		}
		name := filepath.Base(header.Name)
		if header.Typeflag != tar.TypeReg || !slices.Contains(names, name) {
			continue
		}
		if _, repeated := members[name]; repeated {
			return nil, fmt.Errorf("firecracker archive repeats %s", name)
		}
		if members[name], err = readArchiveMember(tarReader, header.Size); err != nil {
			return nil, err
		}
	}
}

func readArchiveMember(reader io.Reader, size int64) ([]byte, error) {
	if size <= 0 || size > maximumDownloadBytes {
		return nil, errors.New("firecracker archive member has an invalid size")
	}
	contents, err := io.ReadAll(io.LimitReader(reader, size+1))
	if err != nil || int64(len(contents)) != size {
		return nil, errors.New("read Firecracker archive member")
	}
	return contents, nil
}

func validateUpstreamURL(value *url.URL) error {
	if value == nil || value.Scheme != "https" || value.User != nil {
		return errors.New("upstream release URL must use HTTPS without credentials")
	}
	host := strings.ToLower(value.Hostname())
	if host != "github.com" && !strings.HasSuffix(host, ".githubusercontent.com") {
		return fmt.Errorf("untrusted upstream release host %q", host)
	}
	return nil
}

func assetDigest(contents []byte) string {
	hash := sha256.Sum256(contents)
	return hex.EncodeToString(hash[:])
}
