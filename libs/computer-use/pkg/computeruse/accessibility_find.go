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
	"fmt"
	"regexp"
	"strings"

	"github.com/godbus/dbus/v5"
)

const (
	findDefaultLimit = 500
	findCeilingLimit = 5000
)

func (c *ComputerUse) findAccessibilityNodes(scope A11yScope, pid int, filter A11yFilter, limit int) ([]*A11yNode, bool, error) {
	if limit <= 0 {
		limit = findDefaultLimit
	}
	if limit > findCeilingLimit {
		limit = findCeilingLimit
	}

	matcher, err := buildFilterMatcher(filter)
	if err != nil {
		return nil, false, err
	}

	conn, err := c.connectA11y()
	if err != nil {
		return nil, false, err
	}
	root, err := c.resolveScopeRoot(conn, scope, pid)
	if err != nil {
		return nil, false, err
	}

	search := &nodeSearch{conn: conn, match: matcher, limit: limit, budget: walkBudget}
	truncated, err := search.walk(root.Sender, root.Path, false)
	if err != nil {
		return nil, false, err
	}
	return search.matches, truncated, nil
}

type nodeSearch struct {
	conn    *dbus.Conn
	match   func(*A11yNode) bool
	limit   int
	budget  int
	matches []*A11yNode
}

func (s *nodeSearch) walk(sender string, path dbus.ObjectPath, ignoreMissing bool) (bool, error) {
	if s.budget <= 0 {
		return true, nil
	}
	s.budget--
	node, err := fetchNodeMeta(s.conn, sender, path)
	if err != nil {
		return false, missingNodeError(err, ignoreMissing)
	}
	if s.match(node) && s.record(node) {
		return true, nil
	}
	refs, err := getChildren(s.conn, sender, path)
	if err != nil {
		return false, missingNodeError(err, ignoreMissing)
	}
	return s.walkChildren(refs)
}

func (s *nodeSearch) record(node *A11yNode) bool {
	flat := *node
	flat.Children = nil
	s.matches = append(s.matches, &flat)
	return len(s.matches) >= s.limit
}

func (s *nodeSearch) walkChildren(refs []accessibleRef) (bool, error) {
	for _, ref := range refs {
		if s.budget <= 0 {
			return true, nil
		}
		truncated, err := s.walk(ref.Sender, ref.Path, true)
		if err != nil || truncated {
			return truncated, err
		}
	}
	return s.budget <= 0, nil
}

func missingNodeError(err error, ignoreMissing bool) error {
	if ignoreMissing && isDisappearingNodeError(err) {
		return nil
	}
	return err
}

const (
	nameMatchExact     = "exact"
	nameMatchSubstring = "substring"
	nameMatchRegex     = "regex"
)

type nodePredicate func(*A11yNode) bool

func buildFilterMatcher(filter A11yFilter) (func(*A11yNode) bool, error) {
	nameMatches, err := nameMatcher(filter.Name, filter.NameMatch)
	if err != nil {
		return nil, err
	}
	var predicates []nodePredicate
	if role := strings.ToLower(filter.Role); role != "" {
		predicates = append(predicates, func(node *A11yNode) bool { return strings.ToLower(node.Role) == role })
	}
	if filter.Name != "" {
		predicates = append(predicates, nameMatches)
	}
	for _, want := range filter.States {
		predicates = append(predicates, func(node *A11yNode) bool { return containsStr(node.States, want) })
	}
	return func(node *A11yNode) bool {
		for _, predicate := range predicates {
			if !predicate(node) {
				return false
			}
		}
		return true
	}, nil
}

func nameMatcher(name, mode string) (nodePredicate, error) {
	switch mode {
	case nameMatchExact:
		return func(node *A11yNode) bool { return node.Name == name }, nil
	case "", nameMatchSubstring:
		return func(node *A11yNode) bool { return strings.Contains(node.Name, name) }, nil
	case nameMatchRegex:
		pattern, err := regexp.Compile(name)
		if err != nil {
			return nil, fmt.Errorf("%w: invalid regex for name filter: %w", ErrInvalidRequest, err)
		}
		return func(node *A11yNode) bool { return pattern.MatchString(node.Name) }, nil
	default:
		return nil, fmt.Errorf("%w: unknown nameMatch mode %q, want exact|substring|regex", ErrInvalidRequest, mode)
	}
}
