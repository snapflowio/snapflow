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
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"runtime"
	"sort"
	"strings"

	"github.com/google/uuid"
)

const (
	KeySchemaVersion          = 6
	SnapshotFormat            = "firecracker-full-v1"
	FirecrackerCPUTemplate    = "none"
	cpuInfoPath               = "/proc/cpuinfo"
	kernelReleasePath         = "/proc/sys/kernel/osrelease"
	cpuInfoFieldSeparator     = ":"
	cpuSignatureFieldJoiner   = "="
	cpuSignatureArchSeparator = ":"
)

type Key struct {
	SchemaVersion         int      `json:"schemaVersion"`
	SnapshotFormat        string   `json:"snapshotFormat"`
	ImageDigest           string   `json:"imageDigest"`
	ImageCacheFormat      string   `json:"imageCacheFormat"`
	FirecrackerDigest     string   `json:"firecrackerDigest"`
	KernelDigest          string   `json:"kernelDigest"`
	InitrdDigest          string   `json:"initrdDigest"`
	PlatformBundleDigests []string `json:"platformBundleDigests,omitempty"`
	GuestConfigDigest     string   `json:"guestConfigDigest"`
	NetworkDigest         string   `json:"networkDigest"`
	CPUSignature          string   `json:"cpuSignature"`
	CPUTemplate           string   `json:"cpuTemplate"`
	HostKernelRelease     string   `json:"hostKernelRelease"`
	Platform              string   `json:"platform"`
	CPUVCPUs              int64    `json:"cpuVcpus"`
	MemoryGiB             int64    `json:"memoryGiB"`
	StorageGiB            int64    `json:"storageGiB"`
}

type HostFingerprint struct {
	CPUSignature  string
	KernelRelease string
}

func KeyID(key Key) (string, error) {
	data, err := json.Marshal(key)
	if err != nil {
		return "", fmt.Errorf("encode template key: %w", err)
	}
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:]), nil
}

func SeedID(keyID string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(keyID)).String()
}

func readHostFingerprint() (HostFingerprint, error) {
	cpuSignature, err := hostCPUSignature()
	if err != nil {
		return HostFingerprint{}, fmt.Errorf("identify template host CPU: %w", err)
	}
	kernelRelease, err := hostKernelRelease()
	if err != nil {
		return HostFingerprint{}, fmt.Errorf("identify template host kernel: %w", err)
	}
	return HostFingerprint{CPUSignature: cpuSignature, KernelRelease: kernelRelease}, nil
}

func hostCPUSignature() (string, error) {
	data, err := os.ReadFile(cpuInfoPath)
	if err != nil {
		return "", err
	}
	selected := make(map[string]struct{})
	for line := range strings.SplitSeq(string(data), "\n") {
		name, value, found := strings.Cut(line, cpuInfoFieldSeparator)
		if !found {
			continue
		}
		normalizedName := strings.TrimSpace(name)
		switch normalizedName {
		case "vendor_id", "cpu family", "model", "stepping", "microcode", "flags",
			"CPU implementer", "CPU architecture", "CPU variant", "CPU part", "CPU revision", "Features":
			selected[normalizedName+cpuSignatureFieldJoiner+strings.TrimSpace(value)] = struct{}{}
		}
	}
	if len(selected) == 0 {
		return "", errors.New("host CPU identity fields are unavailable")
	}
	values := make([]string, 0, len(selected))
	for value := range selected {
		values = append(values, value)
	}
	sort.Strings(values)
	digest := sha256.Sum256([]byte(strings.Join(values, "\n")))
	return runtime.GOARCH + cpuSignatureArchSeparator + hex.EncodeToString(digest[:]), nil
}

func hostKernelRelease() (string, error) {
	data, err := os.ReadFile(kernelReleasePath)
	if err != nil {
		return "", err
	}
	release := strings.TrimSpace(string(data))
	if release == "" {
		return "", errors.New("host kernel release is empty")
	}
	return release, nil
}
