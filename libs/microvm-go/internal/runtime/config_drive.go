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

package runtime

import (
	"fmt"

	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/configdrive"
	"github.com/snapflowio/microvm-go/internal/state"
)

func (b *Backend) writeInstanceConfigDrive(metadata state.InstanceMetadata, record imagecache.ImageRecord) error {
	if err := validateInstanceIdentity(metadata); err != nil {
		return fmt.Errorf("validate instance identity before writing config drive: %w", err)
	}
	configRequest := configdrive.BuildRequest{
		OSUser:             metadata.OSUser,
		ImageEntrypoint:    record.Entrypoint,
		ImageCmd:           record.Cmd,
		ImageWorkingDir:    record.WorkingDir,
		ImageEnv:           record.Env,
		RuntimeEnv:         metadata.RawRequest.Env,
		Entrypoint:         metadata.RawRequest.Entrypoint,
		ManagedWorkload:    metadata.RawRequest.ManagedWorkload,
		InstanceID:         metadata.ID,
		GenerationID:       metadata.GenerationID,
		Hostname:           instanceHostname(metadata.ID),
		MachineID:          instanceMachineID(metadata.ID),
		GuestServiceTokens: metadata.GuestServiceTokens,
		ControlAuthToken:   metadata.ControlAuthToken,
		RequireSecretEnv:   metadata.RequiresSecretEnv,
		DeferredWorkload:   metadata.TemplateSeed,
	}
	if metadata.LinkedPeer != nil {
		configRequest.Hosts = []configdrive.HostEntry{{
			Address: metadata.LinkedPeer.TransitAddress,
			Aliases: append([]string(nil), metadata.LinkedPeer.Aliases...),
		}}
	}
	for _, bundle := range metadata.PlatformBundles {
		configRequest.PlatformBundles = append(configRequest.PlatformBundles, configdrive.PlatformBundle{
			Name: bundle.Name, Version: bundle.Version, ReleaseDigest: bundle.ReleaseDigest,
			Required: bundle.Required, Reference: bundle.Reference,
			Digest: bundle.Digest, Platform: bundle.Platform, Device: bundle.Device,
			Filesystem: bundle.Filesystem, MountPath: bundle.MountPath,
			Capabilities: append([]guest.SandboxCapability(nil), bundle.Capabilities...),
			Components:   append([]guest.Manifest(nil), bundle.Components...),
		})
	}
	volumeMounts, err := volumeMountConfiguration(metadata)
	if err != nil {
		return fmt.Errorf("configure persistent volume mounts: %w", err)
	}
	configRequest.VolumeMounts = volumeMounts
	if allocation := metadata.Network; allocation != nil {
		configRequest.Network = &configdrive.Network{
			Mode:    configdrive.NetworkModeStatic,
			IP:      allocation.IP,
			Netmask: allocation.Netmask,
			Gateway: allocation.Gateway,
			DNS:     allocation.DNS,
		}
	}
	cfg := configdrive.Build(configRequest)
	return configdrive.Write(metadata.ConfigDisk, cfg)
}
