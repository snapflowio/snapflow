// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package cli

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

const (
	environmentPrefix     = "SNAPFLOW_"
	environmentAnnotation = "snapflow-environment"
)

func EnvironmentName(flag string) string {
	return environmentPrefix + strings.ToUpper(strings.ReplaceAll(flag, "-", "_"))
}

func SetEnvironmentName(command *cobra.Command, flag, name string) {
	if err := command.Flags().SetAnnotation(flag, environmentAnnotation, []string{name}); err != nil {
		panic(err)
	}
}

func flagEnvironmentName(flag *pflag.Flag) string {
	if names := flag.Annotations[environmentAnnotation]; len(names) == 1 {
		return names[0]
	}
	return EnvironmentName(flag.Name)
}

func BindEnvironment(command *cobra.Command, lookup func(string) (string, bool)) error {
	var bindErr error
	command.Flags().VisitAll(func(flag *pflag.Flag) {
		if bindErr != nil || flag.Changed {
			return
		}
		name := flagEnvironmentName(flag)
		value, found := lookup(name)
		if !found || strings.TrimSpace(value) == "" {
			return
		}
		if err := command.Flags().Set(flag.Name, value); err != nil {
			bindErr = fmt.Errorf("invalid %s: %w", name, err)
		}
	})
	return bindErr
}
