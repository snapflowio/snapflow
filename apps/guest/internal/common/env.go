// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package common

import (
	"fmt"
	"os"
	"os/exec"
	"regexp"
)

var validEnvKeyPattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func ValidateEnvKeys(envs map[string]string) error {
	for key := range envs {
		if !validEnvKeyPattern.MatchString(key) {
			return fmt.Errorf("invalid environment variable name: '%s'", key)
		}
	}
	return nil
}

func ApplyEnvs(cmd *exec.Cmd, envs map[string]string) {
	if len(envs) == 0 {
		return
	}
	pairs := make([]string, 0, len(envs))
	for key, value := range envs {
		pairs = append(pairs, fmt.Sprintf("%s=%s", key, value))
	}
	cmd.Env = append(os.Environ(), pairs...)
}
