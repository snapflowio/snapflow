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

//go:build linux

package guestinit

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	guestconfig "github.com/snapflowio/microvm-go/guest/config"
	"github.com/snapflowio/microvm-go/internal/guest/control"
)

const workdirMode = 0o755

func Run() error {
	bootStarted := time.Now()
	Log("boot starting")
	cfg, err := prepareRoot(bootStarted)
	if err != nil {
		return err
	}
	children := startChildReaper()
	configurationStore, err := guestconfig.OpenStore(guestconfig.DefaultConfigPath)
	if err != nil {
		return fmt.Errorf("open guest init configuration: %w", err)
	}
	services, err := startGuestServices(bootStarted, cfg, configurationStore, children)
	if err != nil {
		return err
	}
	pendingInitialization, err := services.prepareWorkload(bootStarted, cfg, configurationStore)
	if err != nil {
		return services.shutdown(err)
	}
	exitCode, workloadStarted, runErr := runSandboxLifecycle(services.ctx, cfg, pendingInitialization, children, bootStarted, time.Now())
	if err := services.close(runErr); err != nil {
		return err
	}
	if workloadStarted {
		reportWorkloadExit(exitCode, cfg.GuestInit.GenerationID)
	}
	Poweroff(exitCode)
	return nil
}

func prepareRoot(bootStarted time.Time) (*Config, error) {
	if err := runBootPhase(bootStarted, bootPhaseEssentialMounts, mountEssentials); err != nil {
		return nil, err
	}
	if err := runBootPhase(bootStarted, bootPhaseRootFilesystem, setupRootfs); err != nil {
		return nil, err
	}
	phaseStarted := time.Now()
	cfg, injectedFile, err := readConfig()
	logBootMilestone(bootStarted, phaseStarted, bootPhaseConfiguration, err)
	if err != nil {
		return nil, err
	}
	if err := runBootPhase(bootStarted, bootPhaseNetwork, func() error { return configureNetwork(cfg) }); err != nil {
		Log("network setup failed: %v", err)
	}
	if err := mountGuestFilesystems(bootStarted, cfg); err != nil {
		return nil, err
	}
	if err := installInjectedFile(cfg, injectedFile); err != nil {
		return nil, err
	}
	if err := runBootPhase(bootStarted, bootPhaseRootBindings, bindRootFilesystems); err != nil {
		return nil, err
	}
	if err := runBootPhase(bootStarted, bootPhaseChroot, func() error { return enterRoot(cfg) }); err != nil {
		return nil, err
	}
	return cfg, nil
}

func mountGuestFilesystems(bootStarted time.Time, cfg *Config) error {
	if err := runBootPhase(bootStarted, bootPhaseManagedHosts, func() error { return configureManagedHosts(cfg) }); err != nil {
		return err
	}
	if err := runBootPhase(bootStarted, bootPhaseBundles, func() error { return mountPlatformBundles(cfg) }); err != nil {
		return err
	}
	if cfg.RequireCgroups {
		if err := runBootPhase(bootStarted, bootPhaseCgroups, setupCgroups); err != nil {
			return fmt.Errorf("configure builder cgroups: %w", err)
		}
	}
	return runBootPhase(bootStarted, bootPhaseVolumes, func() error { return mountConfiguredVolumes(cfg) })
}

func bindRootFilesystems() error {
	if err := bindHostFilesystems(); err != nil {
		return err
	}
	return bindRootOverlayForQuiescing()
}

func enterRoot(cfg *Config) error {
	if err := syscall.Chroot(newRoot); err != nil {
		return fmt.Errorf("chroot: %w", err)
	}
	if err := os.Chdir("/"); err != nil {
		return fmt.Errorf("chdir /: %w", err)
	}
	if err := os.MkdirAll(cfg.Workdir, workdirMode); err != nil {
		return fmt.Errorf("create workdir: %w", err)
	}
	if err := control.ApplyHostIdentity(cfg.Hostname, cfg.MachineID); err != nil {
		return fmt.Errorf("apply instance host identity: %w", err)
	}
	return writeGuestInitConfig(cfg)
}

type guestServices struct {
	ctx        context.Context
	cancel     context.CancelCauseFunc
	failures   chan error
	control    *control.Service
	components *runningPlatformComponents
	relays     *platformServiceRelays
}

func startGuestServices(bootStarted time.Time, cfg *Config, store *guestconfig.Store, children *childReaper) (*guestServices, error) {
	phaseStarted := time.Now()
	controlService, err := control.StartService(store, control.ListenVSock)
	logBootMilestone(bootStarted, phaseStarted, bootPhaseControl, err)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithCancelCause(context.Background())
	services := &guestServices{ctx: ctx, cancel: cancel, failures: make(chan error, 1), control: controlService}
	services.watch(controlService.Errors())
	phaseStarted = time.Now()
	services.components, err = startPlatformComponents(cfg, children)
	logBootMilestone(bootStarted, phaseStarted, bootPhaseComponents, err)
	if err != nil {
		cancel(err)
		return nil, errors.Join(err, controlService.Close())
	}
	phaseStarted = time.Now()
	services.relays, err = startPlatformServiceRelays(cfg)
	logBootMilestone(bootStarted, phaseStarted, bootPhaseRelays, err)
	if err != nil {
		cancel(err)
		return nil, errors.Join(err, services.components.Stop(), controlService.Close())
	}
	services.watch(services.relays.Errors())
	if err := services.components.WaitForLifecycleSockets(platformComponentSocketTimeout); err != nil {
		return nil, services.shutdown(err)
	}
	return services, nil
}

