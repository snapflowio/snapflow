// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/snapflowio/common-go/pkg/guestspec"
)

const (
	loopbackBindAddress = "127.0.0.1"
	overrideBindAddress = "::1"
	invalidBindAddress  = "not-an-address"
	testCredential      = "desktop-credential\n"
	testCredentialMode  = 0o400
)

func absentCredential(t *testing.T) string {
	t.Helper()
	return filepath.Join(t.TempDir(), guestspec.DesktopService)
}

func TestLoadReadsTheInjectedBindAddress(t *testing.T) {
	for _, address := range []string{loopbackBindAddress, overrideBindAddress} {
		t.Run(address, func(t *testing.T) {
			t.Setenv(guestspec.BindAddressEnvironment, address)

			loaded, err := load(absentCredential(t))
			if err != nil {
				t.Fatalf("load config: %v", err)
			}
			if loaded.BindAddress != address || loaded.ComputerUsePluginPath != "" {
				t.Fatalf("config = %+v, want bind address %q without computer use", loaded, address)
			}
		})
	}
}

func TestLoadEnablesComputerUseWhenTheDesktopCredentialExists(t *testing.T) {
	t.Setenv(guestspec.BindAddressEnvironment, loopbackBindAddress)
	credential := absentCredential(t)
	if err := os.WriteFile(credential, []byte(testCredential), testCredentialMode); err != nil {
		t.Fatalf("write credential: %v", err)
	}

	loaded, err := load(credential)
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if loaded.ComputerUsePluginPath != guestspec.ComputerUsePluginPath {
		t.Fatalf("computer-use plugin = %q, want %q", loaded.ComputerUsePluginPath, guestspec.ComputerUsePluginPath)
	}
}

func TestLoadRejectsADesktopCredentialThatIsNotAFile(t *testing.T) {
	t.Setenv(guestspec.BindAddressEnvironment, loopbackBindAddress)
	if loaded, err := load(t.TempDir()); err == nil {
		t.Fatalf("directory accepted as the desktop credential: %+v", loaded)
	}
}

func TestLoadRejectsAMissingOrInvalidBindAddress(t *testing.T) {
	for _, value := range []string{"", invalidBindAddress} {
		t.Run(value, func(t *testing.T) {
			t.Setenv(guestspec.BindAddressEnvironment, value)

			if loaded, err := load(absentCredential(t)); err == nil {
				t.Fatalf("bind address %q accepted as %q", value, loaded.BindAddress)
			}
		})
	}
}
