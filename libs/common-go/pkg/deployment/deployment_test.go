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
	"testing"
)

const (
	testCommand        = "service"
	testPrefix         = "SNAPFLOW_TEST_SERVICE_"
	testKnownVariable  = testPrefix + "KNOWN"
	testStaleVariable  = testPrefix + "STALE"
	testVariableValue  = "value"
	testUnknownProfile = "staging"
	testCallerFlag     = "caller-flag"
)

func TestParseArgumentsDefaultsToProduction(t *testing.T) {
	t.Parallel()
	profile, err := ParseArguments(NewFlagSet(testCommand), nil)
	if err != nil || profile != Production {
		t.Fatalf("ParseArguments() = %q, %v; want %q", profile, err, Production)
	}
}

func TestParseArgumentsSelectsProfile(t *testing.T) {
	t.Parallel()
	profile, err := ParseArguments(NewFlagSet(testCommand), []string{"--" + ProfileFlag, string(Development)})
	if err != nil || profile != Development {
		t.Fatalf("ParseArguments() = %q, %v; want %q", profile, err, Development)
	}
}

func TestParseArgumentsParsesCallerFlags(t *testing.T) {
	t.Parallel()
	flags := NewFlagSet(testCommand)
	enabled := flags.Bool(testCallerFlag, false, testCallerFlag)
	profile, err := ParseArguments(flags, []string{"--" + testCallerFlag})
	if err != nil || profile != Production || !*enabled {
		t.Fatalf("ParseArguments() = %q, %v, %s=%t; want %q and true", profile, err, testCallerFlag, *enabled, Production)
	}
}

func TestParseArgumentsRejectsInvalidInput(t *testing.T) {
	t.Parallel()
	for name, arguments := range map[string][]string{
		"unknown profile":     {"--" + ProfileFlag, testUnknownProfile},
		"positional argument": {testVariableValue},
		"unknown flag":        {"--" + testVariableValue},
	} {
		if profile, err := ParseArguments(NewFlagSet(testCommand), arguments); err == nil {
			t.Fatalf("%s: ParseArguments() = %q, want an error", name, profile)
		}
	}
	if _, err := ParseProfile(testUnknownProfile); !errors.Is(err, ErrUnknownProfile) {
		t.Fatalf("ParseProfile() error = %v, want %v", err, ErrUnknownProfile)
	}
}

func TestRejectUnknownEnvironment(t *testing.T) {
	t.Setenv(testKnownVariable, testVariableValue)
	known := []string{testKnownVariable}
	if err := RejectUnknownEnvironment(testPrefix, known); err != nil {
		t.Fatalf("known variable rejected: %v", err)
	}
	t.Setenv(testStaleVariable, testVariableValue)
	if err := RejectUnknownEnvironment(testPrefix, known); err == nil {
		t.Fatal("unknown variable accepted")
	}
}
