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
	"strings"

	"github.com/snapflowio/computer-use/plugin"
)

type A11yScope string

const (
	A11yScopeFocused A11yScope = "focused"
	A11yScopePID     A11yScope = "pid"
	A11yScopeAll     A11yScope = "all"
)

type A11yBounds struct {
	X      int
	Y      int
	Width  int
	Height int
}

type A11yNode struct {
	ID          string
	Role        string
	Name        string
	Description string
	Bounds      A11yBounds
	States      []string
	Actions     []string
	Children    []*A11yNode
}

type A11yFilter struct {
	Role      string
	Name      string
	NameMatch string
	States    []string
}

var (
	ErrA11yUnavailable    = errors.New(plugin.A11yUnavailableMessage)
	ErrNoAccessibleRoot   = errors.New(plugin.A11yNoAccessibleRootMessage)
	ErrNodeNotFound       = errors.New(plugin.A11yNodeNotFoundMessage)
	ErrActionNotSupported = errors.New(plugin.A11yActionNotSupportedMessage)
	ErrInvalidScope       = errors.New(plugin.A11yInvalidScopeMessage)
	ErrInvalidRequest     = errors.New(plugin.A11yInvalidRequestMessage)
)

func parseWireScope(s string) (A11yScope, error) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "", "focused":
		return A11yScopeFocused, nil
	case "pid":
		return A11yScopePID, nil
	case "all":
		return A11yScopeAll, nil
	default:
		return "", fmt.Errorf("%w: got %q, expected focused|pid|all", ErrInvalidScope, s)
	}
}

func toWireBounds(b A11yBounds) plugin.AccessibilityBounds {
	return plugin.AccessibilityBounds{
		X:      b.X,
		Y:      b.Y,
		Width:  b.Width,
		Height: b.Height,
	}
}

func toWireNode(n *A11yNode) *plugin.AccessibilityNode {
	if n == nil {
		return nil
	}
	out := &plugin.AccessibilityNode{
		ID:          n.ID,
		Role:        n.Role,
		Name:        n.Name,
		Description: n.Description,
		Bounds:      toWireBounds(n.Bounds),
		States:      n.States,
		Actions:     n.Actions,
	}
	if len(n.Children) > 0 {
		out.Children = make([]*plugin.AccessibilityNode, 0, len(n.Children))
		for _, child := range n.Children {
			if wc := toWireNode(child); wc != nil {
				out.Children = append(out.Children, wc)
			}
		}
	}
	return out
}

func toWireNodes(ns []*A11yNode) []plugin.AccessibilityNode {
	out := make([]plugin.AccessibilityNode, 0, len(ns))
	for _, n := range ns {
		if wn := toWireNode(n); wn != nil {
			out = append(out, *wn)
		}
	}
	return out
}

func (c *ComputerUse) GetAccessibilityTree(req *plugin.GetAccessibilityTreeRequest) (*plugin.AccessibilityTreeResponse, error) {
	if req == nil {
		req = &plugin.GetAccessibilityTreeRequest{}
	}
	scope, err := parseWireScope(req.Scope)
	if err != nil {
		return nil, err
	}
	node, truncated, err := c.getAccessibilityTree(scope, req.PID, req.MaxDepth)
	if err != nil {
		return nil, err
	}
	resp := &plugin.AccessibilityTreeResponse{Truncated: truncated}
	if wire := toWireNode(node); wire != nil {
		resp.Root = *wire
	}
	return resp, nil
}

func (c *ComputerUse) FindAccessibilityNodes(req *plugin.FindAccessibilityNodesRequest) (*plugin.AccessibilityNodesResponse, error) {
	if req == nil {
		req = &plugin.FindAccessibilityNodesRequest{}
	}
	scope, err := parseWireScope(req.Scope)
	if err != nil {
		return nil, err
	}
	filter := A11yFilter{
		Role:      req.Role,
		Name:      req.Name,
		NameMatch: req.NameMatch,
		States:    req.States,
	}
	matches, truncated, err := c.findAccessibilityNodes(scope, req.PID, filter, req.Limit)
	if err != nil {
		return nil, err
	}
	return &plugin.AccessibilityNodesResponse{
		Matches:   toWireNodes(matches),
		Truncated: truncated,
	}, nil
}

func (c *ComputerUse) FocusAccessibilityNode(req *plugin.AccessibilityNodeRequest) (*plugin.Empty, error) {
	if req == nil {
		return nil, fmt.Errorf("%w: request is required", ErrInvalidRequest)
	}
	if err := c.focusAccessibilityNode(req.ID); err != nil {
		return nil, err
	}
	return new(plugin.Empty), nil
}

func (c *ComputerUse) InvokeAccessibilityNode(req *plugin.AccessibilityInvokeRequest) (*plugin.Empty, error) {
	if req == nil {
		return nil, fmt.Errorf("%w: request is required", ErrInvalidRequest)
	}
	if err := c.invokeAccessibilityNode(req.ID, req.Action); err != nil {
		return nil, err
	}
	return new(plugin.Empty), nil
}

func (c *ComputerUse) SetAccessibilityNodeValue(req *plugin.AccessibilitySetValueRequest) (*plugin.Empty, error) {
	if req == nil {
		return nil, fmt.Errorf("%w: request is required", ErrInvalidRequest)
	}
	if err := c.setAccessibilityNodeValue(req.ID, req.Value); err != nil {
		return nil, err
	}
	return new(plugin.Empty), nil
}
