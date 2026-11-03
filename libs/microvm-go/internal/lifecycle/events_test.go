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

package lifecycle

import (
	"testing"
)

func TestEventBusDeliversPublishedEvents(t *testing.T) {
	bus := NewEventBus(1)
	events, unsubscribe := bus.Subscribe()
	defer unsubscribe()

	bus.Publish(Event{
		InstanceID: "instance",
		Operation:  OperationRestore,
		Phase:      PhaseStarted,
	})

	select {
	case event := <-events:
		if event.Operation != OperationRestore || event.Phase != PhaseStarted {
			t.Fatalf("unexpected event: %+v", event)
		}
	default:
		t.Fatal("published lifecycle event was not delivered")
	}

	metrics := bus.Metrics()
	if len(metrics) != 1 || metrics[0].StartedCount != 1 {
		t.Fatalf("unexpected lifecycle metrics: %+v", metrics)
	}
}

func TestEventBusRecordsSubscriberOverflow(t *testing.T) {
	bus := NewEventBus(1)
	_, unsubscribe := bus.Subscribe()
	defer unsubscribe()

	bus.Publish(Event{Operation: OperationFork, Phase: PhaseStarted})
	bus.Publish(Event{Operation: OperationFork, Phase: PhaseSucceeded})

	metrics := bus.Metrics()
	if len(metrics) != 1 || metrics[0].DroppedEventCount != 1 {
		t.Fatalf("unexpected lifecycle delivery metrics: %+v", metrics)
	}
}
