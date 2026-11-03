// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"strconv"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

const (
	noColorFlag         = "no-color"
	boolFlagType        = "bool"
	boolTrue            = "true"
	flagPrefix          = "--"
	flagValueSeparator  = "="
	shellSafeCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._/:@,+-"
)

func invocation(command *cobra.Command) string {
	parts := []string{command.CommandPath()}
	command.Flags().Visit(func(flag *pflag.Flag) {
		if flag.Value.Type() == boolFlagType && flag.Value.String() == boolTrue {
			parts = append(parts, flagPrefix+flag.Name)
			return
		}
		parts = append(parts, flagPrefix+flag.Name+flagValueSeparator+shellWord(flag.Value.String()))
	})
	return strings.Join(parts, " ")
}

func shellWord(value string) string {
	if value != "" && strings.Trim(value, shellSafeCharacters) == "" {
		return value
	}
	return strconv.Quote(value)
}
