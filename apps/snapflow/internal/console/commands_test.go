// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"bytes"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/spf13/cobra"
)

const rootUserID = 0

func testRoot(output *bytes.Buffer, arguments ...string) *cobra.Command {
	root := newRootCommand(New(Config{In: strings.NewReader(""), Out: output, Err: output}))
	root.SetArgs(arguments)
	return root
}

func TestMachineCommandsAreExposedAtTheTopLevel(t *testing.T) {
	var output bytes.Buffer
	names := []string{}
	for _, command := range testRoot(&output).Commands() {
		names = append(names, command.Name())
	}
	for _, want := range []string{
		"setup", "status", "doctor", "logs", "start", "stop",
		"update", "rollback", "uninstall", "benchmark", "release",
	} {
		if !slices.Contains(names, want) {
			t.Errorf("top-level commands %v do not include %s", names, want)
		}
	}
	if slices.Contains(names, machineGroupUse) {
		t.Errorf("the %s group should not be exposed while its commands are top level", machineGroupUse)
	}
}

func TestHelpGroupsCommands(t *testing.T) {
	var output bytes.Buffer
	if err := testRoot(&output, "--help").Execute(); err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{text.GroupStartTitle, text.GroupOperateTitle, text.GroupMaintainTitle, "sudo snapflow setup"} {
		if !strings.Contains(output.String(), want) {
			t.Errorf("help does not contain %q:\n%s", want, output.String())
		}
	}
}

func TestSetupHasAFlagForEveryPrompt(t *testing.T) {
	var output bytes.Buffer
	setup, arguments, err := testRoot(&output).Find([]string{"setup"})
	if err != nil || len(arguments) != 0 {
		t.Fatalf("find setup: %v %v", arguments, err)
	}
	for _, flag := range []string{
		cli.ProfileFlag, yesFlag, jsonFlag, apiURLFlag, nameFlag, organizationFlag, replaceFlag,
	} {
		if setup.Flags().Lookup(flag) == nil {
			t.Errorf("setup has no --%s flag", flag)
		}
	}
}

func TestRootOnlyCommandsExplainSudo(t *testing.T) {
	if os.Geteuid() == rootUserID {
		t.Skip("the sudo explanation is only shown to other users")
	}
	var output bytes.Buffer
	err := testRoot(&output, "setup", "--name", "rack-04").Execute()
	message, hint, show := cli.Report(err)
	if cli.ExitCode(err) != cli.ExitPermissionDenied || !show || hint != text.SudoHint("snapflow setup --name=rack-04") {
		t.Fatalf("error = %v (message %q, hint %q)", err, message, hint)
	}
}

func TestUsageErrorsPointAtHelp(t *testing.T) {
	var output bytes.Buffer
	err := testRoot(&output, "status", "--bogus").Execute()
	message, hint, show := cli.Report(err)
	if cli.ExitCode(err) != cli.ExitConfigurationError || !show || hint != text.HelpHint("snapflow status") {
		t.Fatalf("error = %v (message %q, hint %q)", err, message, hint)
	}
}

func TestEveryCommandOffersJSON(t *testing.T) {
	var output bytes.Buffer
	for _, path := range [][]string{
		{"setup"},
		{"status"},
		{"doctor"},
		{"logs"},
		{"start"},
		{"stop"},
		{"update"},
		{"rollback"},
		{"uninstall"},
		{"benchmark"},
		{"release", "verify"},
		{"release", "status"},
		{"release", "gc"},
	} {
		command, arguments, err := testRoot(&output).Find(path)
		if err != nil || len(arguments) != 0 {
			t.Fatalf("find %v: %v %v", path, arguments, err)
		}
		if command.Flags().Lookup(jsonFlag) == nil {
			t.Errorf("%s has no --%s flag", command.CommandPath(), jsonFlag)
		}
	}
}

func TestDestructiveCommandsConfirmWithYes(t *testing.T) {
	var output bytes.Buffer
	for _, path := range [][]string{{"update"}, {"rollback"}, {"uninstall"}} {
		command, arguments, err := testRoot(&output).Find(path)
		if err != nil || len(arguments) != 0 {
			t.Fatalf("find %v: %v %v", path, arguments, err)
		}
		if command.Flags().Lookup(yesFlag) == nil {
			t.Errorf("%s has no --%s flag", command.CommandPath(), yesFlag)
		}
	}
}

func TestDevelopmentOnlyCommandsAreHidden(t *testing.T) {
	var output bytes.Buffer
	for _, path := range [][]string{{"release", "install"}, {"release", "reset"}} {
		command, arguments, err := testRoot(&output).Find(path)
		if err != nil || len(arguments) != 0 {
			t.Fatalf("find %v: %v %v", path, arguments, err)
		}
		if !command.Hidden {
			t.Errorf("%s should be hidden from help", command.CommandPath())
		}
	}
}
