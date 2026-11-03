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

package microvm

import (
	"context"
	"net"

	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/hypervisor"
	microvmruntime "github.com/snapflowio/microvm-go/internal/runtime"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/microvm-go/volumes"
)

type Runtime struct {
	backend *microvmruntime.Backend
}

func (r *Runtime) Recover(ctx context.Context) error {
	return r.backend.Recover(ctx)
}

func (r *Runtime) Run(ctx context.Context) error {
	return r.backend.Run(ctx)
}

func (r *Runtime) PrepareHypervisors(ctx context.Context, values ...Hypervisor) (map[hypervisor.Hypervisor]string, error) {
	return r.backend.PrepareHypervisors(ctx, values...)
}

func (r *Runtime) PrepareBootAssets(ctx context.Context, platform string) (PreparedBootAssets, error) {
	return r.backend.PrepareBootAssets(ctx, platform)
}

func (r *Runtime) PreparePlatformBundles(
	ctx context.Context,
	platform string,
	capabilities []guest.SandboxCapability,
) ([]types.PreparedPlatformBundle, error) {
	return r.backend.PreparePlatformBundles(ctx, platform, capabilities)
}

func (r *Runtime) Create(ctx context.Context, request types.CreateRequest) (string, error) {
	return r.backend.Create(ctx, request)
}

func (r *Runtime) AdmitAssignment(ctx context.Context, instanceID string, generation int) error {
	return r.backend.AdmitAssignment(ctx, instanceID, generation)
}

func (r *Runtime) Destroy(ctx context.Context, instanceID string) error {
	return r.backend.Destroy(ctx, instanceID)
}

func (r *Runtime) Start(ctx context.Context, instanceID string, options types.StartOptions) error {
	return r.backend.Start(ctx, instanceID, options)
}

func (r *Runtime) StopWithOptions(ctx context.Context, instanceID string, options types.StopOptions) error {
	return r.backend.StopWithOptions(ctx, instanceID, options)
}

func (r *Runtime) Resume(ctx context.Context, instanceID string) error {
	return r.backend.Resume(ctx, instanceID)
}

func (r *Runtime) Standby(ctx context.Context, instanceID string) error {
	return r.backend.Standby(ctx, instanceID)
}

func (r *Runtime) Fork(ctx context.Context, instanceID string, request types.ForkRequest) (string, error) {
	return r.backend.Fork(ctx, instanceID, request)
}

func (r *Runtime) Resize(ctx context.Context, instanceID string, request types.ResizeRequest) error {
	return r.backend.Resize(ctx, instanceID, request)
}

func (r *Runtime) RuntimeInfo(ctx context.Context, instanceID string) (types.RuntimeInfo, error) {
	return r.backend.RuntimeInfo(ctx, instanceID)
}

func (r *Runtime) RuntimeInventory(ctx context.Context) ([]types.RuntimeObservation, error) {
	return r.backend.RuntimeInventory(ctx)
}

func (r *Runtime) RuntimeUsageSample(ctx context.Context, instanceID string) (types.RuntimeUsageSample, error) {
	return r.backend.RuntimeUsageSample(ctx, instanceID)
}

func (r *Runtime) UpdateNetworkSettings(ctx context.Context, instanceID string, settings types.NetworkSettings) error {
	return r.backend.UpdateNetworkSettings(ctx, instanceID, settings)
}

func (r *Runtime) GuestServiceTarget(ctx context.Context, instanceID, serviceName string) (*types.ProxyTarget, error) {
	return r.backend.GuestServiceTarget(ctx, instanceID, serviceName)
}

func (r *Runtime) DialRuntimePort(ctx context.Context, instanceID string, target types.RuntimePortTarget) (net.Conn, error) {
	return r.backend.DialRuntimePort(ctx, instanceID, target)
}

func (r *Runtime) PrepareTemplate(ctx context.Context, request types.CreateRequest) (string, error) {
	return r.backend.PrepareTemplate(ctx, request)
}

func (r *Runtime) RemoveTemplate(ctx context.Context, keyID string) error {
	return r.backend.RemoveTemplate(ctx, keyID)
}

func (r *Runtime) PreparedTemplateKeys(ctx context.Context) ([]string, error) {
	return r.backend.PreparedTemplateKeys(ctx)
}

func (r *Runtime) PreparedImageDigests(ctx context.Context) ([]string, error) {
	return r.backend.PreparedImageDigests(ctx)
}

func (r *Runtime) ExportInstanceImage(ctx context.Context, instanceID string, request types.ExportImageRequest) (types.ImageInfo, error) {
	return r.backend.ExportInstanceImage(ctx, instanceID, request)
}

func (r *Runtime) PullImage(ctx context.Context, imageName string, registry *types.Registry, platform string) error {
	return r.backend.PullImage(ctx, imageName, registry, platform)
}

func (r *Runtime) BuildImage(ctx context.Context, request types.BuildRequest) error {
	return r.backend.BuildImage(ctx, request)
}

func (r *Runtime) TagImage(ctx context.Context, imageName, tag string) error {
	return r.backend.TagImage(ctx, imageName, tag)
}

func (r *Runtime) PushImage(ctx context.Context, tag string, registry *types.Registry) error {
	return r.backend.PushImage(ctx, tag, registry)
}

func (r *Runtime) RemoveImage(ctx context.Context, imageName string) error {
	return r.backend.RemoveImage(ctx, imageName)
}

func (r *Runtime) ImageInfo(ctx context.Context, imageName string) (types.ImageInfo, error) {
	return r.backend.ImageInfo(ctx, imageName)
}

func (r *Runtime) InspectImage(ctx context.Context, imageName string, registry *types.Registry, platform string) (types.ImageInfo, error) {
	return r.backend.InspectImage(ctx, imageName, registry, platform)
}

func (r *Runtime) ImageCount(ctx context.Context) (int, error) {
	return r.backend.ImageCount(ctx)
}

func (r *Runtime) EnsureVolume(ctx context.Context, request volumes.EnsureRequest) (types.Volume, error) {
	return r.backend.EnsureVolume(ctx, request)
}

func (r *Runtime) DeleteVolume(ctx context.Context, volumeID string) error {
	return r.backend.DeleteVolume(ctx, volumeID)
}

func (r *Runtime) ResizeVolume(ctx context.Context, volumeID string, targetSizeGiB int64) (types.Volume, error) {
	return r.backend.ResizeVolume(ctx, volumeID, targetSizeGiB)
}

func (r *Runtime) CreateInstanceVolumeBackup(
	ctx context.Context,
	instanceID string,
	request types.CreateInstanceVolumeBackup,
) ([]types.InstanceVolumeBackupResult, error) {
	return r.backend.CreateInstanceVolumeBackup(ctx, instanceID, request)
}

func (r *Runtime) RestoreVolumeBackup(ctx context.Context, volumeID string, request types.RestoreVolumeBackup) error {
	return r.backend.RestoreVolumeBackup(ctx, volumeID, request)
}

func (r *Runtime) AllocatedResources(ctx context.Context) (types.AllocatedResources, error) {
	return r.backend.AllocatedResources(ctx)
}

func (r *Runtime) Capacity(ctx context.Context) (types.AllocatedResources, error) {
	return r.backend.Capacity(ctx)
}
