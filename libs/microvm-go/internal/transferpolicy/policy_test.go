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

package transferpolicy

import (
	"errors"
	"testing"
)

const developmentObjectStorage = "http://rustfs:9000"

func TestZeroPolicyRequiresHTTPS(t *testing.T) {
	var policy Policy
	if _, err := policy.Parse("https://storage.example/bucket/object?signature=value"); err != nil {
		t.Fatalf("HTTPS URL rejected: %v", err)
	}
	if _, err := policy.Parse(developmentObjectStorage + "/bucket/object"); !errors.Is(err, ErrInsecureTransport) {
		t.Fatalf("plain-HTTP URL error = %v, want ErrInsecureTransport", err)
	}
}

func TestTrustedOriginsAllowExactPlainHTTPOrigin(t *testing.T) {
	policy, err := New([]string{developmentObjectStorage})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := policy.Parse("http://RUSTFS:9000/bucket/object"); err != nil {
		t.Fatalf("trusted origin rejected: %v", err)
	}
	for _, rawURL := range []string{"http://rustfs/bucket/object", "http://rustfs:9001/bucket/object", "http://other:9000/object"} {
		if _, err := policy.Parse(rawURL); !errors.Is(err, ErrInsecureTransport) {
			t.Errorf("Parse(%q) error = %v, want ErrInsecureTransport", rawURL, err)
		}
	}
}

func TestPolicyRejectsInvalidAuthorities(t *testing.T) {
	policy, err := New([]string{developmentObjectStorage})
	if err != nil {
		t.Fatal(err)
	}
	for _, rawURL := range []string{"https:///object", "http://user:secret@rustfs:9000/object", "/relative"} {
		if _, err := policy.Parse(rawURL); !errors.Is(err, ErrInvalidAuthority) {
			t.Errorf("Parse(%q) error = %v, want ErrInvalidAuthority", rawURL, err)
		}
	}
}

func TestNewRejectsMalformedOrigins(t *testing.T) {
	for _, origin := range []string{"ftp://rustfs:9000", "https://rustfs/path", "https://user@rustfs", "rustfs:9000", "https://rustfs?query"} {
		if _, err := New([]string{origin}); err == nil {
			t.Errorf("New(%q) unexpectedly succeeded", origin)
		}
	}
}
