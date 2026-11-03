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

import "testing"

func TestParsePlatformNormalizesAliases(t *testing.T) {
	platform, err := ParsePlatform("linux/x86_64")
	if err != nil {
		t.Fatalf("parse platform: %v", err)
	}
	if platform.String() != "linux/amd64" {
		t.Fatalf("unexpected platform: %s", platform)
	}
}

func TestParsePlatformRejectsNonLinux(t *testing.T) {
	if _, err := ParsePlatform("darwin/arm64"); err == nil {
		t.Fatal("expected non-linux platform to fail")
	}
}
