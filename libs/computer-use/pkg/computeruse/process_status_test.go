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

import (
	"testing"
	"time"

	"github.com/snapflowio/computer-use/plugin"
)

func computerUseWithAccessibility(available bool) *ComputerUse {
	return &ComputerUse{
		processes:           map[string]*Process{},
		a11yStatusRunning:   available,
		a11yStatusCheckedAt: time.Now(),
	}
}

func TestProcessStatusReportsTheSessionAccessibilityBus(t *testing.T) {
	for _, available := range []bool{true, false} {
		status, err := computerUseWithAccessibility(available).GetProcessStatus()
		if err != nil {
			t.Fatalf("GetProcessStatus() error = %v", err)
		}
		bus, exists := status[accessibilityBusName]
		if !exists {
			t.Fatalf("GetProcessStatus() has no %s entry: %v", accessibilityBusName, status)
		}
		if bus.Running != available || bus.Pid != nil || bus.AutoRestart {
			t.Fatalf("%s status = %+v, want running=%t without a supervised process", accessibilityBusName, bus, available)
		}
	}
}

func TestIsProcessRunningProbesTheAccessibilityBus(t *testing.T) {
	running, err := computerUseWithAccessibility(true).IsProcessRunning(
		&plugin.ProcessRequest{ProcessName: accessibilityBusName},
	)
	if err != nil || !running {
		t.Fatalf("IsProcessRunning(%s) = %t, %v; want true, nil", accessibilityBusName, running, err)
	}
}

func TestAccessibilityBusIsNotASupervisedProcess(t *testing.T) {
	request := &plugin.ProcessRequest{ProcessName: accessibilityBusName}
	if _, err := computerUseWithAccessibility(true).RestartProcess(request); err == nil {
		t.Fatalf("RestartProcess(%s) succeeded; the desktop session owns the bus", accessibilityBusName)
	}
}