func (services *guestServices) watch(failures <-chan error) {
	go func() {
		select {
		case err := <-failures:
			services.failures <- err
			services.cancel(err)
		case <-services.ctx.Done():
		}
	}()
}

func (services *guestServices) prepareWorkload(
	bootStarted time.Time,
	cfg *Config,
	store *guestconfig.Store,
) (*pendingWorkloadInitialization, error) {
	var pendingInitialization *pendingWorkloadInitialization
	if cfg.DeferredWorkload {
		initialization, err := waitForWorkloadInitialization(services.ctx)
		if err != nil {
			return nil, fmt.Errorf("wait for workload initialization: %w", err)
		}
		applyDeferredWorkloadConfiguration(cfg, initialization.request, store.Snapshot())
		pendingInitialization = &initialization
	}
	if err := ensureWorkloadUser(cfg.OSUser, systemAccountFiles()); err != nil {
		return nil, fmt.Errorf("provision workload user: %w", err)
	}
	phaseStarted := time.Now()
	err := services.components.DeliverWorkload(services.ctx, cfg)
	logBootMilestone(bootStarted, phaseStarted, bootPhaseComponentInput, err)
	if err != nil {
		return nil, err
	}
	return pendingInitialization, nil
}

func (services *guestServices) shutdown(cause error) error {
	services.cancel(cause)
	return errors.Join(cause, services.relays.Close(), services.components.Stop(), services.control.Close())
}

func (services *guestServices) close(runErr error) error {
	services.cancel(nil)
	relayShutdownErr := services.relays.Close()
	componentShutdownErr := services.components.Stop()
	shutdownErr := services.control.Close()
	select {
	case err := <-services.failures:
		runErr = errors.Join(runErr, err)
	default:
	}
	return errors.Join(runErr, relayShutdownErr, componentShutdownErr, shutdownErr)
}

func runSandboxLifecycle(
	ctx context.Context,
	cfg *Config,
	pendingInitialization *pendingWorkloadInitialization,
	children *childReaper,
	bootStarted time.Time,
	phaseStarted time.Time,
) (int, bool, error) {
	if cfg.DeferredWorkload {
		return runDeferredWorkload(ctx, cfg, pendingInitialization, children, bootStarted, phaseStarted)
	}
	secretEnv, err := waitForSecretEnvironment(ctx, cfg)
	if err != nil {
		return 0, false, err
	}
	workloadEnv := buildWorkloadEnv(cfg, secretEnv)
	if err := setProcessEnv(workloadEnv); err != nil {
		return 0, false, err
	}

	return runConfiguredWorkload(ctx, cfg, workloadEnv, children, bootStarted, phaseStarted)
}

func runDeferredWorkload(
	ctx context.Context,
	cfg *Config,
	pendingInitialization *pendingWorkloadInitialization,
	children *childReaper,
	bootStarted time.Time,
	phaseStarted time.Time,
) (int, bool, error) {
	if pendingInitialization == nil {
		return 0, false, errors.New("deferred workload initialization is required")
	}
	workloadEnv := buildWorkloadEnv(cfg, pendingInitialization.request.SecretEnv)
	if err := setProcessEnv(workloadEnv); err != nil {
		return 0, false, err
	}
	workload, err := startConfiguredWorkload(ctx, cfg, workloadEnv)
	if err != nil {
		return 0, false, err
	}
	if err := acknowledgeWorkloadStarted(cfg); err != nil {
		return 0, workload != nil, errors.Join(err, terminateCommand(children, workload, "workload"))
	}
	if err := acknowledgeWorkloadInitialization(pendingInitialization.digest); err != nil {
		return 0, workload != nil, errors.Join(err, terminateCommand(children, workload, "workload"))
	}
	logBootMilestone(bootStarted, phaseStarted, bootPhaseWorkload, nil)
	return finishConfiguredWorkload(ctx, children, workload)
}

func applyDeferredWorkloadConfiguration(
	cfg *Config,
	initialization control.InitializeWorkloadRequest,
	restoredGuest guestconfig.Config,
) {
	cfg.Env = mergeEnvironment(cfg.Env, initialization.Env)
	cfg.Entrypoint = append([]string(nil), initialization.Entrypoint...)
	cfg.Cmd = nil
	cfg.OSUser = initialization.OSUser
	cfg.GuestInit = restoredGuest
	cfg.GuestInit.InstanceID = initialization.InstanceID
	cfg.GuestInit.GenerationID = initialization.GenerationID
}

func waitForShutdown(ctx context.Context) error {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGHUP, syscall.SIGQUIT, syscall.SIGINT)
	defer signal.Stop(sigCh)
	select {
	case <-sigCh:
		return nil
	case <-ctx.Done():
		return context.Cause(ctx)
	}
}

func Poweroff(code int) {
	syscall.Sync()
	if err := syscall.Reboot(syscall.LINUX_REBOOT_CMD_POWER_OFF); err != nil {
		Log("poweroff failed: %v", err)
	}
	os.Exit(code)
}
