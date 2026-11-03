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

package template

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/forkvm"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

const (
	manifestSchemaVersion = 4
	manifestFileMode      = 0o600
	snapshotStateFile     = "state"
	snapshotMemoryFile    = "memory"
)

type manifest struct {
	SchemaVersion int       `json:"schemaVersion"`
	Key           Key       `json:"key"`
	SeedID        string    `json:"seedId"`
	Artifacts     artifacts `json:"artifacts"`
	CreatedAt     time.Time `json:"createdAt"`
	LastUsedAt    time.Time `json:"lastUsedAt"`
}

type artifacts struct {
	SnapshotState   artifact   `json:"snapshotState"`
	SnapshotMemory  artifact   `json:"snapshotMemory"`
	OverlayDisk     artifact   `json:"overlayDisk"`
	ConfigDisk      artifact   `json:"configDisk"`
	RootFilesystem  artifact   `json:"rootFilesystem"`
	PlatformBundles []artifact `json:"platformBundles,omitempty"`
}

type storedTemplate struct {
	keyID    string
	manifest manifest
}

func (m manifest) logicalBytes() int64 {
	return m.Artifacts.SnapshotState.Size +
		m.Artifacts.SnapshotMemory.Size +
		m.Artifacts.OverlayDisk.Size +
		m.Artifacts.ConfigDisk.Size +
		m.Artifacts.RootFilesystem.Size
}

func (m manifest) lastUsed() time.Time {
	if !m.LastUsedAt.IsZero() {
		return m.LastUsedAt
	}
	return m.CreatedAt
}

func (c *Cache) loadManifest(keyID string) (manifest, error) {
	data, err := os.ReadFile(c.paths.SystemTemplateManifest(keyID))
	if err != nil {
		return manifest{}, err
	}
	loaded := manifest{}
	if err := json.Unmarshal(data, &loaded); err != nil {
		return manifest{}, fmt.Errorf("decode runtime template manifest: %w", err)
	}
	return loaded, nil
}

func (c *Cache) writeManifest(keyID string, stored manifest) error {
	data, err := json.MarshalIndent(stored, "", "  ")
	if err != nil {
		return fmt.Errorf("encode runtime template manifest: %w", err)
	}
	if err := atomicfile.Replace(c.paths.SystemTemplateManifest(keyID), data, manifestFileMode); err != nil {
		return fmt.Errorf("persist runtime template manifest: %w", err)
	}
	if err := atomicfile.Commit(c.paths.SystemTemplateManifest(keyID)); err != nil {
		return fmt.Errorf("persist runtime template manifest: %w", err)
	}
	return nil
}

func (c *Cache) invalidateLocked(keyID string) {
	if err := os.RemoveAll(c.paths.SystemTemplate(keyID)); err != nil {
		slog.Warn("could not invalidate runtime template", "template_key", keyID, "error", err)
	}
}

func (c *Cache) listStoredLocked() ([]storedTemplate, []string, error) {
	entries, err := os.ReadDir(c.paths.SystemTemplatesDir())
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, fmt.Errorf("list runtime templates: %w", err)
	}
	templates := make([]storedTemplate, 0, len(entries))
	var unreadable []string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		loaded, err := c.loadManifest(entry.Name())
		if err != nil {
			unreadable = append(unreadable, entry.Name())
			continue
		}
		templates = append(templates, storedTemplate{keyID: entry.Name(), manifest: loaded})
	}
	return templates, unreadable, nil
}

func (c *Cache) seedSnapshotPath(seedID, name string) string {
	return filepath.Join(c.paths.InstanceLatestSnapshot(seedID), name)
}

func (c *Cache) captureArtifacts(seedID string) (artifacts, error) {
	metadata, err := state.ReadInstanceMetadata(c.paths, seedID)
	if err != nil {
		return artifacts{}, fmt.Errorf("read template seed metadata: %w", err)
	}
	captured := artifacts{}
	for _, target := range []struct {
		label       string
		path        string
		destination *artifact
	}{
		{label: "snapshot state", path: c.seedSnapshotPath(seedID, snapshotStateFile), destination: &captured.SnapshotState},
		{label: "snapshot memory", path: c.seedSnapshotPath(seedID, snapshotMemoryFile), destination: &captured.SnapshotMemory},
		{label: "overlay disk", path: metadata.OverlayDisk, destination: &captured.OverlayDisk},
		{label: "config disk", path: metadata.ConfigDisk, destination: &captured.ConfigDisk},
		{label: "root filesystem", path: metadata.RootfsDisk, destination: &captured.RootFilesystem},
	} {
		if *target.destination, err = c.captureArtifact(target.label, target.path); err != nil {
			return artifacts{}, err
		}
	}
	for index, platformBundle := range metadata.PlatformBundles {
		bundle, err := c.captureArtifact(fmt.Sprintf("platform bundle %d", index), platformBundle.DiskPath)
		if err != nil {
			return artifacts{}, err
		}
		captured.PlatformBundles = append(captured.PlatformBundles, bundle)
	}
	return captured, nil
}

