// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package development

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/guestrelease"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/snapflowio/snapflow/internal/tuf"
	"golang.org/x/sys/unix"
)

const (
	registryHealthURL              = "http://registry:5000/v2/"
	registryTimeout                = 5 * time.Second
	kvmDevicePath                  = "/dev/kvm"
	minimumPreparationStorageBytes = 10 * 1024 * 1024 * 1024
	daemonPackage                  = "./apps/snapflow/cmd/snapflowd"
	lifecyclePackage               = "./apps/snapflow/cmd/snapflow"
	erofsUtilsDockerfile           = "images/erofs-utils/Dockerfile"
	mkfsErofsFileName              = "mkfs.erofs"
	workRootPattern                = ".prepare-"
	assetsDirectoryName            = "assets"
	developmentVersionPrefix       = "0.0.0-dev."
)

func requiredDevelopmentTools() []string {
	return []string{"buildctl", "git", "go", "sudo"}
}

type Config struct {
	WorkspaceRoot    string
	ReleaseStateHome string
	Version          string
	Stdout           io.Writer
	Stderr           io.Writer
	Stdin            io.Reader
	Now              time.Time
}

type Result struct {
	Profile        config.ProfileName `json:"profile"`
	Version        string             `json:"version"`
	GuestRelease   string             `json:"guestRelease"`
	BundleDigest   string             `json:"bundleDigest"`
	RepositoryRoot string             `json:"repositoryRoot"`
	BootstrapRoot  string             `json:"bootstrapRoot"`
	NextCommands   []string           `json:"nextCommands"`
}

func Prepare(ctx context.Context, cfg Config) (result Result, resultErr error) {
	paths, err := resolvePaths(cfg.WorkspaceRoot, cfg.ReleaseStateHome)
	if err != nil {
		return Result{}, err
	}
	identity, err := newReleaseIdentity(cfg)
	if err != nil {
		return Result{}, err
	}
	executor := commandExecutor{stdout: cfg.Stdout, stderr: cfg.Stderr, stdin: cfg.Stdin}
	if err := checkPrerequisites(ctx, executor, paths); err != nil {
		return Result{}, err
	}
	if identity.revision, err = executor.output(ctx, paths.workspace, "git", "rev-parse", "HEAD"); err != nil {
		return Result{}, err
	}
	workRoot, err := os.MkdirTemp(paths.state, workRootPattern)
	if err != nil {
		return Result{}, fmt.Errorf("create development release workspace: %w", err)
	}
	defer func() {
		if removeErr := os.RemoveAll(workRoot); removeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove development release workspace: %w", removeErr))
		}
	}()
	built, err := buildRelease(ctx, executor, paths.workspace, workRoot, identity)
	if err != nil {
		return Result{}, err
	}
	if err := publishRelease(paths, identity, built.bundle); err != nil {
		return Result{}, err
	}
	return installRelease(ctx, executor, paths, identity, built)
}

type releaseIdentity struct {
	version  string
	revision string
	builtAt  time.Time
}

type builtRelease struct {
	bundle       string
	lifecycleCLI string
	guestRelease string
}

func newReleaseIdentity(cfg Config) (releaseIdentity, error) {
	builtAt := cfg.Now.UTC()
	if cfg.Now.IsZero() {
		builtAt = time.Now().UTC()
	}
	stamp := builtAt.UnixNano()
	if stamp <= 0 {
		return releaseIdentity{}, errors.New("development release time must be after the Unix epoch")
	}
	identity := releaseIdentity{version: strings.TrimSpace(cfg.Version), builtAt: builtAt}
	if identity.version == "" {
		identity.version = developmentVersionPrefix + strconv.FormatInt(stamp, 10)
	}
	return identity, nil
}

func checkPrerequisites(ctx context.Context, executor commandExecutor, paths releasePaths) error {
	if err := validateDevelopmentHost(paths.state); err != nil {
		return err
	}
	if err := checkRegistry(ctx); err != nil {
		return err
	}
	if err := executor.run(ctx, paths.workspace, nil, "buildctl", "debug", "workers"); err != nil {
		return errors.New("development BuildKit is unavailable; rebuild the development container with its buildkit service")
	}
	return nil
}

