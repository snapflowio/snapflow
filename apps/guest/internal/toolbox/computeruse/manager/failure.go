// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package manager

import (
	"fmt"
	"strings"
)

const (
	failureDependency = "dependency"
	failureSystem     = "system"
	failurePlugin     = "plugin"
)

type Failure struct {
	Kind    string
	Message string
	Output  string
}

func (f *Failure) Error() string {
	return fmt.Sprintf("%s failure: %s: %s", f.Kind, f.Message, f.Output)
}

type runtimeLibrary struct {
	soname string
	name   string
}

func x11RuntimeLibraries() []runtimeLibrary {
	return []runtimeLibrary{
		{soname: "libX11.so.6", name: "libX11"},
		{soname: "libXext.so.6", name: "libXext"},
		{soname: "libXtst.so.6", name: "libXtst"},
		{soname: "libXrandr.so.2", name: "libXrandr"},
		{soname: "libXrender.so.1", name: "libXrender"},
		{soname: "libXfixes.so.3", name: "libXfixes"},
		{soname: "libXss.so.1", name: "libXScrnSaver"},
		{soname: "libXi.so.6", name: "libXi"},
		{soname: "libXinerama.so.1", name: "libXinerama"},
	}
}

type failureRule struct {
	kind    string
	message string
	markers []string
}

func failureRules() []failureRule {
	return []failureRule{
		{kind: failureSystem, message: "the plugin is not executable", markers: []string{"Permission denied", "not executable", "EACCES"}},
		{kind: failureSystem, message: "the plugin was built for a different architecture", markers: []string{"wrong ELF class", "architecture", "ELF", "exec format error"}},
		{kind: failureSystem, message: "the plugin is missing basic system libraries", markers: []string{"libc.so", "libm.so", "libdl.so", "libpthread.so"}},
		{kind: failureSystem, message: "the plugin file could not be found", markers: []string{"No such file or directory", "ENOENT"}},
		{kind: failurePlugin, message: "the plugin hit a Go runtime error", markers: []string{"go:", "runtime:", "panic:"}},
	}
}

func classifyFailure(output string, exitCode int, cause error) *Failure {
	if missing := missingX11Libraries(output); len(missing) > 0 {
		return &Failure{
			Kind:    failureDependency,
			Message: "the desktop-extension release lacks X11 runtime libraries: " + strings.Join(missing, ", "),
			Output:  output,
		}
	}
	for _, rule := range failureRules() {
		if containsAny(output, rule.markers) {
			return &Failure{Kind: rule.kind, Message: rule.message, Output: output}
		}
	}
	return &Failure{
		Kind:    failurePlugin,
		Message: fmt.Sprintf("the plugin exited with code %d: %v", exitCode, cause),
		Output:  output,
	}
}

func missingX11Libraries(output string) []string {
	var missing []string
	for _, library := range x11RuntimeLibraries() {
		if strings.Contains(output, library.soname) {
			missing = append(missing, library.name)
		}
	}
	return missing
}

func containsAny(output string, markers []string) bool {
	for _, marker := range markers {
		if strings.Contains(output, marker) {
			return true
		}
	}
	return false
}
