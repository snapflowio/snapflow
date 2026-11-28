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
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/GehirnInc/crypt/sha256_crypt"
	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/computer-use/pkg/desktopenv"
)

const (
	kasmPasswordFileName   = "kasmpasswd"
	kasmPasswordFileMode   = 0o600
	kasmPasswordSalt       = "$5$kasm"
	kasmPermissions        = "rw"
	kasmPasswordSeparator  = ":"
	kasmPasswordMinimumLen = 6
	kasmPasswordMaximumLen = 128
)

type desktopCredential struct {
	user     string
	password string
}

type desktopCredentialSource struct {
	user string
	file string
}

func hostDesktopCredential() desktopCredentialSource {
	return desktopCredentialSource{user: guestspec.DesktopAuthUser, file: desktopenv.CredentialFile}
}

func readDesktopCredential(source desktopCredentialSource) (desktopCredential, error) {
	content, err := os.ReadFile(source.file)
	if err != nil {
		return desktopCredential{}, fmt.Errorf("read desktop credential: %w", err)
	}
	password := strings.TrimSpace(string(content))
	if len(password) < kasmPasswordMinimumLen || len(password) > kasmPasswordMaximumLen {
		return desktopCredential{}, fmt.Errorf("desktop credential must be %d to %d bytes", kasmPasswordMinimumLen, kasmPasswordMaximumLen)
	}
	return desktopCredential{user: source.user, password: password}, nil
}

func kasmPasswordEntry(credential desktopCredential) (string, error) {
	hash, err := sha256_crypt.New().Generate([]byte(credential.password), []byte(kasmPasswordSalt))
	if err != nil {
		return "", fmt.Errorf("hash desktop credential: %w", err)
	}
	return strings.Join([]string{credential.user, hash, kasmPermissions}, kasmPasswordSeparator) + "\n", nil
}

func writeKasmPasswordFile(configDir string, credential desktopCredential) (string, error) {
	entry, err := kasmPasswordEntry(credential)
	if err != nil {
		return "", err
	}
	path := filepath.Join(configDir, kasmPasswordFileName)
	if err := atomicfile.WriteFile(path, []byte(entry), kasmPasswordFileMode); err != nil {
		return "", fmt.Errorf("install KasmVNC password file: %w", err)
	}
	return path, nil
}
