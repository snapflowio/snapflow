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

	"github.com/GehirnInc/crypt/sha256_crypt"
	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/computer-use/pkg/desktopenv"
)

const (
	testDesktopUser     = "snapflow"
	testDesktopPassword = "host-generated-desktop-credential"
	testCredentialMode  = 0o400
)

func TestKasmPasswordEntryMatchesKasmVNCFormat(t *testing.T) {
	entry, err := kasmPasswordEntry(desktopCredential{user: testDesktopUser, password: testDesktopPassword})
	if err != nil {
		t.Fatalf("render entry: %v", err)
	}
	fields := strings.Split(strings.TrimSuffix(entry, "\n"), kasmPasswordSeparator)
	if len(fields) != 3 || fields[0] != testDesktopUser || fields[2] != kasmPermissions {
		t.Fatalf("entry %q is not user:hash:permissions", entry)
	}
	if !strings.HasPrefix(fields[1], kasmPasswordSalt+"$") {
		t.Fatalf("hash %q does not use the KasmVNC salt", fields[1])
	}
	if err := sha256_crypt.New().Verify(fields[1], []byte(testDesktopPassword)); err != nil {
		t.Fatalf("hash does not verify the credential: %v", err)
	}
}

func TestWriteKasmPasswordFileIsOwnerOnly(t *testing.T) {
	path, err := writeKasmPasswordFile(t.TempDir(), desktopCredential{user: testDesktopUser, password: testDesktopPassword})
	if err != nil {
		t.Fatalf("write password file: %v", err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat password file: %v", err)
	}
	if mode := info.Mode().Perm(); mode != kasmPasswordFileMode {
		t.Fatalf("password file mode = %o, want %o", mode, kasmPasswordFileMode)
	}
}

func TestDesktopCredentialFailsClosed(t *testing.T) {
	credentialFile := filepath.Join(t.TempDir(), guestspec.DesktopService)
	if err := os.WriteFile(credentialFile, []byte(testDesktopPassword+"\n"), testCredentialMode); err != nil {
		t.Fatalf("write credential: %v", err)
	}
	absent := desktopCredentialSource{user: testDesktopUser, file: filepath.Join(t.TempDir(), "absent")}
	if credential, err := readDesktopCredential(absent); err == nil {
		t.Fatalf("desktop credential %+v was accepted from a missing file", credential)
	}
	credential, err := readDesktopCredential(desktopCredentialSource{user: testDesktopUser, file: credentialFile})
	if err != nil || credential.user != testDesktopUser || credential.password != testDesktopPassword {
		t.Fatalf("read credential = %+v, %v", credential, err)
	}
}

func TestHostDesktopCredentialFollowsTheGuestContract(t *testing.T) {
	source := hostDesktopCredential()
	if source.user != guestspec.DesktopAuthUser || source.file != desktopenv.SandboxRoot+guestspec.DesktopCredentialFile {
		t.Fatalf("host desktop credential = %+v", source)
	}
}
