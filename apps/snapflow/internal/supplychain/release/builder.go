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
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/snapflowio/microvm-go/guest"
)

const (
	manifestOS  = "linux"
	CommandPath = "bin/snapflow"
)

func releasePaths() map[FileRole]string {
	return map[FileRole]string{
		RoleSnapflow:        CommandPath,
		RoleSnapflowd:       "bin/snapflowd",
		RoleFirecracker:     "bin/firecracker",
		RoleCloudHypervisor: "bin/cloud-hypervisor",
		RoleMkfsErofs:       "bin/mkfs.erofs",
		RoleKernel:          "boot/kernel",
		RoleInitrd:          "boot/initrd",
		RoleNotices:         "licenses/THIRD_PARTY_NOTICES.md",
	}
}

type BundleInputs struct {
	Snapflow        string
	Snapflowd       string
	Firecracker     string
	CloudHypervisor string
	MkfsErofs       string
	Kernel          string
	Initrd          string
	Notices         string
}

type BundleConfig struct {
	Version      string
	Revision     string
	BuiltAt      time.Time
	Architecture string
	GuestRelease string
	Inputs       BundleInputs
	OutputRoot   string
}

func BuildBundle(cfg BundleConfig) (string, error) {
	manifest, sources, err := buildManifest(cfg)
	if err != nil {
		return "", err
	}
	output := filepath.Join(cfg.OutputRoot, BundleFileName(manifest.Version, manifest.Architecture))
	if err := WriteBundle(output, manifest, sources); err != nil {
		return "", err
	}
	return output, nil
}

type buildInput struct {
	role    FileRole
	source  string
	version string
}

func (inputs BundleInputs) buildInputs(releaseVersion string) []buildInput {
	pinned := []buildInput{
		{role: RoleSnapflow, source: inputs.Snapflow, version: releaseVersion},
		{role: RoleSnapflowd, source: inputs.Snapflowd, version: releaseVersion},
		{role: RoleFirecracker, source: inputs.Firecracker, version: FirecrackerVersion},
		{role: RoleCloudHypervisor, source: inputs.CloudHypervisor, version: CloudHypervisorVersion},
		{role: RoleMkfsErofs, source: inputs.MkfsErofs, version: ErofsUtilsVersion},
		{role: RoleKernel, source: inputs.Kernel, version: KernelVersion},
		{role: RoleInitrd, source: inputs.Initrd, version: strconv.Itoa(guest.ControlProtocolVersion)},
	}
	if strings.TrimSpace(inputs.Notices) != "" {
		pinned = append(pinned, buildInput{role: RoleNotices, source: inputs.Notices, version: releaseVersion})
	}
	return pinned
}

func buildManifest(cfg BundleConfig) (Manifest, BundleSources, error) {
	architecture := strings.TrimSpace(cfg.Architecture)
	if architecture == "" {
		architecture = runtime.GOARCH
	}
	inputs := cfg.Inputs.buildInputs(cfg.Version)
	manifest := Manifest{
		Schema:       Schema,
		Product:      Product,
		Version:      strings.TrimSpace(cfg.Version),
		Revision:     strings.TrimSpace(cfg.Revision),
		BuiltAt:      cfg.BuiltAt.UTC(),
		OS:           manifestOS,
		Architecture: architecture,
		Guest:        GuestRelease{Reference: cfg.GuestRelease, ControlProtocolVersion: guest.ControlProtocolVersion},
		Files:        make([]File, 0, len(inputs)),
	}
	sources := make(BundleSources, len(inputs))
	for _, input := range inputs {
		file, err := input.file()
		if err != nil {
			return Manifest{}, nil, err
		}
		manifest.Files = append(manifest.Files, file)
		sources[input.role] = input.source
	}
	SortFiles(manifest.Files)
	if err := manifest.Validate(); err != nil {
		return Manifest{}, nil, err
	}
	return manifest, sources, nil
}

func (input buildInput) file() (File, error) {
	releasePath, exists := releasePaths()[input.role]
	if !exists {
		return File{}, fmt.Errorf("the Snapflow release input role %q is unknown", input.role)
	}
	size, identity, err := sourceIdentity(input.source)
	if err != nil {
		return File{}, fmt.Errorf("identify Snapflow release input %q: %w", input.role, err)
	}
	return File{
		Role: input.role, Path: releasePath, Version: strings.TrimSpace(input.version),
		SHA256: identity, Size: size, Mode: roleMode(input.role),
	}, nil
}

func sourceIdentity(sourcePath string) (size int64, identity string, resultErr error) {
	file, err := os.Open(sourcePath)
	if err != nil {
		return 0, "", err
	}
	defer func() {
		if err := file.Close(); err != nil {
			resultErr = errors.Join(resultErr, err)
		}
	}()
	info, err := file.Stat()
	if err != nil {
		return 0, "", err
	}
	if !info.Mode().IsRegular() || info.Size() <= 0 || info.Size() > maximumArchiveFileBytes {
		return 0, "", errors.New("source must be a non-empty regular file within the release size limit")
	}
	hash := sha256.New()
	written, err := io.Copy(hash, io.LimitReader(file, maximumArchiveFileBytes+1))
	if err != nil {
		return 0, "", err
	}
	if written != info.Size() {
		return 0, "", errors.New("source changed while hashing")
	}
	return written, digestPrefix + hex.EncodeToString(hash.Sum(nil)), nil
}
