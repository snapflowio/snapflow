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
	"slices"

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

type templateBootDigests struct {
	firecracker string
	kernel      string
	initrd      string
}

type templateEnvironment struct {
	boot          templateBootDigests
	networkDigest string
	fingerprint   template.HostFingerprint
}

func (environment templateEnvironment) apply(key *template.Key, guestConfigDigest string) {
	key.SchemaVersion = template.KeySchemaVersion
	key.SnapshotFormat = template.SnapshotFormat
	key.ImageCacheFormat = layout.ImageCacheFormat
	key.FirecrackerDigest = environment.boot.firecracker
	key.KernelDigest = environment.boot.kernel
	key.InitrdDigest = environment.boot.initrd
	key.GuestConfigDigest = guestConfigDigest
	key.NetworkDigest = environment.networkDigest
	key.CPUSignature = environment.fingerprint.CPUSignature
	key.CPUTemplate = template.FirecrackerCPUTemplate
	key.HostKernelRelease = environment.fingerprint.KernelRelease
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
	environment, err := b.templateEnvironment(ctx)
	if err != nil {
		return template.Key{}, imagecache.ImageRecord{}, err
	}
	bundles, guestConfigDigest, err := b.templateGuestConfiguration(request.Capabilities)
	if err != nil {
		return template.Key{}, imagecache.ImageRecord{}, err
	}
	platformBundleDigests, err := b.resolveTemplatePlatformBundles(ctx, request.ID, platform.String(), bundles)
	if err != nil {
		return template.Key{}, imagecache.ImageRecord{}, err
	}
	key := template.Key{
		ImageDigest:           record.Digest,
		PlatformBundleDigests: platformBundleDigests,
		Platform:              record.Platform,
		CPUVCPUs:              request.CPUQuota,
		MemoryGiB:             request.MemoryQuota,
		StorageGiB:            request.StorageQuota,
	}
	environment.apply(&key, guestConfigDigest)
	return key, record, nil
}

func (b *Backend) currentTemplateKey(ctx context.Context, stored template.Key, request types.CreateRequest) (template.Key, error) {
	environment, err := b.templateEnvironment(ctx)
	if err != nil {
		return template.Key{}, err
	}
	_, guestConfigDigest, err := b.templateGuestConfiguration(request.Capabilities)
	if err != nil {
		return template.Key{}, err
	}
	current := stored
	current.PlatformBundleDigests = slices.Clone(stored.PlatformBundleDigests)
	environment.apply(&current, guestConfigDigest)
	return current, nil
}

func (b *Backend) templateEnvironment(ctx context.Context) (templateEnvironment, error) {
	bootDigests, err := b.templateBootDigests(ctx)
	if err != nil {
		return templateEnvironment{}, err
	}
	networkDigest, err := digestJSON(b.networkConfig)
	if err != nil {
		return templateEnvironment{}, fmt.Errorf("encode template network configuration: %w", err)
	}
	fingerprint, err := b.templates.HostFingerprint()
	if err != nil {
		return templateEnvironment{}, err
	}
	return templateEnvironment{boot: bootDigests, networkDigest: networkDigest, fingerprint: fingerprint}, nil
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

func (b *Backend) templateGuestConfiguration(capabilities []guest.SandboxCapability) ([]guest.Bundle, string, error) {
	bundles, err := b.bundlesForCapabilities(capabilities)
	if err != nil {
		return nil, "", err
	}
	policy := b.bootPolicy()
	digest, err := digestJSON(templateGuestConfiguration{
		PlatformBundles: bundles,
		Memory:          policy.memory,
		SerialConsole:   policy.serialConsole,
	})
	if err != nil {
		return nil, "", fmt.Errorf("encode template guest configuration: %w", err)
	}
	return bundles, digest, nil
}

func (b *Backend) resolveTemplatePlatformBundles(
	ctx context.Context,
	instanceID string,
	platform string,
	bundles []guest.Bundle,
) ([]string, error) {
	digests := make([]string, 0, len(bundles))
	for _, bundle := range bundles {
		record, err := b.resolvePlatformBundle(ctx, instanceID, bundle, platform)
		if err != nil {
			return nil, fmt.Errorf("resolve template platform bundle %q: %w", bundle.Name, err)
		}
		digests = append(digests, record.Digest)
	}
	return digests, nil
}

func digestJSON(value any) (string, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:]), nil
}
