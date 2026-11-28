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

//go:build linux

package guestinit

import (
	"errors"
	"fmt"
	"os"
	"time"

	guestconfig "github.com/snapflowio/microvm-go/guest/config"
	"github.com/snapflowio/microvm-go/internal/configdrive"
)

const (
	configDevice            = "/dev/vdc"
	configDeviceWaitTimeout = 2 * time.Second
)

type Config = configdrive.Config

func readConfig() (*Config, []byte, error) {
	if err := waitForPath(configDevice, configDeviceWaitTimeout); err != nil {
		return nil, nil, fmt.Errorf("wait for config disk: %w", err)
	}
	device, err := os.Open(configDevice)
	if err != nil {
		return nil, nil, fmt.Errorf("open config disk: %w", err)
	}
	cfg, injectedFile, readErr := configdrive.Read(device)
	if err := errors.Join(readErr, device.Close()); err != nil {
		return nil, nil, fmt.Errorf("read config: %w", err)
	}
	if cfg.Workdir == "" {
		cfg.Workdir = "/"
	}
	if cfg.Env == nil {
		cfg.Env = map[string]string{}
	}
	normalizeGuestInitConfig(&cfg)
	return &cfg, injectedFile, nil
}

func normalizeGuestInitConfig(cfg *Config) {
	defaults := guestconfig.Defaults()
	if cfg.GuestInit.ProjectDir == "" {
		cfg.GuestInit.ProjectDir = cfg.Workdir
	}
	if cfg.GuestInit.ProjectDir == "" {
		cfg.GuestInit.ProjectDir = defaults.ProjectDir
	}
	if cfg.GuestInit.OSUser == "" {
		cfg.GuestInit.OSUser = defaults.OSUser
	}
	if cfg.GuestInit.LogLevel == "" {
		cfg.GuestInit.LogLevel = defaults.LogLevel
	}
	if cfg.GuestInit.LogFilePath == "" {
		cfg.GuestInit.LogFilePath = defaults.LogFilePath
	}
}
