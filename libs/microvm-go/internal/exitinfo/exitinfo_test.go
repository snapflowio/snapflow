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

package exitinfo

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFormatParseAndReadLatest(t *testing.T) {
	record := Record{Code: 127, GenerationID: "generation-1", Message: "command not found"}
	line := "2026-07-14T12:00:00Z microvm-init: " + Format(record) + "\r"
	parsed, ok := ParseLine(line)
	if !ok || parsed != record {
		t.Fatalf("unexpected parsed record: ok=%v record=%+v", ok, parsed)
	}

	path := filepath.Join(t.TempDir(), "app.log")
	content := "old output\n" + line + "\ntrailing output\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write log: %v", err)
	}
	latest, found, err := ReadLatest(path, DefaultTailSize, record.GenerationID)
	if err != nil || !found || latest != record {
		t.Fatalf("unexpected latest record: found=%v record=%+v err=%v", found, latest, err)
	}
}

func TestReadLatestIgnoresPreviousGeneration(t *testing.T) {
	path := filepath.Join(t.TempDir(), "app.log")
	oldRecord := Record{Code: 1, GenerationID: "old", Message: "failed"}
	if err := os.WriteFile(path, []byte(Format(oldRecord)+"\n"), 0o600); err != nil {
		t.Fatalf("write log: %v", err)
	}
	if _, found, err := ReadLatest(path, DefaultTailSize, "current"); err != nil || found {
		t.Fatalf("expected old generation to be ignored: found=%v err=%v", found, err)
	}
}

func TestParseRejectsMalformedSentinel(t *testing.T) {
	if _, ok := ParseLine("SNAPFLOW-EXIT code=invalid"); ok {
		t.Fatal("expected malformed sentinel to be rejected")
	}
}
