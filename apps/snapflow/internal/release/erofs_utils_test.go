// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package release

import (
	"os"
	"path/filepath"
	"regexp"
	"testing"
)

const (
	workspaceRoot          = "../../../.."
	erofsUtilsBuildScript  = ".devcontainer/scripts/build-erofs-utils.sh"
	erofsUtilsDockerfile   = "images/erofs-utils/Dockerfile"
	devcontainerDockerfile = ".devcontainer/Dockerfile"
)

var (
	buildScriptVersionPattern = regexp.MustCompile(`(?m)^EROFS_UTILS_VERSION=(\S+)$`)
	alpineBasePattern         = regexp.MustCompile(`(?m)^FROM (alpine:\S+@sha256:[0-9a-f]{64}) AS `)
)

func readWorkspaceFile(t *testing.T, relative string) string {
	t.Helper()
	content, err := os.ReadFile(filepath.Join(workspaceRoot, relative))
	if err != nil {
		t.Fatal(err)
	}
	return string(content)
}

func TestShippedErofsUtilsMatchesItsBuild(t *testing.T) {
	match := buildScriptVersionPattern.FindStringSubmatch(readWorkspaceFile(t, erofsUtilsBuildScript))
	if match == nil || match[1] != ErofsUtilsVersion {
		t.Fatalf("%s builds erofs-utils %v, the release declares %s", erofsUtilsBuildScript, match, ErofsUtilsVersion)
	}
}

func TestDevelopmentAndReleaseBuildErofsUtilsOnOneBase(t *testing.T) {
	release := alpineBasePattern.FindStringSubmatch(readWorkspaceFile(t, erofsUtilsDockerfile))
	development := alpineBasePattern.FindStringSubmatch(readWorkspaceFile(t, devcontainerDockerfile))
	if release == nil || development == nil || release[1] != development[1] {
		t.Fatalf("erofs-utils build bases differ: release %v, development %v", release, development)
	}
}
