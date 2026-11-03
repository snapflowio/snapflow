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

package computeruse

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/guestspec"
)

const (
	computerProcessReadyTimeout = 30 * time.Second
	computerProcessPollInterval = 100 * time.Millisecond
	computerProbeDialTimeout    = 250 * time.Millisecond
	computerProcessRestartDelay = 5 * time.Second
	computerProcessStopTimeout  = 5 * time.Second
	computerProcessKillTimeout  = 2 * time.Second
	kasmWebRoot                 = "/usr/share/kasmvnc/www"
	kasmWebClientEntryPoint     = "index.html"
	kasmExecutableName          = "Xkasmvnc"
	displayEnvironment          = "DISPLAY"
	sandboxUserEnvironment      = "SNAPFLOW_SANDBOX_USER"
	defaultDesktopDisplay       = ":0"
	desktopResolution           = "1024x768"
	kasmProcessName             = "kasmvnc"
	desktopProcessName          = "xfce4"
	desktopSessionCommand       = "/usr/bin/startxfce4"
	desktopColorDepth           = "24"
	kasmPriority                = 100
	desktopPriority             = 200
	logSuffix                   = ".log"
	errorSuffix                 = ".err"
	homeEnvironment             = "HOME"
	userEnvironment             = "USER"
	desktopPublicIP             = "127.0.0.1"
	desktopLoopbackInterface    = "127.0.0.1"
	defaultSandboxUser          = "root"
)

func requiredDesktopProcesses() []string {
	return []string{kasmProcessName, desktopProcessName}
}

func desktopProcesses(homeDir, configDir string) (map[string]*Process, error) {
	display := environmentOrDefault(displayEnvironment, defaultDesktopDisplay)
	user := environmentOrDefault(sandboxUserEnvironment, defaultSandboxUser)
	kasmVNCPath, err := findKasmVNC(kasmWebRoot)
	if err != nil {
		return nil, fmt.Errorf("KasmVNC desktop is required: %w", err)
	}
	kasmPassword, err := newKasmPasswordSync(kasmPasswordSyncConfig{Source: hostDesktopCredential(), ConfigDir: configDir})
	if err != nil {
		return nil, fmt.Errorf("provision KasmVNC password file: %w", err)
	}
	desktopWebPort := strconv.Itoa(guestspec.DesktopPort)
	processes := map[string]*Process{}
	processes[kasmProcessName] = &Process{
		Name:    kasmProcessName,
		Command: kasmVNCPath,
		Args: []string{
			display,
			"-geometry", desktopResolution,
			"-depth", desktopColorDepth,
			"-interface", desktopLoopbackInterface,
			"-websocketPort", desktopWebPort,
			"-httpd", kasmWebRoot,
			"-publicIP", desktopPublicIP,
			"-KasmPasswordFile", kasmPassword.PasswordFile(),
			"-SecurityTypes", "None",
		},
		Priority:    kasmPriority,
		AutoRestart: true,
		Required:    true,
		Ready:       httpReadyProbe(desktopWebPort, kasmPassword.Credential),
		Env: map[string]string{
			displayEnvironment: display,
			homeEnvironment:    homeDir,
			userEnvironment:    user,
		},
		LogFile: filepath.Join(configDir, kasmProcessName+logSuffix),
		ErrFile: filepath.Join(configDir, kasmProcessName+errorSuffix),
	}
	processes[desktopProcessName] = &Process{
		Name:        desktopProcessName,
		Command:     desktopSessionCommand,
		Priority:    desktopPriority,
		AutoRestart: true,
		Required:    true,
		Ready:       desktopSessionReady,
		Env: map[string]string{
			displayEnvironment: display,
			homeEnvironment:    homeDir,
			userEnvironment:    user,
		},
		LogFile: filepath.Join(configDir, desktopProcessName+logSuffix),
		ErrFile: filepath.Join(configDir, desktopProcessName+errorSuffix),
	}
	slog.Info("Using KasmVNC browser desktop", "command", kasmVNCPath, "websocket_port", desktopWebPort)
	return processes, nil
}

func findKasmVNC(webRoot string) (string, error) {
	info, err := os.Stat(webRoot)
	if err != nil {
		return "", fmt.Errorf("inspect KasmVNC web root: %w", err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("KasmVNC web root %s is not a directory", webRoot)
	}
	entryPoint := filepath.Join(webRoot, kasmWebClientEntryPoint)
	entryPointInfo, err := os.Stat(entryPoint)
	if err != nil {
		return "", fmt.Errorf("inspect KasmVNC web client entry point: %w", err)
	}
	if !entryPointInfo.Mode().IsRegular() {
		return "", fmt.Errorf("KasmVNC web client entry point %s is not a regular file", entryPoint)
	}
	path, err := exec.LookPath(kasmExecutableName)
	if err != nil {
		return "", fmt.Errorf("find KasmVNC executable: %w", err)
	}
	return path, nil
}

func environmentOrDefault(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}
