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
	"fmt"
	"os"
	"sort"
	"strings"
)

func buildWorkloadEnv(cfg *Config, secretEnv map[string]string) []string {
	env := map[string]string{
		"HOME":                 "/root",
		"PATH":                 "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
		"SNAPFLOW_PROJECT_DIR": cfg.Workdir,
	}
	for key, value := range cfg.Env {
		if strings.TrimSpace(key) == "" || strings.Contains(key, "=") {
			continue
		}
		env[key] = value
	}
	for key, value := range secretEnv {
		env[key] = value
	}

	return environmentEntries(env)
}

func buildGuestEnv(runtimeEnv map[string]string) []string {
	env := map[string]string{
		"HOME": "/root",
		"PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
	}
	for key, value := range runtimeEnv {
		if strings.TrimSpace(key) == "" || strings.Contains(key, "=") {
			continue
		}
		env[key] = value
	}
	return environmentEntries(env)
}

func environmentEntries(env map[string]string) []string {
	keys := make([]string, 0, len(env))
	for key := range env {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	entries := make([]string, 0, len(keys))
	for _, key := range keys {
		entries = append(entries, fmt.Sprintf("%s=%s", key, env[key]))
	}
	return entries
}

func commandArgs(cfg *Config) []string {
	args := append([]string(nil), cfg.Entrypoint...)
	args = append(args, cfg.Cmd...)
	for i := range args {
		args[i] = strings.TrimSpace(args[i])
	}
	return compact(args)
}

func compact(values []string) []string {
	out := values[:0]
	for _, value := range values {
		if value != "" {
			out = append(out, value)
		}
	}
	return out
}

func setProcessEnv(env []string) error {
	os.Clearenv()
	for _, value := range env {
		if name, setting, found := strings.Cut(value, "="); found {
			if err := os.Setenv(name, setting); err != nil {
				return fmt.Errorf("set process environment variable %q: %w", name, err)
			}
		}
	}
	return nil
}
