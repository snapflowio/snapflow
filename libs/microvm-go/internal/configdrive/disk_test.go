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

package configdrive

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestWriteProducesAnAlignedPayloadTheGuestReads(t *testing.T) {
	directory := t.TempDir()
	injected := []byte(`[registry."docker.io"]` + "\n" + `mirrors = ["10.0.0.1:5001/mirror/docker.io"]` + "\n")
	cfg := Config{
		OSUser:           "root",
		Workdir:          "/src",
		Env:              map[string]string{"PATH": "/usr/bin"},
		InitMode:         "exec",
		InjectedFilePath: "/etc/buildkit/buildkitd.toml",
		InjectedFile:     injected,
	}
	drive := filepath.Join(directory, "config.raw")
	for _, workdir := range []string{"/src", "/workspace"} {
		cfg.Workdir = workdir
		if err := Write(drive, cfg); err != nil {
			t.Fatal(err)
		}
		info, err := os.Stat(drive)
		if err != nil || info.Size()%diskAlignmentBytes != 0 {
			t.Fatalf("drive size = %v, %v; want a %d-byte multiple", info, err, diskAlignmentBytes)
		}
		image, err := os.ReadFile(drive)
		if err != nil {
			t.Fatal(err)
		}
		decoded, file, err := Read(bytes.NewReader(image))
		if err != nil {
			t.Fatal(err)
		}
		want := cfg
		want.InjectedFile = nil
		if !reflect.DeepEqual(decoded, want) {
			t.Fatalf("decoded config = %+v, want %+v", decoded, want)
		}
		if !bytes.Equal(file, injected) {
			t.Fatalf("injected file = %q, want %q", file, injected)
		}
	}
}

func TestReadRejectsCorruptedPayloads(t *testing.T) {
	image, err := encodePayload([]byte(`{"osUser":"root"}`), nil)
	if err != nil {
		t.Fatal(err)
	}
	for name, mutate := range map[string]func([]byte){
		"magic":    func(data []byte) { data[0] = 'X' },
		"payload":  func(data []byte) { data[headerBytes] = '[' },
		"length":   func(data []byte) { data[len(payloadMagic)+7] = 0xff },
		"checksum": func(data []byte) { data[headerBytes-1] ^= 0xff },
	} {
		corrupted := append([]byte(nil), image...)
		mutate(corrupted)
		if _, _, err := Read(bytes.NewReader(corrupted)); err == nil {
			t.Fatalf("%s corruption was accepted", name)
		}
	}
	if _, _, err := Read(bytes.NewReader(make([]byte, diskAlignmentBytes))); !errors.Is(err, ErrInvalidPayload) {
		t.Fatalf("Read() of an empty drive error = %v, want ErrInvalidPayload", err)
	}
}
