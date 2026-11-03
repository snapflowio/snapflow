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
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

const (
	recordedArtifactCount = 4
	recordedArtifactBytes = 4 << 20
	templateFilePerm      = 0o600
)

func recordTemplateArtifacts(t *testing.T) []artifactValidation {
	t.Helper()
	directory := t.TempDir()
	recorder := &Cache{}
	artifacts := make([]artifactValidation, 0, recordedArtifactCount)
	for index := range recordedArtifactCount {
		path := filepath.Join(directory, fmt.Sprintf("artifact-%d", index))
		content := make([]byte, recordedArtifactBytes)
		content[index] = byte(index + 1)
		if err := os.WriteFile(path, content, templateFilePerm); err != nil {
			t.Fatal(err)
		}
		recorded, err := recorder.captureArtifact(path, path)
		if err != nil {
			t.Fatal(err)
		}
		artifacts = append(artifacts, artifactValidation{label: path, path: path, expected: recorded})
	}
	return artifacts
}

func cachedDigestCount(backend *Cache) int {
	count := 0
	backend.digests.Range(func(any, any) bool {
		count++
		return true
	})
	return count
}

func TestStartupTemplateVerificationHashesNoArtifactContent(t *testing.T) {
	artifacts := recordTemplateArtifacts(t)
	restarted := &Cache{}
	if err := restarted.verifyArtifacts(artifacts, verifyArtifactIdentity); err != nil {
		t.Fatalf("identity verification rejected recorded artifacts: %v", err)
	}
	if hashed := cachedDigestCount(restarted); hashed != 0 {
		t.Fatalf("startup verification hashed %d artifacts, want 0", hashed)
	}
	if err := restarted.verifyArtifacts(artifacts, verifyArtifactContent); err != nil {
		t.Fatalf("content verification rejected recorded artifacts: %v", err)
	}
	if hashed := cachedDigestCount(restarted); hashed != recordedArtifactCount {
		t.Fatalf("content verification hashed %d artifacts, want %d", hashed, recordedArtifactCount)
	}
}

func TestContentVerificationDetectsCorruptionThatKeepsFileIdentity(t *testing.T) {
	artifacts := recordTemplateArtifacts(t)
	target := artifacts[0]
	file, err := os.OpenFile(target.path, os.O_WRONLY, templateFilePerm)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.WriteAt([]byte("corrupt"), recordedArtifactBytes/2); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	recordedAt := time.Unix(0, target.expected.ModifiedAtUnixNano)
	if err := os.Chtimes(target.path, recordedAt, recordedAt); err != nil {
		t.Fatal(err)
	}
	restarted := &Cache{}
	if err := restarted.verifyArtifact(&target, verifyArtifactIdentity); err != nil {
		t.Fatalf("identity verification unexpectedly read content: %v", err)
	}
	if err := restarted.verifyArtifact(&target, verifyArtifactContent); err == nil {
		t.Fatal("content verification accepted a corrupted artifact")
	}
}

func reinstallArtifact(t *testing.T, path string, content []byte) {
	t.Helper()
	replacement := path + ".reinstall"
	if err := os.WriteFile(replacement, content, templateFilePerm); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(replacement, path); err != nil {
		t.Fatal(err)
	}
}

func TestIdentityVerificationAcceptsAnArtifactReinstalledWithIdenticalContent(t *testing.T) {
	artifacts := recordTemplateArtifacts(t)
	reinstalled := artifacts[0]
	content, err := os.ReadFile(reinstalled.path)
	if err != nil {
		t.Fatal(err)
	}
	reinstallArtifact(t, reinstalled.path, content)
	backend := &Cache{}
	if err := backend.verifyArtifact(&reinstalled, verifyArtifactIdentity); err != nil {
		t.Fatalf("a rootfs reinstalled with identical content was rejected: %v", err)
	}
	current, err := statArtifact(reinstalled.path)
	if err != nil {
		t.Fatal(err)
	}
	if !current.matches(reinstalled.current) || reinstalled.current.SHA256 != reinstalled.expected.SHA256 {
		t.Fatalf("refreshed artifact = %+v, want the reinstalled file identity with the recorded digest", reinstalled.current)
	}
	if reinstalled.current.Inode == reinstalled.expected.Inode {
		t.Fatal("the reinstalled artifact kept its old inode, so the test did not replace it")
	}
}

func TestIdentityVerificationDetectsChangedContent(t *testing.T) {
	artifacts := recordTemplateArtifacts(t)
	changed := artifacts[1]
	content, err := os.ReadFile(changed.path)
	if err != nil {
		t.Fatal(err)
	}
	content[0] ^= 0xff
	reinstallArtifact(t, changed.path, content)
	if err := (&Cache{}).verifyArtifact(&changed, verifyArtifactIdentity); err == nil {
		t.Fatal("identity verification accepted an artifact whose content changed")
	}
	resized := artifacts[2]
	reinstallArtifact(t, resized.path, append(content, 0))
	if err := (&Cache{}).verifyArtifact(&resized, verifyArtifactIdentity); err == nil {
		t.Fatal("identity verification accepted an artifact whose size changed")
	}
}

func TestContentVerificationIgnoresADigestCachedForTheSameIdentity(t *testing.T) {
	artifacts := recordTemplateArtifacts(t)
	target := artifacts[0]
	running := &Cache{}
	if err := running.verifyArtifact(&target, verifyArtifactContent); err != nil {
		t.Fatalf("content verification rejected a recorded artifact: %v", err)
	}
	file, err := os.OpenFile(target.path, os.O_WRONLY, templateFilePerm)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.WriteAt([]byte("corrupt"), recordedArtifactBytes/2); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	recordedAt := time.Unix(0, target.expected.ModifiedAtUnixNano)
	if err := os.Chtimes(target.path, recordedAt, recordedAt); err != nil {
		t.Fatal(err)
	}
	if err := running.verifyArtifact(&target, verifyArtifactContent); err == nil {
		t.Fatal("content verification trusted a digest cached before the artifact was corrupted")
	}
}
