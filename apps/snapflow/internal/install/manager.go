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
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/opencontainers/go-digest"
	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/snapflowio/common-go/pkg/processlock"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/snapflowio/snapflow/internal/tuf"
)

const (
	executableProbeTimeout = 10 * time.Second
	releaseDirectoryMode   = 0o755
	stagingPrefix          = ".staging-"
	stagingPattern         = stagingPrefix + "*"
)

type Manager struct {
	cfg Config
}

type Status struct {
	Journal           Journal                  `json:"journal"`
	Verified          *release.VerifiedRelease `json:"verified,omitempty"`
	VerificationError string                   `json:"verificationError,omitempty"`
	Staging           []string                 `json:"staging"`
}

type InstallationRequest struct {
	BundlePath string
	Channel    tuf.Channel
	Digest     string
	Version    string
}

func New(cfg Config) (*Manager, error) {
	validated, err := cfg.validate()
	if err != nil {
		return nil, err
	}
	if validated.RequireRoot && os.Geteuid() != 0 {
		return nil, errors.New("the Snapflow release management must run as root")
	}
	return &Manager{cfg: validated}, nil
}

func (manager *Manager) InstallBundle(
	ctx context.Context,
	request InstallationRequest,
) (record ReleaseRecord, resultErr error) {
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
	parsedDigest, err := digest.Parse(strings.TrimSpace(request.Digest))
	if err != nil || parsedDigest.Algorithm() != digest.SHA256 {
		return ReleaseRecord{}, errors.New("bundle digest must be a valid SHA-256 identity")
	}
	if journal.Active != nil && journal.Active.Digest == parsedDigest.String() {
		return *journal.Active, nil
	}
	releasesRoot := filepath.Join(manager.cfg.InstallationRoot, release.ReleasesDirectoryName)
	if err := os.MkdirAll(releasesRoot, releaseDirectoryMode); err != nil {
		return ReleaseRecord{}, fmt.Errorf("create Snapflow release directory: %w", err)
	}
	finalPath := filepath.Join(releasesRoot, parsedDigest.Encoded())
	verified, err := release.LoadVerified(finalPath, manager.verifyConfig())
	if err != nil {
		verified, err = manager.stage(ctx, journal, request, releasesRoot, finalPath)
	} else {
		err = admitRelease(journal, verified, request, parsedDigest.String())
	}
	if err != nil {
		return ReleaseRecord{}, err
	}
	return manager.activate(ctx, journal, releaseRecord(verified, request.Channel, parsedDigest.String()))
}

func (manager *Manager) stage(
	ctx context.Context,
	journal Journal,
	request InstallationRequest,
	releasesRoot, finalPath string,
) (verified release.VerifiedRelease, resultErr error) {
	stagingPath, err := os.MkdirTemp(releasesRoot, stagingPattern)
	if err != nil {
		return release.VerifiedRelease{}, fmt.Errorf("create release staging directory: %w", err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		if cleanupErr := os.RemoveAll(stagingPath); cleanupErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove release staging directory: %w", cleanupErr))
		}
	}()
	verified, err = manager.extract(ctx, journal, request, stagingPath)
	if err != nil {
		return release.VerifiedRelease{}, err
	}
	if err := os.Rename(stagingPath, finalPath); err != nil {
		return release.VerifiedRelease{}, fmt.Errorf("commit Snapflow release directory: %w", err)
	}
	committed = true
	if err := atomicfile.SyncDirectory(releasesRoot); err != nil {
		return release.VerifiedRelease{}, err
	}
	return verified, nil
}

func (manager *Manager) extract(
	ctx context.Context,
	journal Journal,
	request InstallationRequest,
	stagingPath string,
) (release.VerifiedRelease, error) {
	bundle, err := os.Open(filepath.Clean(request.BundlePath))
	if err != nil {
		return release.VerifiedRelease{}, fmt.Errorf("open authorized Snapflow bundle: %w", err)
	}
	extracted, extractErr := release.ExtractBundle(bundle, stagingPath)
	if err := errors.Join(extractErr, bundle.Close()); err != nil {
		return release.VerifiedRelease{}, fmt.Errorf("extract authorized Snapflow bundle: %w", err)
	}
	if err := admitRelease(journal, extracted, request, digest.Digest(request.Digest).String()); err != nil {
		return release.VerifiedRelease{}, err
	}
	if err := manager.secureRelease(stagingPath); err != nil {
		return release.VerifiedRelease{}, err
	}
	verified, err := release.LoadVerified(stagingPath, manager.verifyConfig())
	if err != nil {
		return release.VerifiedRelease{}, err
	}
	if err := probeExecutables(ctx, verified); err != nil {
		return release.VerifiedRelease{}, err
	}
	if err := syncTree(stagingPath); err != nil {
		return release.VerifiedRelease{}, err
	}
	return verified, nil
}

