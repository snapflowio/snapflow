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
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"runtime"

	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/guestmemory"
	"github.com/snapflowio/microvm-go/host"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/imagecache"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/template"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

type templateGuestConfiguration struct {
	PlatformBundles []guest.Bundle     `json:"platformBundles,omitempty"`
	Memory          guestmemory.Policy `json:"memory"`
	SerialConsole   bool               `json:"serialConsole"`
}

type templateGuestArtifacts struct {
	platformBundleDigests []string
	guestConfigDigest     string
}

type templateBootDigests struct {
	firecracker string
	kernel      string
	initrd      string
}

func (b *Backend) templateEligible(request types.CreateRequest, selectedHypervisor hypervisor.Hypervisor) bool {
	profile := hypervisor.InstanceProfileForLabels(request.Labels)
	return runtime.GOOS == "linux" &&
		selectedHypervisor == hypervisor.HypervisorFirecracker &&
		request.InitialState != types.InitialStateStopped &&
		b.templates.Eligible() &&
		request.GPUQuota == 0 &&
		!request.DirectIO &&
		request.LinkedPeerID == "" &&
		len(request.Volumes) == 0 &&
		(profile == hypervisor.InstanceProfileEphemeral || profile == hypervisor.InstanceProfileService)
}

func (b *Backend) resolveTemplateKey(ctx context.Context, request types.CreateRequest) (template.Key, imagecache.ImageRecord, error) {
	if err := host.FirecrackerSnapshotCompatibility(b.paths.DataDir()); err != nil {
		return template.Key{}, imagecache.ImageRecord{}, err
	}
	record, err := runLifecycleOperation(b, request.ID, "", lifecycle.OperationImageResolution, func() (imagecache.ImageRecord, error) {
		return b.images.Ensure(ctx, request.Image, request.Registry, request.Platform, request.ImagePullPolicy)
	})
	if err != nil {
		return template.Key{}, imagecache.ImageRecord{}, fmt.Errorf("resolve template image: %w", err)
	}
	platform, err := imagecache.ParsePlatform(record.Platform)
	if err != nil {
		return template.Key{}, imagecache.ImageRecord{}, fmt.Errorf("parse template platform: %w", err)
	}
	bootDigests, err := b.templateBootDigests(ctx)
	if err != nil {
		return template.Key{}, imagecache.ImageRecord{}, err
	}
	guestArtifacts, err := b.resolveTemplateGuestArtifacts(ctx, platform.String(), request)
	if err != nil {
		return template.Key{}, imagecache.ImageRecord{}, err
	}
	networkDigest, err := digestJSON(b.networkConfig)
	if err != nil {
		return template.Key{}, imagecache.ImageRecord{}, fmt.Errorf("encode template network configuration: %w", err)
	}
	fingerprint, err := b.templates.HostFingerprint()
	if err != nil {
		return template.Key{}, imagecache.ImageRecord{}, err
	}
	return template.Key{
		SchemaVersion:         template.KeySchemaVersion,
		SnapshotFormat:        template.SnapshotFormat,
		ImageDigest:           record.Digest,
		ImageCacheFormat:      layout.ImageCacheFormat,
		FirecrackerDigest:     bootDigests.firecracker,
		KernelDigest:          bootDigests.kernel,
		InitrdDigest:          bootDigests.initrd,
		PlatformBundleDigests: guestArtifacts.platformBundleDigests,
		GuestConfigDigest:     guestArtifacts.guestConfigDigest,
		NetworkDigest:         networkDigest,
		CPUSignature:          fingerprint.CPUSignature,
		CPUTemplate:           template.FirecrackerCPUTemplate,
		HostKernelRelease:     fingerprint.KernelRelease,
		Platform:              record.Platform,
		CPUVCPUs:              request.CPUQuota,
		MemoryGiB:             request.MemoryQuota,
		StorageGiB:            request.StorageQuota,
	}, record, nil
}

func (b *Backend) templateBootDigests(ctx context.Context) (templateBootDigests, error) {
	assets, err := b.resolveBootAssets(ctx, hypervisor.HypervisorFirecracker)
	if err != nil {
		return templateBootDigests{}, fmt.Errorf("resolve template boot assets: %w", err)
	}
	firecrackerDigest, err := b.templates.Digest(assets.hypervisorBinary)
	if err != nil {
		return templateBootDigests{}, fmt.Errorf("digest Firecracker binary: %w", err)
	}
	kernelDigest, err := b.templates.Digest(assets.kernelPath)
	if err != nil {
		return templateBootDigests{}, fmt.Errorf("digest guest kernel: %w", err)
	}
	initrdDigest, err := b.templates.Digest(assets.initrdPath)
	if err != nil {
		return templateBootDigests{}, fmt.Errorf("digest guest init initrd: %w", err)
	}
	return templateBootDigests{firecracker: firecrackerDigest, kernel: kernelDigest, initrd: initrdDigest}, nil
}

func (b *Backend) resolveTemplateGuestArtifacts(
	ctx context.Context,
	platform string,
	request types.CreateRequest,
) (templateGuestArtifacts, error) {
	policy := b.bootPolicy()
	configuration := templateGuestConfiguration{
		Memory:        policy.memory,
		SerialConsole: policy.serialConsole,
	}
	bundles, err := b.bundlesForCapabilities(request.Capabilities)
	if err != nil {
		return templateGuestArtifacts{}, err
	}
	resolved := templateGuestArtifacts{platformBundleDigests: make([]string, 0, len(bundles))}
	for _, bundle := range bundles {
		record, resolveErr := b.resolvePlatformBundle(ctx, request.ID, bundle, platform)
		if resolveErr != nil {
			return templateGuestArtifacts{}, fmt.Errorf("resolve template platform bundle %q: %w", bundle.Name, resolveErr)
		}
		resolved.platformBundleDigests = append(resolved.platformBundleDigests, record.Digest)
		configuration.PlatformBundles = append(configuration.PlatformBundles, bundle)
	}
	if resolved.guestConfigDigest, err = digestJSON(configuration); err != nil {
		return templateGuestArtifacts{}, fmt.Errorf("encode template guest configuration: %w", err)
	}
	return resolved, nil
}

func digestJSON(value any) (string, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:]), nil
}
