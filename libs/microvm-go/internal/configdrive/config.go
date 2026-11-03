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
	"maps"

	"github.com/snapflowio/microvm-go/guest"
	guestconfig "github.com/snapflowio/microvm-go/guest/config"
)

const (
	NetworkModeStatic = NetworkMode("static")
	NetworkModeDHCP   = NetworkMode("dhcp")
)

type NetworkMode string

type VolumeMount struct {
	Device        string `json:"device"`
	Path          string `json:"path"`
	Subpath       string `json:"subpath,omitempty"`
	Mode          string `json:"mode"`
	OverlayDevice string `json:"overlayDevice,omitempty"`
}

type PlatformBundle struct {
	Name          string                    `json:"name"`
	Version       string                    `json:"version"`
	ReleaseDigest string                    `json:"releaseDigest"`
	Required      bool                      `json:"required"`
	Reference     string                    `json:"reference"`
	Digest        string                    `json:"digest"`
	Platform      string                    `json:"platform"`
	Device        string                    `json:"device"`
	Filesystem    guest.FilesystemFormat    `json:"filesystem"`
	MountPath     string                    `json:"mountPath"`
	Capabilities  []guest.SandboxCapability `json:"capabilities"`
	Components    []guest.Manifest          `json:"components"`
}

type Config struct {
	OSUser           string             `json:"osUser"`
	Entrypoint       []string           `json:"entrypoint,omitempty"`
	Cmd              []string           `json:"cmd,omitempty"`
	Workdir          string             `json:"workdir"`
	Env              map[string]string  `json:"env,omitempty"`
	InitMode         string             `json:"initMode"`
	Hostname         string             `json:"hostname"`
	MachineID        string             `json:"machineId"`
	NetworkMode      NetworkMode        `json:"networkMode,omitempty"`
	GuestIP          string             `json:"guestIp,omitempty"`
	GuestCIDR        int                `json:"guestCidr,omitempty"`
	GuestGW          string             `json:"guestGateway,omitempty"`
	GuestDNS         string             `json:"guestDns,omitempty"`
	Hosts            []HostEntry        `json:"hosts,omitempty"`
	GuestInit        guestconfig.Config `json:"guestInit"`
	SkipKernelHeader bool               `json:"skipKernelHeader,omitempty"`
	RequireCgroups   bool               `json:"requireCgroups,omitempty"`
	RequireSecretEnv bool               `json:"requireSecretEnv,omitempty"`
	DeferredWorkload bool               `json:"deferredWorkload,omitempty"`
	VolumeMounts     []VolumeMount      `json:"volumeMounts,omitempty"`
	PlatformBundles  []PlatformBundle   `json:"platformBundles,omitempty"`
	InjectedFilePath string             `json:"injectedFilePath,omitempty"`

	InjectedFile []byte `json:"-"`
}

type HostEntry struct {
	Address string   `json:"address"`
	Aliases []string `json:"aliases"`
}

type Network struct {
	Mode    NetworkMode
	IP      string
	Netmask string
	Gateway string
	DNS     string
}

type BuildRequest struct {
	OSUser             string
	ImageEntrypoint    []string
	ImageCmd           []string
	ImageWorkingDir    string
	ImageEnv           map[string]string
	RuntimeEnv         map[string]string
	Entrypoint         []string
	ManagedWorkload    bool
	Network            *Network
	Hosts              []HostEntry
	InstanceID         string
	GenerationID       string
	Hostname           string
	MachineID          string
	GuestServiceTokens map[string]string
	ControlAuthToken   string
	VolumeMounts       []VolumeMount
	RequireSecretEnv   bool
	DeferredWorkload   bool
	PlatformBundles    []PlatformBundle
}

