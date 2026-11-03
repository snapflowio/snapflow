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

import "testing"

func TestParseDBusEnvironmentReadsAddressAndPID(t *testing.T) {
	output := "DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/dbus-1,guid=abc;\nexport DBUS_SESSION_BUS_ADDRESS;\nDBUS_SESSION_BUS_PID=4242;\nOTHER=1\n"
	environment := parseDBusEnvironment(output)
	if environment[dbusAddressEnvironment] != "unix:path=/tmp/dbus-1,guid=abc" || environment[dbusPIDEnvironment] != "4242" || len(environment) != 2 {
		t.Fatalf("parseDBusEnvironment() = %v", environment)
	}
}

func TestStartRequiresInitialize(t *testing.T) {
	if _, err := new(ComputerUse).Start(); err == nil {
		t.Fatal("Start() ran before Initialize()")
	}
}