func buildRelease(
	ctx context.Context,
	executor commandExecutor,
	workspace, workRoot string,
	identity releaseIdentity,
) (builtRelease, error) {
	if err := buildGuestImages(ctx, executor, workspace, identity.version); err != nil {
		return builtRelease{}, err
	}
	mkfsErofs, err := buildErofsUtils(ctx, executor, workspace, filepath.Join(workRoot, "erofs-utils"))
	if err != nil {
		return builtRelease{}, err
	}
	guestRelease, err := guestrelease.Publish(ctx, guestrelease.PublishConfig{
		Repository: config.DevelopmentGuestRepository,
		Version:    identity.version, Revision: identity.revision, Platforms: "linux/" + runtime.GOARCH,
		Desktop: true, Insecure: true, MkfsErofs: mkfsErofs,
	})
	if err != nil {
		return builtRelease{}, fmt.Errorf("publish development guest release: %w", err)
	}
	bundle, lifecycleCLI, err := buildRuntimeBundle(ctx, executor, workspace, workRoot, identity, guestRelease.Reference, mkfsErofs)
	if err != nil {
		return builtRelease{}, err
	}
	return builtRelease{bundle: bundle, lifecycleCLI: lifecycleCLI, guestRelease: guestRelease.Reference}, nil
}

func publishRelease(paths releasePaths, identity releaseIdentity, bundle string) error {
	if err := initializeRepository(paths, identity.builtAt); err != nil {
		return err
	}
	keys := tuf.LocalKeys(paths.keys)
	if err := tuf.Publish(tuf.PublishConfig{
		RepositoryRoot: paths.repository, Channel: tuf.BetaChannel, Bundles: []string{bundle},
		AssetsRoot: filepath.Join(paths.repository, assetsDirectoryName),
		RoleKeys:   []string{keys.Role}, SnapshotKey: keys.Snapshot, TimestampKey: keys.Timestamp, Now: identity.builtAt,
	}); err != nil {
		return fmt.Errorf("publish signed development release: %w", err)
	}
	return nil
}

func installRelease(
	ctx context.Context,
	executor commandExecutor,
	paths releasePaths,
	identity releaseIdentity,
	built builtRelease,
) (result Result, resultErr error) {
	server, err := startRepositoryServer(ctx, paths.repository)
	if err != nil {
		return Result{}, err
	}
	defer func() {
		if closeErr := server.Close(ctx); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("stop local release repository: %w", closeErr))
		}
	}()
	bootstrapRoot := tuf.BootstrapRootPath(paths.repository)
	if err := runLifecycleCLI(ctx, executor, paths.workspace, built.lifecycleCLI,
		"release", "install", "--profile", string(config.Development),
		"--repository-origin", server.Origin(), "--bootstrap-root", bootstrapRoot); err != nil {
		return Result{}, fmt.Errorf("install development Snapflow release: %w", err)
	}
	if err := runLifecycleCLI(ctx, executor, paths.workspace, built.lifecycleCLI,
		"release", "verify", "--profile", string(config.Development)); err != nil {
		return Result{}, fmt.Errorf("verify activated development Snapflow release: %w", err)
	}
	installed, err := release.LoadActive(config.DevelopmentInstallationRoot, true)
	if err != nil {
		return Result{}, fmt.Errorf("read activated development Snapflow release: %w", err)
	}
	if installed.Manifest.Version != identity.version || installed.Manifest.Guest.Reference != built.guestRelease {
		return Result{}, errors.New("activated development Snapflow release identity does not match the prepared release")
	}
	return Result{
		Profile: config.Development, Version: identity.version,
		GuestRelease: built.guestRelease, BundleDigest: installed.BundleDigest,
		RepositoryRoot: paths.repository, BootstrapRoot: bootstrapRoot,
		NextCommands: []string{text.DevelopmentServeTask, text.DevelopmentDoctorTask},
	}, nil
}

func validateDevelopmentHost(stateRoot string) error {
	if runtime.GOOS != "linux" {
		return fmt.Errorf("development Snapflow releases require Linux, not %s", runtime.GOOS)
	}
	if runtime.GOARCH != "amd64" && runtime.GOARCH != "arm64" {
		return fmt.Errorf("development Snapflow releases require amd64 or arm64, not %s", runtime.GOARCH)
	}
	for _, tool := range requiredDevelopmentTools() {
		if tool == "sudo" && os.Geteuid() == 0 {
			continue
		}
		if _, err := exec.LookPath(tool); err != nil {
			return fmt.Errorf("required development tool %q is unavailable: %w", tool, err)
		}
	}
	if err := unix.Access(kvmDevicePath, unix.R_OK|unix.W_OK); err != nil {
		return fmt.Errorf("development KVM device %s is not readable and writable: %w", kvmDevicePath, err)
	}
	var statistics unix.Statfs_t
	if err := unix.Statfs(stateRoot, &statistics); err != nil {
		return fmt.Errorf("inspect development release storage: %w", err)
	}
	available := statistics.Bavail * uint64(statistics.Bsize)
	if available < minimumPreparationStorageBytes {
		return fmt.Errorf(
			"development release storage has %d bytes available; at least %d required",
			available,
			minimumPreparationStorageBytes,
		)
	}
	return nil
}

