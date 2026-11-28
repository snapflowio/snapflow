// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"encoding/json"
	"fmt"
	"net/netip"
	"path/filepath"
)

const (
	hostSettingsSchema   = "snapflow.machine-host-settings.v2"
	hostSettingsFilename = "host-settings.json"
	hostSettingsFileMode = 0o600
	maximumSettingsBytes = 4 * 1024
)

type HostSettings struct {
	OfferedVCPUs      *int64           `json:"offeredVcpus,omitempty"`
	OfferedMemoryGiB  *int64           `json:"offeredMemoryGib,omitempty"`
	OfferedDiskGiB    *int64           `json:"offeredDiskGib,omitempty"`
	MaxUnclaimedFloat *int64           `json:"maxUnclaimedFloat,omitempty"`
	Traffic           *TrafficSettings `json:"traffic,omitempty"`
	PublicAddresses   []netip.Addr     `json:"publicAddresses,omitempty"`
}

type TrafficSettings struct {
	UploadKbps              int64  `json:"uploadKbps"`
	DownloadKbps            int64  `json:"downloadKbps"`
	HostUploadKbps          int64  `json:"hostUploadKbps,omitempty"`
	BurstMiB                int64  `json:"burstMib"`
	PacketsPerSecond        uint32 `json:"packetsPerSecond"`
	NewConnectionsPerSecond uint32 `json:"newConnectionsPerSecond"`
	MaxConnections          uint32 `json:"maxConnections"`
	Enforce                 bool   `json:"enforce"`
}

type hostSettingsFile struct {
	Schema   string          `json:"schema"`
	Settings json.RawMessage `json:"settings"`
}

func SaveHostSettings(stateDirectory string, settings HostSettings) error {
	encoded, err := json.Marshal(settings)
	if err != nil {
		return fmt.Errorf("encode the host settings: %w", err)
	}
	err = WriteJSONFile(
		filepath.Join(stateDirectory, hostSettingsFilename),
		hostSettingsFile{Schema: hostSettingsSchema, Settings: encoded},
		directoryMode, hostSettingsFileMode,
	)
	if err != nil {
		return fmt.Errorf("save the host settings: %w", err)
	}
	return nil
}

func LoadHostSettings(stateDirectory string) (HostSettings, error) {
	var stored hostSettingsFile
	found, err := ReadJSONFile(filepath.Join(stateDirectory, hostSettingsFilename), maximumSettingsBytes, &stored)
	if err != nil {
		return HostSettings{}, fmt.Errorf("load the host settings: %w", err)
	}
	if !found || stored.Schema != hostSettingsSchema {
		return HostSettings{}, nil
	}
	var settings HostSettings
	if err := DecodeStrictJSON(stored.Settings, &settings); err != nil {
		return HostSettings{}, fmt.Errorf("load the host settings: %w", err)
	}
	return settings, nil
}
