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

package computeruse

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/GehirnInc/crypt/sha256_crypt"
)

const (
	testRotatedDesktopPassword = "rotated-host-generated-desktop-credential"
	testCredentialName         = "desktop"
	testRotationTimeout        = 5 * time.Second
	testRotationPollInterval   = 10 * time.Millisecond
)

func newTestKasmPasswordSync(t *testing.T, credentialFile string) *kasmPasswordSync {
	t.Helper()
	syncer, err := newKasmPasswordSync(kasmPasswordSyncConfig{
		Source:    desktopCredentialSource{user: testDesktopUser, file: credentialFile},
		ConfigDir: t.TempDir(),
	})
	if err != nil {
		t.Fatalf("create KasmVNC password sync: %v", err)
	}
	t.Cleanup(func() {
		if err := syncer.Close(); err != nil {
			t.Errorf("close KasmVNC password sync: %v", err)
		}
	})
	return syncer
}

func replaceCredential(t *testing.T, credentialFile, password string) {
	t.Helper()
	temporary := credentialFile + ".rotating"
	if err := os.WriteFile(temporary, []byte(password+"\n"), testCredentialMode); err != nil {
		t.Fatalf("write rotated credential: %v", err)
	}
	if err := os.Rename(temporary, credentialFile); err != nil {
		t.Fatalf("install rotated credential: %v", err)
	}
}

func passwordFileAccepts(t *testing.T, passwordFile, password string) bool {
	t.Helper()
	contents, err := os.ReadFile(passwordFile)
	if err != nil {
		t.Fatalf("read password file: %v", err)
	}
	fields := strings.Split(strings.TrimSuffix(string(contents), "\n"), kasmPasswordSeparator)
	if len(fields) != 3 {
		t.Fatalf("password file %q is not user:hash:permissions", contents)
	}
	return sha256_crypt.New().Verify(fields[1], []byte(password)) == nil
}

func TestKasmPasswordSyncWritesCurrentCredential(t *testing.T) {
	credentialFile := filepath.Join(t.TempDir(), testCredentialName)
	replaceCredential(t, credentialFile, testDesktopPassword)

	syncer := newTestKasmPasswordSync(t, credentialFile)

	if !passwordFileAccepts(t, syncer.PasswordFile(), testDesktopPassword) {
		t.Fatal("password file does not accept the delivered credential")
	}
	if credential := syncer.Credential(); credential.user != testDesktopUser || credential.password != testDesktopPassword {
		t.Fatalf("credential = %+v, want the delivered credential", credential)
	}
}

func TestKasmPasswordSyncAppliesRotatedCredential(t *testing.T) {
	credentialFile := filepath.Join(t.TempDir(), testCredentialName)
	replaceCredential(t, credentialFile, testDesktopPassword)
	syncer := newTestKasmPasswordSync(t, credentialFile)

	replaceCredential(t, credentialFile, testRotatedDesktopPassword)

	deadline := time.Now().Add(testRotationTimeout)
	for syncer.Credential().password != testRotatedDesktopPassword {
		if time.Now().After(deadline) {
			t.Fatal("rotated credential was not applied")
		}
		time.Sleep(testRotationPollInterval)
	}
	if !passwordFileAccepts(t, syncer.PasswordFile(), testRotatedDesktopPassword) {
		t.Fatal("password file does not accept the rotated credential")
	}
	if passwordFileAccepts(t, syncer.PasswordFile(), testDesktopPassword) {
		t.Fatal("password file still accepts the previous credential")
	}
}

func TestKasmPasswordSyncKeepsCredentialWhenRotationIsInvalid(t *testing.T) {
	credentialFile := filepath.Join(t.TempDir(), testCredentialName)
	replaceCredential(t, credentialFile, testDesktopPassword)
	syncer := newTestKasmPasswordSync(t, credentialFile)

	replaceCredential(t, credentialFile, "short")

	if err := syncer.sync(); err == nil {
		t.Fatal("sync accepted a credential below the KasmVNC minimum length")
	}
	if !passwordFileAccepts(t, syncer.PasswordFile(), testDesktopPassword) {
		t.Fatal("an invalid rotation replaced the working credential")
	}
}

func TestNewKasmPasswordSyncValidatesConfig(t *testing.T) {
	credentialFile := filepath.Join(t.TempDir(), testCredentialName)
	replaceCredential(t, credentialFile, testDesktopPassword)
	tests := map[string]kasmPasswordSyncConfig{
		"missing user": {Source: desktopCredentialSource{file: credentialFile}, ConfigDir: t.TempDir()},
		"relative file": {
			Source:    desktopCredentialSource{user: testDesktopUser, file: testCredentialName},
			ConfigDir: t.TempDir(),
		},
		"missing config directory": {Source: desktopCredentialSource{user: testDesktopUser, file: credentialFile}},
		"missing credential": {
			Source:    desktopCredentialSource{user: testDesktopUser, file: filepath.Join(t.TempDir(), testCredentialName)},
			ConfigDir: t.TempDir(),
		},
	}
	for name, cfg := range tests {
		t.Run(name, func(t *testing.T) {
			if syncer, err := newKasmPasswordSync(cfg); err == nil {
				t.Fatalf("newKasmPasswordSync() = %+v, want an error", syncer)
			}
		})
	}
}