func runLifecycleCLI(
	ctx context.Context,
	executor commandExecutor,
	workspace string,
	lifecycleCLI string,
	arguments ...string,
) error {
	if os.Geteuid() == 0 {
		return executor.run(ctx, workspace, nil, lifecycleCLI, arguments...)
	}
	sudoArguments := append([]string{"--", lifecycleCLI}, arguments...)
	return executor.run(ctx, workspace, nil, "sudo", sudoArguments...)
}

func checkRegistry(ctx context.Context) error {
	client := &http.Client{Timeout: registryTimeout}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, registryHealthURL, nil)
	if err != nil {
		return fmt.Errorf("create registry health request: %w", err)
	}
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("local OCI registry is unavailable at %s: %w", registryHealthURL, err)
	}
	closeErr := response.Body.Close()
	if closeErr != nil {
		return fmt.Errorf("close registry health response: %w", closeErr)
	}
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("local OCI registry returned HTTP %d", response.StatusCode)
	}
	return nil
}

func initializeRepository(paths releasePaths, now time.Time) error {
	keys := tuf.LocalKeys(paths.keys)
	if _, err := os.Stat(tuf.TimestampPath(paths.repository)); err == nil {
		for _, required := range []string{tuf.BootstrapRootPath(paths.repository), keys.Role, keys.Snapshot, keys.Timestamp} {
			if info, inspectErr := os.Stat(required); inspectErr != nil || !info.Mode().IsRegular() {
				return errors.New("development TUF state is incomplete; inspect it or run the explicit development reset")
			}
		}
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("inspect development TUF repository: %w", err)
	}
	if _, err := os.Stat(paths.repository); err == nil {
		return errors.New("development TUF repository is incomplete; inspect it or run the explicit development reset")
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("inspect development TUF repository: %w", err)
	}
	return tuf.Initialize(tuf.InitializeConfig{
		RepositoryRoot: paths.repository, PrivateKeyRoot: paths.keys,
		Policy: tuf.LocalPolicy, Now: now,
	})
}

func buildRuntimeBundle(
	ctx context.Context,
	executor commandExecutor,
	workspace, workRoot string,
	identity releaseIdentity,
	guestRelease, mkfsErofs string,
) (string, string, error) {
	snapflowdBinary := filepath.Join(workRoot, text.Daemon)
	lifecycleCLI := filepath.Join(workRoot, text.Binary)
	guestInit := filepath.Join(workRoot, "guest-init")
	initrd := filepath.Join(workRoot, "initrd")
	buildEnvironment := []string{"CGO_ENABLED=0", "GOOS=linux", "GOARCH=" + runtime.GOARCH}
	if err := executor.run(ctx, workspace, buildEnvironment, "go", "build", "-trimpath", "-ldflags=-s -w -X main.version="+identity.version, "-o", snapflowdBinary, daemonPackage); err != nil {
		return "", "", err
	}
	if err := executor.run(ctx, workspace, buildEnvironment, "go", "build", "-trimpath", "-ldflags=-s -w -X main.version="+identity.version, "-o", lifecycleCLI, lifecyclePackage); err != nil {
		return "", "", err
	}
	if err := executor.run(ctx, workspace, buildEnvironment, "go", "build", "-trimpath", "-ldflags=-s -w", "-o", guestInit, "./libs/microvm-go/cmd/guest-init"); err != nil {
		return "", "", err
	}
	if err := executor.run(ctx, workspace, nil, "go", "run", "./libs/microvm-go/cmd/build-initrd", "--init", guestInit, "--output", initrd); err != nil {
		return "", "", err
	}
	downloadedAssets, err := release.FetchAssets(ctx, runtime.GOARCH, filepath.Join(workRoot, "assets"))
	if err != nil {
		return "", "", err
	}
	bundle, err := release.BuildBundle(release.BundleConfig{
		Version: identity.version, Revision: identity.revision, BuiltAt: identity.builtAt,
		Architecture: runtime.GOARCH, GuestRelease: guestRelease,
		Inputs: release.BundleInputs{
			Snapflow: lifecycleCLI, Snapflowd: snapflowdBinary,
			Firecracker:     downloadedAssets.Firecracker,
			CloudHypervisor: downloadedAssets.CloudHypervisor, MkfsErofs: mkfsErofs, Kernel: downloadedAssets.Kernel, Initrd: initrd,
			Notices: filepath.Join(workspace, "apps", "snapflow", "packaging", "THIRD_PARTY_NOTICES.md"),
		},
		OutputRoot: workRoot,
	})
	if err != nil {
		return "", "", err
	}
	return bundle, lifecycleCLI, nil
}
