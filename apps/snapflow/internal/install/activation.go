// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package install

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/opencontainers/go-digest"
	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/snapflowio/snapflow/internal/tuf"
)

func (manager *Manager) activate(ctx context.Context, journal Journal, record ReleaseRecord) (ReleaseRecord, error) {
	if err := ctx.Err(); err != nil {
		return ReleaseRecord{}, err
	}
	if journal.HighestVersion != "" && tuf.CompareVersions(record.Version, journal.HighestVersion) < 0 {
		return ReleaseRecord{}, errors.New("release activation would lower the trusted version")
	}
	journal.Staged = &record
	if journal.HighestVersion == "" || tuf.CompareVersions(record.Version, journal.HighestVersion) > 0 {
		journal.HighestVersion = record.Version
	}
	if err := saveJournal(manager.cfg.StateRoot, journal); err != nil {
		return ReleaseRecord{}, err
	}
	if err := manager.replaceCurrent(record.Digest); err != nil {
		return ReleaseRecord{}, err
	}
	if err := manager.linkCommand(); err != nil {
		return ReleaseRecord{}, err
	}
	if journal.Active != nil && journal.Active.Digest != record.Digest {
		journal.Previous = journal.Active
	}
	journal.Active = &record
	journal.Staged = nil
	if err := saveJournal(manager.cfg.StateRoot, journal); err != nil {
		return ReleaseRecord{}, err
	}
	return record, nil
}

func (manager *Manager) Rollback(ctx context.Context) (record ReleaseRecord, resultErr error) {
	lock, err := manager.acquire()
	if err != nil {
		return ReleaseRecord{}, err
	}
	defer func() {
		if closeErr := lock.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("release management lock: %w", closeErr))
		}
	}()
	if err := manager.requireMachineStopped(); err != nil {
		return ReleaseRecord{}, err
	}
	journal, err := manager.reconcile()
	if err != nil {
		return ReleaseRecord{}, err
	}
	if journal.Previous == nil {
		return ReleaseRecord{}, errors.New("no previously verified Snapflow release is retained")
	}
	previous := *journal.Previous
	directory, err := releaseDirectory(manager.cfg.InstallationRoot, previous.Digest)
	if err != nil {
		return ReleaseRecord{}, err
	}
	previousRelease, err := release.LoadVerified(directory, manager.verifyConfig())
	if err != nil {
		return ReleaseRecord{}, fmt.Errorf("verify rollback release: %w", err)
	}
	if activeRelease, activeErr := manager.Verify(); activeErr == nil &&
		activeRelease.Manifest.Guest.ControlProtocolVersion != previousRelease.Manifest.Guest.ControlProtocolVersion {
		return ReleaseRecord{}, errors.New("rollback release uses an incompatible guest control protocol")
	}
	if err := ctx.Err(); err != nil {
		return ReleaseRecord{}, err
	}
	journal.Staged = &previous
	if err := saveJournal(manager.cfg.StateRoot, journal); err != nil {
		return ReleaseRecord{}, err
	}
	if err := manager.replaceCurrent(previous.Digest); err != nil {
		return ReleaseRecord{}, err
	}
	journal.Previous = journal.Active
	journal.Active = &previous
	journal.Staged = nil
	if err := saveJournal(manager.cfg.StateRoot, journal); err != nil {
		return ReleaseRecord{}, err
	}
	return previous, nil
}

func (manager *Manager) replaceCurrent(identity string) (resultErr error) {
	parsed, err := digest.Parse(identity)
	if err != nil || parsed.Algorithm() != digest.SHA256 {
		return errors.New("activation identity is not a SHA-256 digest")
	}
	if err := os.MkdirAll(manager.cfg.InstallationRoot, releaseDirectoryMode); err != nil {
		return fmt.Errorf("create Snapflow installation root: %w", err)
	}
	temporary, err := os.CreateTemp(manager.cfg.InstallationRoot, ".current-*")
	if err != nil {
		return fmt.Errorf("reserve activation pointer: %w", err)
	}
	temporaryPath := temporary.Name()
	if err := temporary.Close(); err != nil {
		return errors.Join(err, os.Remove(temporaryPath))
	}
	if err := os.Remove(temporaryPath); err != nil {
		return fmt.Errorf("prepare activation pointer: %w", err)
	}
	target := filepath.Join(release.ReleasesDirectoryName, parsed.Encoded())
	if err := os.Symlink(target, temporaryPath); err != nil {
		return fmt.Errorf("create activation pointer: %w", err)
	}
	cleanup := true
	defer func() {
		if cleanup {
			if removeErr := os.Remove(temporaryPath); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
				resultErr = errors.Join(resultErr, fmt.Errorf("remove temporary activation pointer: %w", removeErr))
			}
		}
	}()
	if err := os.Rename(temporaryPath, filepath.Join(manager.cfg.InstallationRoot, release.CurrentLinkName)); err != nil {
		return fmt.Errorf("activate Snapflow release: %w", err)
	}
	cleanup = false
	return atomicfile.SyncDirectory(manager.cfg.InstallationRoot)
}

func (manager *Manager) linkCommand() error {
	if manager.cfg.CommandLink == "" {
		return nil
	}
	target := filepath.Join(manager.cfg.InstallationRoot, release.CurrentLinkName, filepath.FromSlash(release.CommandPath))
	if current, err := os.Readlink(manager.cfg.CommandLink); err == nil && current == target {
		return nil
	}
	directory := filepath.Dir(manager.cfg.CommandLink)
	if err := os.MkdirAll(directory, releaseDirectoryMode); err != nil {
		return fmt.Errorf("create Snapflow command directory: %w", err)
	}
	temporary := filepath.Join(directory, ".snapflow-link")
	if err := os.Remove(temporary); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("prepare Snapflow command link: %w", err)
	}
	if err := os.Symlink(target, temporary); err != nil {
		return fmt.Errorf("create Snapflow command link: %w", err)
	}
	if err := os.Rename(temporary, manager.cfg.CommandLink); err != nil {
		return errors.Join(fmt.Errorf("install Snapflow command link: %w", err), os.Remove(temporary))
	}
	return atomicfile.SyncDirectory(directory)
}

func releaseDirectory(installationRoot, identity string) (string, error) {
	parsed, err := digest.Parse(strings.TrimSpace(identity))
	if err != nil || parsed.Algorithm() != digest.SHA256 {
		return "", errors.New("release identity is not a SHA-256 digest")
	}
	return filepath.Join(installationRoot, release.ReleasesDirectoryName, parsed.Encoded()), nil
}

func (manager *Manager) reconcile() (Journal, error) {
	journal, err := loadJournal(manager.cfg.StateRoot)
	if err != nil {
		return Journal{}, err
	}
	if journal.Staged == nil {
		return journal, nil
	}
	active, err := release.LoadActive(manager.cfg.InstallationRoot, manager.cfg.RequireRoot)
	activeDigest := ""
	if err == nil {
		activeDigest = "sha256:" + filepath.Base(active.Root)
	}
	if err == nil && activeDigest == journal.Staged.Digest &&
		active.Manifest.Version == journal.Staged.Version {
		if journal.Active != nil && journal.Active.Digest != journal.Staged.Digest {
			journal.Previous = journal.Active
		}
		journal.Active = journal.Staged
	}
	journal.Staged = nil
	if err := saveJournal(manager.cfg.StateRoot, journal); err != nil {
		return Journal{}, err
	}
	return journal, nil
}