func admitRelease(journal Journal, verified release.VerifiedRelease, request InstallationRequest, bundleDigest string) error {
	if verified.Manifest.Version != strings.TrimSpace(request.Version) {
		return errors.New("the Snapflow release manifest does not match the signed channel version")
	}
	if journal.HighestVersion == "" {
		return nil
	}
	switch comparison := tuf.CompareVersions(verified.Manifest.Version, journal.HighestVersion); {
	case comparison < 0:
		return fmt.Errorf(
			"the Snapflow release %s is older than trusted release %s",
			verified.Manifest.Version,
			journal.HighestVersion,
		)
	case comparison == 0 && !journal.knows(verified.Manifest.Version, bundleDigest):
		return fmt.Errorf("a different Snapflow release %s was already trusted", verified.Manifest.Version)
	default:
		return nil
	}
}

func (manager *Manager) verifyConfig() release.VerifyConfig {
	return release.VerifyConfig{RequireRootOwnership: manager.cfg.RequireRoot}
}

func (manager *Manager) Verify() (release.VerifiedRelease, error) {
	return release.LoadActive(manager.cfg.InstallationRoot, manager.cfg.RequireRoot)
}

func (manager *Manager) Status() (status Status, resultErr error) {
	lock, err := manager.acquire()
	if err != nil {
		return Status{}, err
	}
	defer func() {
		if closeErr := lock.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("release management lock: %w", closeErr))
		}
	}()
	journal, err := manager.reconcile()
	if err != nil {
		return Status{}, err
	}
	staging, err := filepath.Glob(filepath.Join(
		manager.cfg.InstallationRoot,
		release.ReleasesDirectoryName,
		stagingPattern,
	))
	if err != nil {
		return Status{}, fmt.Errorf("inspect staged releases: %w", err)
	}
	verified, verifyErr := manager.Verify()
	if verifyErr != nil {
		return Status{Journal: journal, VerificationError: verifyErr.Error(), Staging: staging}, nil
	}
	return Status{Journal: journal, Verified: &verified, Staging: staging}, nil
}

func releaseRecord(verified release.VerifiedRelease, channel tuf.Channel, bundleDigest string) ReleaseRecord {
	return ReleaseRecord{
		Digest: bundleDigest, Channel: channel, Version: verified.Manifest.Version, InstalledAt: time.Now().UTC(),
	}
}

func (manager *Manager) acquire() (*processlock.Lock, error) {
	return processlock.Acquire(manager.cfg.RuntimeRoot, ManagementLockName)
}

func (manager *Manager) requireMachineStopped() error {
	lease, err := processlock.Acquire(manager.cfg.RuntimeRoot, DaemonLockName)
	if errors.Is(err, processlock.ErrHeld) {
		return errors.New("machine is active; drain and stop it before changing releases")
	}
	if err != nil {
		return fmt.Errorf("inspect machine activity: %w", err)
	}
	return lease.Close()
}

func (manager *Manager) secureRelease(root string) error {
	return filepath.Walk(root, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if manager.cfg.RequireRoot {
			if err := os.Chown(path, 0, 0); err != nil {
				return fmt.Errorf("set release ownership for %q: %w", path, err)
			}
		}
		if info.IsDir() {
			if err := os.Chmod(path, releaseDirectoryMode); err != nil {
				return fmt.Errorf("set release directory mode for %q: %w", path, err)
			}
		}
		return nil
	})
}

func probeExecutables(ctx context.Context, verified release.VerifiedRelease) error {
	probes := []struct {
		name    string
		path    string
		version string
	}{
		{name: "Snapflow CLI", path: verified.Assets.Snapflow, version: verified.Manifest.FileVersion(release.RoleSnapflow)},
		{name: "Snapflow daemon", path: verified.Assets.Snapflowd, version: verified.Manifest.FileVersion(release.RoleSnapflowd)},
		{name: "Firecracker", path: verified.Assets.Firecracker, version: verified.Manifest.FileVersion(release.RoleFirecracker)},
		{name: "Cloud Hypervisor", path: verified.Assets.CloudHypervisor, version: verified.Manifest.FileVersion(release.RoleCloudHypervisor)},
		{name: "mkfs.erofs", path: verified.Assets.MkfsErofs, version: verified.Manifest.FileVersion(release.RoleMkfsErofs)},
	}
	for _, probe := range probes {
		probeContext, cancel := context.WithTimeout(ctx, executableProbeTimeout)
		output, err := exec.CommandContext(probeContext, probe.path, "--version").CombinedOutput()
		cancel()
		if err != nil {
			return fmt.Errorf("probe %s executable: %w", probe.name, err)
		}
		if !strings.Contains(string(output), strings.TrimPrefix(probe.version, "v")) {
			return fmt.Errorf("%s executable did not report manifest version %q", probe.name, probe.version)
		}
	}
	return nil
}
