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
	"context"
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	MinimumErofsUtilsVersion = "1.9.4"
	erofsVersionTimeout      = 10 * time.Second
	erofsVersionComponents   = 3
)

var erofsVersionPattern = regexp.MustCompile(`\(erofs-utils\)\s+(\d+)\.(\d+)(?:\.(\d+))?`)

type ErofsFormatterConfig struct {
	Path string
}

type ErofsFormatter struct {
	path    string
	version string
}

func NewErofsFormatter(cfg ErofsFormatterConfig) (*ErofsFormatter, error) {
	path := strings.TrimSpace(cfg.Path)
	if path == "" || !filepath.IsAbs(path) {
		return nil, fmt.Errorf("mkfs.erofs path %q must be absolute", cfg.Path)
	}
	path = filepath.Clean(path)
	version, err := probeErofsUtilsVersion(path)
	if err != nil {
		return nil, err
	}
	supported, err := versionAtLeast(version, MinimumErofsUtilsVersion)
	if err != nil {
		return nil, err
	}
	if !supported {
		return nil, fmt.Errorf("mkfs.erofs %s is erofs-utils %s; at least %s is required", path, version, MinimumErofsUtilsVersion)
	}
	return &ErofsFormatter{path: path, version: version}, nil
}

func (f *ErofsFormatter) Path() string {
	return f.path
}

func (f *ErofsFormatter) Version() string {
	return f.version
}

func probeErofsUtilsVersion(path string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), erofsVersionTimeout)
	defer cancel()
	output, err := exec.CommandContext(ctx, path, "--version").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("run %s --version: %w: %s", path, err, strings.TrimSpace(string(output)))
	}
	match := erofsVersionPattern.FindStringSubmatch(string(output))
	if match == nil {
		return "", fmt.Errorf("%s did not report an erofs-utils version: %s", path, strings.TrimSpace(string(output)))
	}
	if match[3] == "" {
		match[3] = "0"
	}
	return strings.Join(match[1:], "."), nil
}

func versionAtLeast(version, minimum string) (bool, error) {
	actual, err := parseVersion(version)
	if err != nil {
		return false, err
	}
	required, err := parseVersion(minimum)
	if err != nil {
		return false, err
	}
	for index := range actual {
		if actual[index] != required[index] {
			return actual[index] > required[index], nil
		}
	}
	return true, nil
}

func parseVersion(value string) ([erofsVersionComponents]int, error) {
	var parsed [erofsVersionComponents]int
	parts := strings.Split(value, ".")
	if len(parts) != erofsVersionComponents {
		return parsed, fmt.Errorf("version %q is not major.minor.patch", value)
	}
	for index, part := range parts {
		number, err := strconv.Atoi(part)
		if err != nil || number < 0 {
			return parsed, errors.Join(fmt.Errorf("version %q has an invalid component %q", value, part), err)
		}
		parsed[index] = number
	}
	return parsed, nil
}
