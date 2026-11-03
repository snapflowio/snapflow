// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/theupdateframework/go-tuf/v2/metadata"
)

type PublishConfig struct {
	RepositoryRoot string
	Channel        Channel
	Bundles        []string
	AssetsRoot     string
	RoleKeys       []string
	SnapshotKey    string
	TimestampKey   string
	Now            time.Time
}

type PromoteConfig struct {
	RepositoryRoot string
	From           Channel
	To             Channel
	Version        string
	RoleKeys       []string
	SnapshotKey    string
	TimestampKey   string
	Now            time.Time
}

type inspectedBundle struct {
	path     string
	manifest release.Manifest
	sha256   string
	length   int64
}

func Publish(cfg PublishConfig) error {
	if cfg.Now.IsZero() || len(cfg.Bundles) == 0 {
		return errors.New("release TUF publication needs at least one bundle and a time")
	}
	update, err := openChannelUpdate(channelUpdateConfig{
		repositoryRoot: cfg.RepositoryRoot, channel: cfg.Channel, roleKeys: cfg.RoleKeys,
		snapshotKey: cfg.SnapshotKey, timestampKey: cfg.TimestampKey, now: cfg.Now,
	})
	if err != nil {
		return err
	}
	bundles, err := inspectBundles(cfg.Bundles)
	if err != nil {
		return err
	}
	changed := false
	for _, bundle := range bundles {
		published, err := update.publishBundle(bundle, cfg.AssetsRoot)
		if err != nil {
			return err
		}
		changed = changed || published
	}
	if !changed {
		return nil
	}
	return update.sign()
}

// publishBundle points the channel at bundle and, when the channel moved,
// copies the bundle into assetsRoot (if set).
func (update *channelUpdate) publishBundle(bundle inspectedBundle, assetsRoot string) (bool, error) {
	selected := ChannelRelease{
		Schema: channelSchema, Channel: update.channel, OS: releaseOS,
		Architecture: bundle.manifest.Architecture, Version: bundle.manifest.Version,
		SHA256: bundle.sha256, Length: bundle.length,
	}
	published, err := update.apply(selected)
	if err != nil || !published || assetsRoot == "" {
		return published, err
	}
	if err := copyAsset(bundle.path, filepath.Join(assetsRoot, filepath.FromSlash(selected.AssetPath()))); err != nil {
		return false, err
	}
	return true, nil
}

func Promote(cfg PromoteConfig) error {
	if cfg.Now.IsZero() || cfg.From == cfg.To {
		return errors.New("release TUF promotion needs distinct channels and a time")
	}
	update, err := openChannelUpdate(channelUpdateConfig{
		repositoryRoot: cfg.RepositoryRoot, channel: cfg.To, roleKeys: cfg.RoleKeys,
		snapshotKey: cfg.SnapshotKey, timestampKey: cfg.TimestampKey, now: cfg.Now,
	})
	if err != nil {
		return err
	}
	source, err := update.chain.channel(cfg.From)
	if err != nil {
		return err
	}
	for _, architecture := range Architectures() {
		if err := update.promote(source, cfg.From, cfg.Version, architecture); err != nil {
			return err
		}
	}
	return update.sign()
}

// promote copies version for architecture from the source channel into the
// channel being updated; the source must offer exactly that version.
func (update *channelUpdate) promote(
	source *metadata.Metadata[metadata.TargetsType], from Channel, version, architecture string,
) error {
	candidate, found, err := readChannelRelease(update.repository.targets, source, from, architecture)
	if err != nil {
		return err
	}
	if !found || candidate.Version != version {
		return fmt.Errorf("the %s channel does not offer %s for linux-%s", from, version, architecture)
	}
	candidate.Channel = update.channel
	_, err = update.apply(candidate)
	return err
}

