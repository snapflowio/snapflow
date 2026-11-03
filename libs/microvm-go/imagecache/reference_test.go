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

func TestParseImageRefDefaultsDockerHubLatest(t *testing.T) {
	ref, err := ParseImageRef("alpine")
	if err != nil {
		t.Fatalf("parse image ref: %v", err)
	}
	if ref.String() != "docker.io/library/alpine:latest" {
		t.Fatalf("unexpected normalized ref: %s", ref.String())
	}
	if ref.Repository() != "docker.io/library/alpine" {
		t.Fatalf("unexpected repository: %s", ref.Repository())
	}
	if ref.Tag() != "latest" {
		t.Fatalf("unexpected tag: %s", ref.Tag())
	}
}

func TestParseImageRefSupportsDigestRefs(t *testing.T) {
	ref, err := ParseImageRef("ubuntu@sha256:1111111111111111111111111111111111111111111111111111111111111111")
	if err != nil {
		t.Fatalf("parse image ref: %v", err)
	}
	if !ref.IsDigest() {
		t.Fatal("expected digest ref")
	}
	if ref.DigestHex() != "1111111111111111111111111111111111111111111111111111111111111111" {
		t.Fatalf("unexpected digest hex: %s", ref.DigestHex())
	}
}
