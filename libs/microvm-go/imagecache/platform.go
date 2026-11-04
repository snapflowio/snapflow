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

package imagecache

import (
	"fmt"
	"runtime"
	"strings"

	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
)

const (
	platformWithOSParts      = 2
	platformWithVariantParts = 3
)

type Platform struct {
	OS           string
	Architecture string
	Variant      string
}

func ParsePlatform(value string) (Platform, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return Platform{}, fmt.Errorf("%w: platform is empty", ErrInvalidPlatform)
	}

	parts := strings.Split(value, "/")
	if len(parts) > platformWithVariantParts {
		return Platform{}, fmt.Errorf("%w %q: expected os/arch[/variant]", ErrInvalidPlatform, value)
	}
	for _, part := range parts {
		if strings.TrimSpace(part) == "" {
			return Platform{}, fmt.Errorf("%w %q: expected os/arch[/variant]", ErrInvalidPlatform, value)
		}
	}

	platform := Platform{OS: "linux"}
	switch len(parts) {
	case 1:
		platform.Architecture = parts[0]
	case platformWithOSParts:
		platform.OS = parts[0]
		platform.Architecture = parts[1]
	case platformWithVariantParts:
		platform.OS = parts[0]
		platform.Architecture = parts[1]
		platform.Variant = parts[2]
	}

	platform = platform.Normalize()
	if err := platform.Validate(); err != nil {
		return Platform{}, err
	}
	return platform, nil
}

func HostPlatform() Platform {
	return Platform{OS: "linux", Architecture: runtime.GOARCH}.Normalize()
}

func ResolvePlatform(value string) (Platform, error) {
	if strings.TrimSpace(value) == "" {
		return HostPlatform(), nil
	}
	return ParsePlatform(value)
}

func (p Platform) Normalize() Platform {
	os := strings.ToLower(strings.TrimSpace(p.OS))
	if os == "" {
		os = "linux"
	}

	arch := strings.ToLower(strings.TrimSpace(p.Architecture))
	switch arch {
	case "x86_64", "x86-64":
		arch = "amd64"
	case "aarch64":
		arch = "arm64"
	}

	return Platform{
		OS:           os,
		Architecture: arch,
		Variant:      strings.ToLower(strings.TrimSpace(p.Variant)),
	}
}

func (p Platform) Validate() error {
	if p.OS != "linux" {
		return fmt.Errorf("%w: unsupported os %q: only linux guests are supported", ErrInvalidPlatform, p.OS)
	}

	switch p.Architecture {
	case "amd64", "arm64":
		return nil
	default:
		return fmt.Errorf("%w: unsupported architecture %q: must be amd64 or arm64", ErrInvalidPlatform, p.Architecture)
	}
}

func (p Platform) String() string {
	if p.OS == "" && p.Architecture == "" {
		return ""
	}
	value := p.OS + "/" + p.Architecture
	if p.Variant != "" {
		value += "/" + p.Variant
	}
	return value
}

func (p Platform) Matches(other Platform) bool {
	p = p.Normalize()
	other = other.Normalize()
	return p.OS == other.OS && p.Architecture == other.Architecture
}

func (p Platform) OCI() ocispec.Platform {
	return ocispec.Platform{
		OS:           p.OS,
		Architecture: p.Architecture,
		Variant:      p.Variant,
	}
}
