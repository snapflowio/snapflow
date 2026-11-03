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
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/pelletier/go-toml/v2"
	"github.com/snapflowio/microvm-go/guest"
	guestconfig "github.com/snapflowio/microvm-go/guest/config"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/filewait"
	"github.com/snapflowio/microvm-go/internal/guest/control"
)

const platformComponentSocketTimeout = 5 * time.Second

func installInjectedFile(cfg *Config, content []byte) error {
	if cfg.InjectedFilePath == "" {
		return nil
	}
	target, err := pathInNewRoot(cfg.InjectedFilePath)
	if err != nil {
		return fmt.Errorf("resolve injected file destination: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(target), filemode.PrivateDirectory); err != nil {
		return fmt.Errorf("create injected file destination: %w", err)
	}
	if err := os.WriteFile(target, content, filemode.PrivateFile); err != nil {
		return fmt.Errorf("install injected file: %w", err)
	}
	return nil
}

func writeGuestInitConfig(cfg *Config) error {
	if cfg.GuestInit.ProjectDir == "" {
		cfg.GuestInit.ProjectDir = cfg.Workdir
	}
	if cfg.GuestInit.LogLevel == "" {
		cfg.GuestInit.LogLevel = guestconfig.DefaultLogLevel
	}
	if cfg.GuestInit.LogFilePath == "" {
		cfg.GuestInit.LogFilePath = guestconfig.DefaultLogFilePath
	}
	if err := cfg.GuestInit.Validate(); err != nil {
		return fmt.Errorf("validate guest init config: %w", err)
	}
	data, err := toml.Marshal(cfg.GuestInit)
	if err != nil {
		return fmt.Errorf("encode guest init config: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(guestconfig.DefaultConfigPath), filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create guest init config directory: %w", err)
	}
	if err := os.WriteFile(guestconfig.DefaultConfigPath, data, filemode.PrivateFile); err != nil {
		return fmt.Errorf("write guest init config: %w", err)
	}
	return nil
}

type runningPlatformComponent struct {
	manifest guest.Manifest
	process  *processSupervisor
	mu       sync.Mutex
	workload *guest.Workload
}

type runningPlatformComponents struct {
	components []*runningPlatformComponent
}

func startPlatformComponents(cfg *Config, children *childReaper) (*runningPlatformComponents, error) {
	manifests := platformComponents(cfg)
	running := &runningPlatformComponents{components: make([]*runningPlatformComponent, 0, len(manifests))}
	for _, manifest := range manifests {
		if !manifest.Activation.StartsAutomatically() {
			continue
		}
		if err := writeServiceCredentials(cfg, manifest); err != nil {
			return nil, errors.Join(
				fmt.Errorf("configure platform component %q credentials: %w", manifest.Name, err),
				running.Stop(),
			)
		}
		environment := buildGuestEnv(nil)
		for key, value := range manifest.Env {
			environment = append(environment, key+"="+value)
		}
		component := &runningPlatformComponent{manifest: manifest}
		process, err := startProcessSupervisor(processSpec{
			name:         "platform component " + manifest.Name,
			path:         manifest.GuestPath,
			args:         manifest.Args,
			env:          environment,
			afterRestart: component.redeliverWorkload,
		}, children)
		if err != nil {
			return nil, errors.Join(
				fmt.Errorf("start platform component %q: %w", manifest.Name, err),
				running.Stop(),
			)
		}
		component.process = process
		running.components = append(running.components, component)
	}
	return running, nil
}

func (r *runningPlatformComponents) WaitForLifecycleSockets(timeout time.Duration) error {
	for _, component := range r.components {
		if err := waitForPath(component.manifest.LifecycleSocket, timeout); err != nil {
			return fmt.Errorf("wait for platform component %q lifecycle socket: %w", component.manifest.Name, err)
		}
	}
	return nil
}

func (r *runningPlatformComponents) DeliverWorkload(ctx context.Context, cfg *Config) error {
	for _, component := range r.components {
		workload, err := platformComponentWorkload(cfg, component.manifest)
		if err != nil {
			return fmt.Errorf("configure platform component %q workload: %w", component.manifest.Name, err)
		}
		if err := component.deliverWorkload(ctx, workload); err != nil {
			return err
		}
	}
	return nil
}

func (r *runningPlatformComponents) Stop() error {
	if r == nil {
		return nil
	}
	processes := make([]*processSupervisor, 0, len(r.components))
	for _, component := range r.components {
		processes = append(processes, component.process)
	}
	return stopSupervisedProcesses(processes)
}

func (c *runningPlatformComponent) deliverWorkload(ctx context.Context, workload guest.Workload) error {
	c.mu.Lock()
	c.workload = &workload
	c.mu.Unlock()
	return c.notifyWorkload(ctx, workload)
}

func (c *runningPlatformComponent) redeliverWorkload(ctx context.Context) error {
	waitContext, cancel := context.WithTimeout(ctx, platformComponentSocketTimeout)
	defer cancel()
	if err := filewait.Exists(waitContext, c.manifest.LifecycleSocket); err != nil {
		return fmt.Errorf("wait for restarted platform component %q lifecycle socket: %w", c.manifest.Name, err)
	}
	c.mu.Lock()
	workload := c.workload
	c.mu.Unlock()
	if workload == nil {
		return nil
	}
	return c.notifyWorkload(ctx, *workload)
}

func (c *runningPlatformComponent) notifyWorkload(ctx context.Context, workload guest.Workload) error {
	hook := guest.LifecycleHook{Name: c.manifest.Name, SocketPath: c.manifest.LifecycleSocket, Operations: guest.LifecycleOperationsFor(c.manifest)}
	if err := control.NotifyComponent(ctx, hook, guest.LifecycleOperationWorkload, workload); err != nil {
		return fmt.Errorf("deliver workload to platform component %q: %w", c.manifest.Name, err)
	}
	return nil
}

func platformComponentWorkload(cfg *Config, manifest guest.Manifest) (guest.Workload, error) {
	env := make(map[string]string, len(cfg.Env)+len(manifest.EnvSources))
	for key, value := range cfg.Env {
		if strings.TrimSpace(key) == "" || strings.Contains(key, "=") {
			continue
		}
		env[key] = value
	}
	for name, source := range manifest.EnvSources {
		switch source {
		case guest.EnvironmentSourceSandboxWorkdir:
			env[name] = cfg.Workdir
		case guest.EnvironmentSourceSandboxOSUser:
			env[name] = cfg.OSUser
		default:
			return guest.Workload{}, fmt.Errorf("unsupported environment source %q", source)
		}
	}
	return guest.Workload{Env: env}, nil
}

func writeServiceCredentials(cfg *Config, manifest guest.Manifest) error {
	if err := os.MkdirAll(guest.ServiceCredentialRoot, filemode.PrivateDirectory); err != nil {
		return fmt.Errorf("create guest service credential directory: %w", err)
	}
	for _, service := range manifest.Services {
		if !service.Credential {
			continue
		}
		token := strings.TrimSpace(cfg.GuestInit.GuestServiceTokens[service.Name])
		if token == "" {
			return fmt.Errorf("credential for service %q is missing", service.Name)
		}
		if err := os.WriteFile(guest.ServiceCredentialPath(service.Name), []byte(token+"\n"), filemode.OwnerReadOnlyFile); err != nil {
			return fmt.Errorf("write credential for service %q: %w", service.Name, err)
		}
	}
	return nil
}

func platformComponents(cfg *Config) []guest.Manifest {
	var components []guest.Manifest
	for _, bundle := range cfg.PlatformBundles {
		components = append(components, bundle.Components...)
	}
	return components
}

func stopSupervisedProcesses(processes []*processSupervisor) error {
	var shutdownErr error
	for index := len(processes) - 1; index >= 0; index-- {
		process := processes[index]
		if process == nil {
			continue
		}
		if err := process.Stop(); err != nil {
			Log("supervised process shutdown failed: %v", err)
			shutdownErr = errors.Join(shutdownErr, err)
		}
	}
	return shutdownErr
}
