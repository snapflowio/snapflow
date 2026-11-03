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

package layout

import (
	"path/filepath"
	"strconv"
)

const DiscardedSnapshotPrefix = "discarded-"

type Paths struct {
	dataDir string
}

func NewPaths(dataDir string) Paths {
	return Paths{dataDir: dataDir}
}

func (p Paths) DataDir() string {
	return p.dataDir
}

func (p Paths) SystemDir() string {
	return filepath.Join(p.dataDir, "system")
}

func (p Paths) SystemOCICache() string {
	return filepath.Join(p.SystemDir(), "oci-cache")
}

func (p Paths) SystemBuild(id string) string {
	return filepath.Join(p.SystemDir(), "builds", id)
}

func (p Paths) SystemBuildsDir() string {
	return filepath.Join(p.SystemDir(), "builds")
}

func (p Paths) SystemBuildersDir() string {
	return filepath.Join(p.SystemDir(), "builders")
}

func (p Paths) SystemBuilderState(key string) string {
	return filepath.Join(p.SystemBuildersDir(), key, "state.ext4")
}

func (p Paths) SystemGPULeasesDir() string {
	return filepath.Join(p.SystemDir(), "gpu-leases")
}

func (p Paths) SystemGPULease(id string) string {
	return filepath.Join(p.SystemGPULeasesDir(), id+".json")
}

func (p Paths) SystemGPUQuarantineDir() string {
	return filepath.Join(p.SystemDir(), "gpu-quarantine")
}

func (p Paths) SystemOverlayTemplate(sizeBytes int64) string {
	return filepath.Join(p.SystemDir(), "overlays", "ext4-"+strconv.FormatInt(sizeBytes, 10)+".raw")
}

func (p Paths) SystemTemplatesDir() string {
	return filepath.Join(p.SystemDir(), "templates")
}

func (p Paths) SystemTemplate(key string) string {
	return filepath.Join(p.SystemTemplatesDir(), key)
}

func (p Paths) SystemTemplateManifest(key string) string {
	return filepath.Join(p.SystemTemplate(key), "manifest.json")
}

func (p Paths) SystemVolumeBackup(id string) string {
	return filepath.Join(p.SystemDir(), "volume-backups", id)
}

const ImageCacheFormat = "v3"

const ImageDiskName = "rootfs.erofs"

func (p Paths) ImagesDir() string {
	return filepath.Join(p.dataDir, "images", ImageCacheFormat)
}

func (p Paths) ImageDigestDir(repository, digestHex string) string {
	return filepath.Join(p.ImagesDir(), repository, digestHex)
}

func (p Paths) ImageDisk(repository, digestHex string) string {
	return filepath.Join(p.ImageDigestDir(repository, digestHex), ImageDiskName)
}

func (p Paths) ImageMetadata(repository, digestHex string) string {
	return filepath.Join(p.ImageDigestDir(repository, digestHex), "metadata.json")
}

func (p Paths) ImageTagLink(repository, tag string) string {
	return filepath.Join(p.ImagesDir(), repository, tag)
}

const imageDigestAliasPrefix = "@"

func (p Paths) ImageDigestAliasLink(repository, digestHex string) string {
	return filepath.Join(p.ImagesDir(), repository, imageDigestAliasPrefix+digestHex)
}

func (p Paths) InstancesDir() string {
	return filepath.Join(p.dataDir, "instances")
}

func (p Paths) VolumesDir() string {
	return filepath.Join(p.dataDir, "volumes")
}

func (p Paths) VolumeDir(id string) string {
	return filepath.Join(p.VolumesDir(), id)
}

func (p Paths) VolumeData(id string) string {
	return filepath.Join(p.VolumeDir(id), "data.raw")
}

func (p Paths) VolumeMetadata(id string) string {
	return filepath.Join(p.VolumeDir(id), "metadata.json")
}

func (p Paths) InstanceDir(id string) string {
	return filepath.Join(p.InstancesDir(), id)
}

func (p Paths) InstanceMetadata(id string) string {
	return filepath.Join(p.InstanceDir(id), "metadata.json")
}

func (p Paths) InstancePID(id string) string {
	return filepath.Join(p.InstanceDir(id), "vmm.pid")
}

func (p Paths) InstanceOverlay(id string) string {
	return filepath.Join(p.InstanceDir(id), "overlay.raw")
}

func (p Paths) InstanceConfigDisk(id string) string {
	return filepath.Join(p.InstanceDir(id), "config.ext4")
}

func (p Paths) InstanceLogsDir(id string) string {
	return filepath.Join(p.InstanceDir(id), "logs")
}

func (p Paths) InstanceAppLog(id string) string {
	return filepath.Join(p.InstanceLogsDir(id), "app.log")
}

func (p Paths) InstanceVMMLog(id string) string {
	return filepath.Join(p.InstanceLogsDir(id), "vmm.log")
}

// InstanceVMMDir holds what a jailed VMM creates: its API and vsock
// sockets. The VMM owns this directory and nothing else in the instance.
func (p Paths) InstanceVMMDir(id string) string {
	return filepath.Join(p.InstanceDir(id), "vmm")
}

// InstanceJailRoot is the empty mount point of the VMM's jail root.
func (p Paths) InstanceJailRoot(id string) string {
	return filepath.Join(p.InstanceDir(id), "jail")
}

func (p Paths) InstanceSocket(id, socketName string) string {
	return filepath.Join(p.InstanceVMMDir(id), socketName)
}

func (p Paths) InstanceVsock(id string) string {
	return filepath.Join(p.InstanceVMMDir(id), "v.sock")
}

func (p Paths) InstanceSnapshotsDir(id string) string {
	return filepath.Join(p.InstanceDir(id), "snapshots")
}

func (p Paths) InstanceLatestSnapshot(id string) string {
	return filepath.Join(p.InstanceSnapshotsDir(id), "latest")
}

func (p Paths) InstanceDiscardedSnapshot(id, token string) string {
	return filepath.Join(p.InstanceSnapshotsDir(id), DiscardedSnapshotPrefix+token)
}

func (p Paths) SnapshotsDir() string {
	return filepath.Join(p.dataDir, "snapshots")
}

func (p Paths) SnapshotDir(id string) string {
	return filepath.Join(p.SnapshotsDir(), id)
}

func (p Paths) SnapshotMetadata(id string) string {
	return filepath.Join(p.SnapshotDir(id), "metadata.json")
}

func (p Paths) SnapshotPayloadDir(id string) string {
	return filepath.Join(p.SnapshotDir(id), "payload")
}