func Build(req BuildRequest) Config {
	entrypoint := append([]string(nil), req.ImageEntrypoint...)
	command := append([]string(nil), req.ImageCmd...)
	if req.ManagedWorkload {
		entrypoint = append([]string(nil), req.Entrypoint...)
		command = nil
	} else if len(req.Entrypoint) > 0 {
		entrypoint = append([]string(nil), req.Entrypoint...)
	}
	workdir := req.ImageWorkingDir
	if workdir == "" {
		workdir = "/"
	}
	guestConfig := guestconfig.Defaults()
	guestConfig.ProjectDir = workdir
	guestConfig.OSUser = req.OSUser
	guestConfig.InstanceID = req.InstanceID
	guestConfig.GenerationID = req.GenerationID
	guestConfig.GuestServiceTokens = maps.Clone(req.GuestServiceTokens)
	guestConfig.ControlAuthToken = req.ControlAuthToken
	guestConfig.DeferredWorkload = req.DeferredWorkload
	for _, component := range platformComponents(req.PlatformBundles) {
		operations := guest.LifecycleOperationsFor(component)
		if component.Activation.StartsAutomatically() && len(operations) > 0 {
			guestConfig.ComponentHooks = append(guestConfig.ComponentHooks, guest.LifecycleHook{Name: component.Name, SocketPath: component.LifecycleSocket, Operations: operations})
		}
	}

	cfg := Config{
		OSUser:           req.OSUser,
		Entrypoint:       entrypoint,
		Cmd:              command,
		Workdir:          workdir,
		Env:              mergeEnv(req.ImageEnv, req.RuntimeEnv),
		InitMode:         "exec",
		Hostname:         req.Hostname,
		MachineID:        req.MachineID,
		GuestInit:        guestConfig,
		VolumeMounts:     append([]VolumeMount(nil), req.VolumeMounts...),
		PlatformBundles:  clonePlatformBundles(req.PlatformBundles),
		RequireSecretEnv: req.RequireSecretEnv,
		DeferredWorkload: req.DeferredWorkload,
		Hosts:            cloneHostEntries(req.Hosts),
	}
	if req.Network != nil {
		cfg.NetworkMode = req.Network.Mode
		if cfg.NetworkMode == "" {
			cfg.NetworkMode = NetworkModeStatic
		}
		cfg.GuestIP = req.Network.IP
		cfg.GuestCIDR = CIDRFromNetmask(req.Network.Netmask)
		cfg.GuestGW = req.Network.Gateway
		cfg.GuestDNS = req.Network.DNS
	}
	return cfg
}

func cloneHostEntries(source []HostEntry) []HostEntry {
	result := make([]HostEntry, len(source))
	for index, entry := range source {
		result[index] = HostEntry{Address: entry.Address, Aliases: append([]string(nil), entry.Aliases...)}
	}
	return result
}

func platformComponents(bundles []PlatformBundle) []guest.Manifest {
	var components []guest.Manifest
	for _, bundle := range bundles {
		components = append(components, bundle.Components...)
	}
	return components
}

func clonePlatformBundles(source []PlatformBundle) []PlatformBundle {
	result := make([]PlatformBundle, len(source))
	for bundleIndex, bundle := range source {
		result[bundleIndex] = bundle
		result[bundleIndex].Capabilities = append([]guest.SandboxCapability(nil), bundle.Capabilities...)
		result[bundleIndex].Components = make([]guest.Manifest, len(bundle.Components))
		for componentIndex, component := range bundle.Components {
			result[bundleIndex].Components[componentIndex] = component
			result[bundleIndex].Components[componentIndex].Args = append([]string(nil), component.Args...)
			result[bundleIndex].Components[componentIndex].Services = append([]guest.Service(nil), component.Services...)
			result[bundleIndex].Components[componentIndex].RequiredCapabilities = append([]guest.Capability(nil), component.RequiredCapabilities...)
			result[bundleIndex].Components[componentIndex].Capabilities = append([]guest.Capability(nil), component.Capabilities...)
			if component.Env != nil {
				result[bundleIndex].Components[componentIndex].Env = make(map[string]string, len(component.Env))
				for key, value := range component.Env {
					result[bundleIndex].Components[componentIndex].Env[key] = value
				}
			}
		}
	}
	return result
}

func mergeEnv(base, overrides map[string]string) map[string]string {
	if len(base) == 0 && len(overrides) == 0 {
		return nil
	}
	out := make(map[string]string, len(base)+len(overrides))
	for key, value := range base {
		out[key] = value
	}
	for key, value := range overrides {
		out[key] = value
	}
	return out
}