func (c *Cache) shareSnapshot(seedID string) error {
	for _, name := range []string{snapshotStateFile, snapshotMemoryFile} {
		if err := forkvm.ShareSnapshotFile(c.seedSnapshotPath(seedID, name)); err != nil {
			return fmt.Errorf("share runtime template snapshot %s: %w", name, err)
		}
	}
	return nil
}

func (c *Cache) seedValidations(stored manifest, key Key) ([]artifactValidation, error) {
	if stored.SchemaVersion != manifestSchemaVersion {
		return nil, errors.New("template manifest is incompatible")
	}
	keyID, err := KeyID(key)
	if err != nil {
		return nil, err
	}
	manifestKeyID, err := KeyID(stored.Key)
	if err != nil {
		return nil, fmt.Errorf("identify stored template key: %w", err)
	}
	if manifestKeyID != keyID {
		return nil, errors.New("template manifest is incompatible")
	}
	if stored.SeedID != SeedID(keyID) {
		return nil, errors.New("template manifest seed identity is invalid")
	}
	if c.fingerprintErr != nil {
		return nil, c.fingerprintErr
	}
	if key.CPUSignature != c.fingerprint.CPUSignature || key.HostKernelRelease != c.fingerprint.KernelRelease {
		return nil, errors.New("template host compatibility fingerprint changed")
	}
	metadata, err := state.ReadInstanceMetadata(c.paths, stored.SeedID)
	if err != nil {
		return nil, err
	}
	if err := c.validateSeedState(metadata, key, stored.Artifacts.PlatformBundles); err != nil {
		return nil, err
	}
	validations := []artifactValidation{
		{label: "snapshot state", path: c.seedSnapshotPath(stored.SeedID, snapshotStateFile), expected: stored.Artifacts.SnapshotState},
		{label: "snapshot memory", path: c.seedSnapshotPath(stored.SeedID, snapshotMemoryFile), expected: stored.Artifacts.SnapshotMemory},
		{label: "overlay disk", path: metadata.OverlayDisk, expected: stored.Artifacts.OverlayDisk},
		{label: "config disk", path: metadata.ConfigDisk, expected: stored.Artifacts.ConfigDisk},
		{label: "root filesystem", path: metadata.RootfsDisk, expected: stored.Artifacts.RootFilesystem},
	}
	for index, platformBundle := range stored.Artifacts.PlatformBundles {
		validations = append(validations, artifactValidation{
			label:    fmt.Sprintf("platform bundle %d", index),
			path:     metadata.PlatformBundles[index].DiskPath,
			expected: platformBundle,
		})
	}
	return validations, nil
}

func (c *Cache) validateSeedState(metadata state.InstanceMetadata, key Key, platformBundles []artifact) error {
	if metadata.State != types.RuntimeStateStandby || !metadata.TemplateSeed {
		return errors.New("template seed is not in standby")
	}
	if err := validatePlatformBundles(metadata, key, platformBundles); err != nil {
		return err
	}
	info, err := os.Lstat(c.paths.InstanceLatestSnapshot(metadata.ID))
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return errors.New("template seed snapshot is not a directory")
	}
	for _, name := range []string{snapshotStateFile, snapshotMemoryFile} {
		shared, err := forkvm.IsSharedSnapshotFile(c.seedSnapshotPath(metadata.ID, name))
		if err != nil {
			return fmt.Errorf("inspect template seed snapshot %s: %w", name, err)
		}
		if !shared {
			return fmt.Errorf("template seed snapshot %s is not shared read-only", name)
		}
	}
	return nil
}

func (c *Cache) validateSeed(stored manifest, key Key, verification artifactVerification) error {
	validations, err := c.seedValidations(stored, key)
	if err != nil {
		return err
	}
	return c.verifyArtifacts(validations, verification)
}

func (c *Cache) refreshStoredLocked(keyID string, stored manifest, key Key) (manifest, error) {
	validations, err := c.seedValidations(stored, key)
	if err != nil {
		return manifest{}, err
	}
	if err := c.verifyArtifacts(validations, verifyArtifactIdentity); err != nil {
		return manifest{}, err
	}
	refreshed := verifiedArtifacts(validations)
	if sameArtifacts(refreshed, stored.Artifacts) {
		return stored, nil
	}
	stored.Artifacts = refreshed
	if err := c.writeManifest(keyID, stored); err != nil {
		return manifest{}, err
	}
	return stored, nil
}

func validatePlatformBundles(metadata state.InstanceMetadata, key Key, platformBundles []artifact) error {
	if len(metadata.PlatformBundles) != len(key.PlatformBundleDigests) || len(platformBundles) != len(key.PlatformBundleDigests) {
		return errors.New("template platform bundle metadata is incomplete")
	}
	for index, expectedDigest := range key.PlatformBundleDigests {
		if metadata.PlatformBundles[index].Digest != expectedDigest {
			return fmt.Errorf("template platform bundle %d digest changed", index)
		}
	}
	return nil
}
