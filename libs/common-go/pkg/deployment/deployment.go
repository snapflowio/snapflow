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

package deployment

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"slices"
	"strings"
)

type Profile string

const (
	Development Profile = "development"
	Production  Profile = "production"
)

const ProfileFlag = "profile"

const profileFlagUsage = "deployment profile: development or production"

const (
	DevelopmentWorkspaceRoot = "/workspaces/snapflow"
	DevelopmentStateRoot     = DevelopmentWorkspaceRoot + "/.tmp"
)

var ErrUnknownProfile = errors.New("profile must be development or production")

func ParseProfile(value string) (Profile, error) {
	profile := Profile(strings.TrimSpace(value))
	switch profile {
	case Development, Production:
		return profile, nil
	default:
		return "", fmt.Errorf("%w: %q", ErrUnknownProfile, value)
	}
}

func NewFlagSet(command string) *flag.FlagSet {
	flags := flag.NewFlagSet(command, flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	return flags
}

func ParseArguments(flags *flag.FlagSet, arguments []string) (Profile, error) {
	name := flags.String(ProfileFlag, string(Production), profileFlagUsage)
	if err := flags.Parse(arguments); err != nil {
		return "", fmt.Errorf("parse %s arguments: %w", flags.Name(), err)
	}
	if flags.NArg() != 0 {
		return "", fmt.Errorf("%s accepts no positional arguments, got %q", flags.Name(), flags.Args())
	}
	return ParseProfile(*name)
}

func RejectUnknownEnvironment(prefix string, known []string) error {
	for _, entry := range os.Environ() {
		name, _, found := strings.Cut(entry, "=")
		if found && strings.HasPrefix(name, prefix) && !slices.Contains(known, name) {
			return fmt.Errorf("unknown environment variable %q", name)
		}
	}
	return nil
}

func EnvironmentOr(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
