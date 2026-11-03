// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package config

import (
	"errors"
	"fmt"
	"io/fs"
	"net"
	"os"
	"strings"

	"github.com/snapflowio/common-go/pkg/guestspec"
)

type Config struct {
	BindAddress           string
	ComputerUsePluginPath string
}

func Load() (Config, error) {
	return load(guestspec.DesktopCredentialFile)
}

func load(desktopCredentialFile string) (Config, error) {
	bindAddress := strings.TrimSpace(os.Getenv(guestspec.BindAddressEnvironment))
	if net.ParseIP(bindAddress) == nil {
		return Config{}, fmt.Errorf("%s must be an IP address, got %q", guestspec.BindAddressEnvironment, bindAddress)
	}
	desktop, err := desktopEnabled(desktopCredentialFile)
	if err != nil {
		return Config{}, err
	}
	cfg := Config{BindAddress: bindAddress}
	if desktop {
		cfg.ComputerUsePluginPath = guestspec.ComputerUsePluginPath
	}
	return cfg, nil
}

func desktopEnabled(credentialFile string) (bool, error) {
	info, err := os.Stat(credentialFile)
	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("detect the desktop capability: %w", err)
	}
	if !info.Mode().IsRegular() {
		return false, fmt.Errorf("desktop credential %s is not a regular file", credentialFile)
	}
	return true, nil
}
