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

package imagecache

import (
	"path"
	"slices"
)

const rootPath = ""

type flattenedNode struct {
	directory bool
	created   int
	touched   int
}

type flattenedTree struct {
	nodes    map[string]*flattenedNode
	children map[string]map[string]struct{}
}

func newFlattenedTree() *flattenedTree {
	return &flattenedTree{
		nodes:    map[string]*flattenedNode{rootPath: {directory: true}},
		children: map[string]map[string]struct{}{},
	}
}

func (t *flattenedTree) add(name string, directory bool, layer int) {
	if name == rootPath {
		t.nodes[rootPath].created = layer
		t.touch(rootPath, layer)
		return
	}
	parent, base := splitTreePath(name)
	t.ensureDirectory(parent, layer)
	node, exists := t.nodes[name]
	if !exists {
		node = &flattenedNode{}
		t.nodes[name] = node
		t.childSet(parent)[base] = struct{}{}
	}
	node.directory = directory
	node.created = layer
	t.touch(name, layer)
}

func (t *flattenedTree) ensureDirectory(name string, layer int) {
	if _, exists := t.nodes[name]; exists {
		return
	}
	parent, base := splitTreePath(name)
	t.ensureDirectory(parent, layer)
	t.nodes[name] = &flattenedNode{directory: true, created: layer, touched: layer}
	t.childSet(parent)[base] = struct{}{}
}

func (t *flattenedTree) touch(name string, layer int) {
	for current := name; ; {
		t.nodes[current].touched = layer
		if current == rootPath {
			return
		}
		current, _ = splitTreePath(current)
	}
}

func (t *flattenedTree) remove(name string) {
	for child := range t.children[name] {
		t.remove(path.Join(name, child))
	}
	delete(t.children, name)
	delete(t.nodes, name)
	parent, base := splitTreePath(name)
	delete(t.children[parent], base)
}

func (t *flattenedTree) sortedChildren(name string) []string {
	names := make([]string, 0, len(t.children[name]))
	for child := range t.children[name] {
		names = append(names, child)
	}
	slices.Sort(names)
	return names
}

func (t *flattenedTree) childSet(name string) map[string]struct{} {
	set, exists := t.children[name]
	if !exists {
		set = make(map[string]struct{})
		t.children[name] = set
	}
	return set
}

func splitTreePath(name string) (string, string) {
	parent := path.Dir(name)
	if parent == "." {
		parent = rootPath
	}
	return parent, path.Base(name)
}
