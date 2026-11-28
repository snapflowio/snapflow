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
	"errors"
	"fmt"
	"strconv"
	"strings"
)

func (c *ComputerUse) focusAccessibilityNode(id string) error {
	sender, path, err := parseNodeID(id)
	if err != nil {
		return err
	}
	conn, err := c.connectA11y()
	if err != nil {
		return err
	}
	obj := conn.Object(sender, path)

	var ok bool
	if err := obj.Call(ifaceComponent+".GrabFocus", 0).Store(&ok); err != nil {
		return classifyDbusError(err)
	}
	if !ok {
		return ErrActionNotSupported
	}
	return nil
}

func (c *ComputerUse) invokeAccessibilityNode(id, action string) error {
	sender, path, err := parseNodeID(id)
	if err != nil {
		return err
	}
	conn, err := c.connectA11y()
	if err != nil {
		return err
	}
	obj := conn.Object(sender, path)

	actions, err := getActionNames(obj)
	if err != nil {
		return err
	}

	idx := actionIndex(actions, action)
	if idx < 0 {
		return ErrActionNotSupported
	}

	var ok bool
	if err := obj.Call(ifaceAction+".DoAction", 0, int32(idx)).Store(&ok); err != nil {
		return classifyDbusError(err)
	}
	if !ok {
		return fmt.Errorf("%w: DoAction(%d) returned false", ErrActionNotSupported, idx)
	}
	return nil
}

func actionIndex(actions []string, action string) int {
	if len(actions) == 0 {
		return -1
	}
	if action == "" {
		return 0
	}
	for i, name := range actions {
		if strings.EqualFold(name, action) {
			return i
		}
	}
	return -1
}

func isDisappearingNodeError(err error) bool {
	return errors.Is(err, ErrNodeNotFound)
}

func (c *ComputerUse) setAccessibilityNodeValue(id, value string) error {
	sender, path, err := parseNodeID(id)
	if err != nil {
		return err
	}
	conn, err := c.connectA11y()
	if err != nil {
		return err
	}
	obj := conn.Object(sender, path)

	var ok bool
	etErr := obj.Call(ifaceEditableText+".SetTextContents", 0, value).Store(&ok)
	if etErr == nil {
		return nil
	}
	if translated := classifyDbusError(etErr); !errors.Is(translated, ErrActionNotSupported) {
		return translated
	}

	f, parseErr := strconv.ParseFloat(value, 64)
	if parseErr != nil {
		return fmt.Errorf("%w: node has no EditableText and %q is not numeric: %w",
			ErrActionNotSupported, value, parseErr)
	}
	if err := obj.SetProperty(ifaceValue+".CurrentValue", f); err != nil {
		return classifyDbusError(err)
	}
	return nil
}
