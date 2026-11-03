// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"context"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/snapflowio/snapflow/internal/release"
	"github.com/theupdateframework/go-tuf/v2/metadata"
)

const (
	testInputBytes    = 512
	testFileMode      = 0o644
	testFirstVersion  = "1.0.0"
	testSecondVersion = "1.0.1"
	testThirdVersion  = "1.1.0"
	testRevision      = "0123456789abcdef"
	testGuestRelease  = "registry.example.com/snapflow/guest@sha256:1111111111111111111111111111111111111111111111111111111111111111"
	expiryWarning     = 30 * 24 * time.Hour
)

type testRepository struct {
	root    string
	keys    string
	assets  string
	scratch string
	now     time.Time
}

func newTestRepository(t *testing.T, policy Policy) testRepository {
	t.Helper()
	scratch := t.TempDir()
	repository := testRepository{
		root: filepath.Join(scratch, "repository"), keys: filepath.Join(scratch, "keys"),
		scratch: scratch, now: time.Now().UTC(),
	}
	repository.assets = filepath.Join(repository.root, "assets")
	if err := Initialize(InitializeConfig{
		RepositoryRoot: repository.root, PrivateKeyRoot: repository.keys, Policy: policy, Now: repository.now,
	}); err != nil {
		t.Fatalf("Initialize() error = %v", err)
	}
	return repository
}

func (repository testRepository) key(role string) string {
	return filepath.Join(repository.keys, privateKeyName(role, 1))
}

func (repository testRepository) publish(channel Channel, bundles ...string) error {
	return Publish(PublishConfig{
		RepositoryRoot: repository.root, Channel: channel, Bundles: bundles, AssetsRoot: repository.assets,
		RoleKeys:    []string{repository.key(string(channel))},
		SnapshotKey: repository.key(metadata.SNAPSHOT), TimestampKey: repository.key(metadata.TIMESTAMP),
		Now: repository.now,
	})
}

func (repository testRepository) promote(version string) error {
	return Promote(PromoteConfig{
		RepositoryRoot: repository.root, From: BetaChannel, To: StableChannel, Version: version,
		RoleKeys:    []string{repository.key(string(StableChannel))},
		SnapshotKey: repository.key(metadata.SNAPSHOT), TimestampKey: repository.key(metadata.TIMESTAMP),
		Now: repository.now,
	})
}

func testBundle(t *testing.T, version, architecture string) string {
	t.Helper()
	inputs := t.TempDir()
	input := func(name string) string {
		contents := make([]byte, testInputBytes)
		if _, err := rand.Read(contents); err != nil {
			t.Fatalf("generate %s: %v", name, err)
		}
		path := filepath.Join(inputs, name)
		if err := os.WriteFile(path, contents, testFileMode); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
		return path
	}
	bundle, err := release.BuildBundle(release.BundleConfig{
		Version: version, Revision: testRevision, BuiltAt: time.Now(), Architecture: architecture,
		GuestRelease: testGuestRelease, OutputRoot: t.TempDir(),
		Inputs: release.BundleInputs{
			Snapflow: input("snapflow"), Snapflowd: input("snapflowd"), Firecracker: input("firecracker"),
			CloudHypervisor: input("cloud-hypervisor"), MkfsErofs: input("mkfs.erofs"),
			Kernel: input("kernel"), Initrd: input("initrd"),
		},
	})
	if err != nil {
		t.Fatalf("BuildBundle() error = %v", err)
	}
	return bundle
}

func (repository testRepository) client(t *testing.T, origin string) *Client {
	t.Helper()
	root, err := os.ReadFile(BootstrapRootPath(repository.root))
	if err != nil {
		t.Fatalf("read bootstrap root: %v", err)
	}
	client, err := NewClient(ClientConfig{
		Origin: origin, AssetOrigin: origin + "/assets/", BootstrapRoot: root,
		StateRoot: filepath.Join(repository.scratch, "state"), Transport: LoopbackHTTPTransport,
	})
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	client.headroom = 0
	return client
}

func TestLocalRepositoryPublishesRotatesAndDownloads(t *testing.T) {
	repository := newTestRepository(t, LocalPolicy)
	latest := publishAcrossRootRotation(t, repository)
	server := httptest.NewServer(http.FileServer(http.Dir(repository.root)))
	defer server.Close()
	assertDownloadVerifiesAssets(t, repository, repository.client(t, server.URL), latest)
}

