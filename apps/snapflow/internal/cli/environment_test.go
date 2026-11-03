// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package cli

import (
	"testing"

	"github.com/spf13/cobra"
)

func TestEnvironmentName(t *testing.T) {
	if got := EnvironmentName("api-url"); got != "SNAPFLOW_API_URL" {
		t.Fatalf("EnvironmentName() = %q", got)
	}
}

func TestBindEnvironmentFillsOnlyUnsetFlags(t *testing.T) {
	command := &cobra.Command{Use: "setup"}
	organization, name := "", ""
	command.Flags().StringVar(&organization, "organization", "", "")
	command.Flags().StringVar(&name, "name", "", "")
	if err := command.Flags().Parse([]string{"--name", "flag"}); err != nil {
		t.Fatal(err)
	}
	environment := map[string]string{"SNAPFLOW_ORGANIZATION": "acme", "SNAPFLOW_NAME": "environment"}
	lookup := func(key string) (string, bool) {
		value, found := environment[key]
		return value, found
	}
	if err := BindEnvironment(command, lookup); err != nil {
		t.Fatal(err)
	}
	if organization != "acme" || name != "flag" {
		t.Fatalf("organization = %q, name = %q; want the variable to fill only the unset flag", organization, name)
	}
}

func TestBindEnvironmentReportsInvalidValues(t *testing.T) {
	command := &cobra.Command{Use: "setup"}
	yes := false
	command.Flags().BoolVar(&yes, "yes", false, "")
	lookup := func(string) (string, bool) { return "certainly", true }
	if err := BindEnvironment(command, lookup); err == nil {
		t.Fatal("an invalid SNAPFLOW_YES was accepted")
	}
}

func TestBindEnvironmentTreatsEmptyVariablesAsUnset(t *testing.T) {
	command := &cobra.Command{Use: "login"}
	const defaultProfile = "production"
	profile, ephemeral := "", true
	command.Flags().StringVar(&profile, "profile", defaultProfile, "")
	command.Flags().BoolVar(&ephemeral, "ephemeral", true, "")
	environment := map[string]string{"SNAPFLOW_PROFILE": "", "SNAPFLOW_EPHEMERAL": " "}
	lookup := func(key string) (string, bool) {
		value, found := environment[key]
		return value, found
	}
	if err := BindEnvironment(command, lookup); err != nil {
		t.Fatalf("empty variables rejected: %v", err)
	}
	if profile != defaultProfile || !ephemeral {
		t.Fatalf("profile = %q, ephemeral = %t; want the flag defaults", profile, ephemeral)
	}
}