func requireAdvance(targetsRoot string, role *metadata.Metadata[metadata.TargetsType], candidate ChannelRelease) error {
	current, found, err := readChannelRelease(targetsRoot, role, candidate.Channel, candidate.Architecture)
	if err != nil || !found {
		return err
	}
	if CompareVersions(candidate.Version, current.Version) <= 0 {
		return fmt.Errorf("release %s does not advance the %s channel past %s for linux-%s",
			candidate.Version, candidate.Channel, current.Version, candidate.Architecture)
	}
	return nil
}

func inspectBundles(paths []string) ([]inspectedBundle, error) {
	bundles := make([]inspectedBundle, 0, len(paths))
	seen := map[string]struct{}{}
	for _, path := range paths {
		bundle, err := inspectBundle(path)
		if err != nil {
			return nil, err
		}
		if _, duplicate := seen[bundle.manifest.Architecture]; duplicate {
			return nil, fmt.Errorf("more than one bundle targets linux-%s", bundle.manifest.Architecture)
		}
		if len(bundles) > 0 && bundles[0].manifest.Version != bundle.manifest.Version {
			return nil, errors.New("every published bundle must carry the same release version")
		}
		seen[bundle.manifest.Architecture] = struct{}{}
		bundles = append(bundles, bundle)
	}
	return bundles, nil
}

func inspectBundle(path string) (bundle inspectedBundle, resultErr error) {
	path = filepath.Clean(path)
	verification, err := os.MkdirTemp("", ".snapflow-tuf-verify-*")
	if err != nil {
		return inspectedBundle{}, fmt.Errorf("create bundle verification directory: %w", err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, os.RemoveAll(verification))
	}()
	file, err := os.Open(path)
	if err != nil {
		return inspectedBundle{}, fmt.Errorf("open Snapflow release bundle: %w", err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, file.Close())
	}()
	hash := sha256.New()
	counter := &countingWriter{}
	verified, err := release.InspectBundle(io.TeeReader(file, io.MultiWriter(hash, counter)), verification)
	if err != nil {
		return inspectedBundle{}, fmt.Errorf("verify Snapflow release bundle %s: %w", path, err)
	}
	if _, err := io.Copy(io.MultiWriter(hash, counter), file); err != nil {
		return inspectedBundle{}, fmt.Errorf("hash Snapflow release bundle %s: %w", path, err)
	}
	if filepath.Base(path) != release.BundleFileName(verified.Manifest.Version, verified.Manifest.Architecture) {
		return inspectedBundle{}, fmt.Errorf("bundle %s is not named after its manifest", path)
	}
	if counter.written <= 0 || counter.written > maximumBundleBytes {
		return inspectedBundle{}, fmt.Errorf("bundle %s has an invalid size", path)
	}
	return inspectedBundle{
		path: path, manifest: verified.Manifest, sha256: sha256Digest(hash.Sum(nil)), length: counter.written,
	}, nil
}

type countingWriter struct {
	written int64
}

func (writer *countingWriter) Write(contents []byte) (int, error) {
	writer.written += int64(len(contents))
	return len(contents), nil
}

func copyAsset(source, destination string) (resultErr error) {
	input, err := os.Open(source)
	if err != nil {
		return fmt.Errorf("open release asset: %w", err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, input.Close())
	}()
	directory := filepath.Dir(destination)
	if err := os.MkdirAll(directory, repositoryDirectoryMode); err != nil {
		return fmt.Errorf("create release asset directory: %w", err)
	}
	output, err := os.CreateTemp(directory, ".asset-*")
	if err != nil {
		return fmt.Errorf("create release asset: %w", err)
	}
	_, err = io.Copy(output, input)
	err = errors.Join(err, output.Chmod(repositoryFileMode), output.Sync(), output.Close())
	if err == nil {
		err = os.Rename(output.Name(), destination)
	}
	if err != nil {
		return errors.Join(fmt.Errorf("write release asset: %w", err), os.Remove(output.Name()))
	}
	return atomicfile.SyncDirectory(directory)
}