// publishAcrossRootRotation publishes three beta releases, rotating the root
// keys before the last, and returns the last bundle.
func publishAcrossRootRotation(t *testing.T, repository testRepository) string {
	t.Helper()
	first := testBundle(t, testFirstVersion, runtime.GOARCH)
	if err := repository.publish(BetaChannel, first); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}
	if err := repository.publish(BetaChannel, first); err != nil {
		t.Fatalf("Publish() of the already published bundle error = %v", err)
	}
	if err := repository.publish(BetaChannel, testBundle(t, testFirstVersion, runtime.GOARCH)); err == nil {
		t.Fatal("Publish() accepted a version that does not advance the channel")
	}
	if err := repository.publish(BetaChannel, testBundle(t, testSecondVersion, runtime.GOARCH)); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}
	newRootKeys := filepath.Join(repository.scratch, "new-root")
	if err := GenerateRootKeys(newRootKeys); err != nil {
		t.Fatalf("GenerateRootKeys() error = %v", err)
	}
	if err := RotateRoot(RotateRootConfig{
		RepositoryRoot: repository.root, CurrentKeys: []string{repository.key(metadata.ROOT)},
		NewKeys: []string{filepath.Join(newRootKeys, privateKeyName(metadata.ROOT, 1))}, Now: repository.now,
	}); err != nil {
		t.Fatalf("RotateRoot() error = %v", err)
	}
	latest := testBundle(t, testThirdVersion, runtime.GOARCH)
	if err := repository.publish(BetaChannel, latest); err != nil {
		t.Fatalf("Publish() after root rotation error = %v", err)
	}
	return latest
}

// assertDownloadVerifiesAssets resolves and downloads latest from the beta
// channel, then checks a tampered asset is rejected.
func assertDownloadVerifiesAssets(t *testing.T, repository testRepository, client *Client, latest string) {
	t.Helper()
	selected, err := client.Resolve(BetaChannel)
	if err != nil {
		t.Fatalf("Resolve() error = %v", err)
	}
	info, err := os.Stat(latest)
	if err != nil {
		t.Fatalf("inspect bundle: %v", err)
	}
	if selected.Version != testThirdVersion || selected.Length != info.Size() {
		t.Fatalf("resolved release = %+v", selected)
	}
	downloaded, err := client.Download(context.Background(), selected)
	if err != nil {
		t.Fatalf("Download() error = %v", err)
	}
	if err := os.Remove(downloaded); err != nil {
		t.Fatalf("remove download: %v", err)
	}

	tampered := filepath.Join(repository.assets, filepath.FromSlash(selected.AssetPath()))
	if err := os.WriteFile(tampered, make([]byte, info.Size()), testFileMode); err != nil {
		t.Fatalf("tamper with asset: %v", err)
	}
	if _, err := client.Download(context.Background(), selected); err == nil {
		t.Fatal("Download() accepted an asset that does not match the signed channel")
	}
}

func TestProductionRepositoryPromotesRefreshesAndRotatesChannelKeys(t *testing.T) {
	repository := newTestRepository(t, ProductionPolicy)
	publishAndPromote(t, repository)
	refreshAndCheckExpiry(t, repository)
	rotateBetaKey(t, repository)
	if err := Resign(ResignConfig{
		RepositoryRoot: repository.root, Role: metadata.ROOT,
		Keys: []string{filepath.Join(repository.keys, privateKeyName(metadata.ROOT, 1))}, Now: repository.now,
	}); err == nil {
		t.Fatal("Resign() met the root threshold with one of three keys")
	}
}

// publishAndPromote publishes the first release for every architecture to
// beta and promotes it to stable, twice to prove promotion is idempotent.
func publishAndPromote(t *testing.T, repository testRepository) {
	t.Helper()
	bundles := []string{}
	for _, architecture := range Architectures() {
		bundles = append(bundles, testBundle(t, testFirstVersion, architecture))
	}
	if err := repository.publish(BetaChannel, bundles...); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}
	if err := repository.promote(testSecondVersion); err == nil {
		t.Fatal("Promote() accepted a version the beta channel does not offer")
	}
	if err := repository.promote(testFirstVersion); err != nil {
		t.Fatalf("Promote() error = %v", err)
	}
	if err := repository.promote(testFirstVersion); err != nil {
		t.Fatalf("Promote() of the current stable release error = %v", err)
	}
}

// refreshAndCheckExpiry re-signs the beta channel and checks that only a
// window past the root's validity reports root as expiring.
func refreshAndCheckExpiry(t *testing.T, repository testRepository) {
	t.Helper()
	if err := Refresh(RefreshConfig{
		RepositoryRoot: repository.root, ChannelKeys: map[Channel]string{BetaChannel: repository.key(string(BetaChannel))},
		SnapshotKey: repository.key(metadata.SNAPSHOT), TimestampKey: repository.key(metadata.TIMESTAMP),
		Now: repository.now.Add(time.Hour),
	}); err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}
	if _, err := CheckExpiry(ExpiryConfig{RepositoryRoot: repository.root, Within: expiryWarning, Now: repository.now}); err != nil {
		t.Fatalf("CheckExpiry() error = %v", err)
	}
	if _, err := CheckExpiry(ExpiryConfig{
		RepositoryRoot: repository.root, Within: rootValidity + time.Hour, Now: repository.now,
	}); err == nil || !strings.Contains(err.Error(), metadata.ROOT) {
		t.Fatalf("CheckExpiry() error = %v, want root expiry warning", err)
	}
}

// rotateBetaKey replaces the beta key in a targets ceremony and checks the
// revoked key can no longer publish while the replacement can.
func rotateBetaKey(t *testing.T, repository testRepository) {
	t.Helper()
	replacement := filepath.Join(repository.scratch, "beta-2.pem")
	if err := GenerateKey(replacement); err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}
	if err := Resign(ResignConfig{
		RepositoryRoot: repository.root, Role: metadata.TARGETS, Keys: []string{repository.key(metadata.TARGETS)},
		Replace:     map[string]string{string(BetaChannel): replacement},
		SnapshotKey: repository.key(metadata.SNAPSHOT), TimestampKey: repository.key(metadata.TIMESTAMP),
		Now: repository.now,
	}); err != nil {
		t.Fatalf("Resign() error = %v", err)
	}
	next := []string{}
	for _, architecture := range Architectures() {
		next = append(next, testBundle(t, testSecondVersion, architecture))
	}
	if err := repository.publish(BetaChannel, next...); err == nil {
		t.Fatal("Publish() accepted the revoked beta key")
	}
	if err := Publish(PublishConfig{
		RepositoryRoot: repository.root, Channel: BetaChannel, Bundles: next, RoleKeys: []string{replacement},
		SnapshotKey: repository.key(metadata.SNAPSHOT), TimestampKey: repository.key(metadata.TIMESTAMP),
		Now: repository.now,
	}); err != nil {
		t.Fatalf("Publish() with the replacement key error = %v", err)
	}
}

func TestPublishRejectsInvalidRequests(t *testing.T) {
	repository := newTestRepository(t, LocalPolicy)
	valid := testBundle(t, testFirstVersion, runtime.GOARCH)
	renamed := filepath.Join(t.TempDir(), "renamed.tar.zst")
	contents, err := os.ReadFile(valid)
	if err != nil {
		t.Fatalf("read bundle: %v", err)
	}
	if err := os.WriteFile(renamed, contents, testFileMode); err != nil {
		t.Fatalf("write renamed bundle: %v", err)
	}
	tests := map[string]func(*PublishConfig){
		"channel without a delegation": func(cfg *PublishConfig) { cfg.Channel = StableChannel },
		"no bundles":                   func(cfg *PublishConfig) { cfg.Bundles = nil },
		"duplicate architecture":       func(cfg *PublishConfig) { cfg.Bundles = []string{valid, valid} },
		"bundle not named after its manifest": func(cfg *PublishConfig) {
			cfg.Bundles = []string{renamed}
		},
		"missing role key":     func(cfg *PublishConfig) { cfg.RoleKeys = nil },
		"wrong role key":       func(cfg *PublishConfig) { cfg.RoleKeys = []string{repository.key(metadata.TARGETS)} },
		"missing snapshot key": func(cfg *PublishConfig) { cfg.SnapshotKey = filepath.Join(repository.keys, "missing.pem") },
	}
	for name, mutate := range tests {
		t.Run(name, func(t *testing.T) {
			cfg := PublishConfig{
				RepositoryRoot: repository.root, Channel: BetaChannel, Bundles: []string{valid},
				RoleKeys:    []string{repository.key(string(BetaChannel))},
				SnapshotKey: repository.key(metadata.SNAPSHOT), TimestampKey: repository.key(metadata.TIMESTAMP),
				Now: repository.now,
			}
			mutate(&cfg)
			if err := Publish(cfg); err == nil {
				t.Fatal("Publish() accepted an invalid request")
			}
		})
	}
}
