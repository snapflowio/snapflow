// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package notices

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"slices"
	"strings"
)

const (
	firstPartyPrefix = "github.com/snapflowio/"
	targetOS         = "linux"
)

func targetArchitectures() []string {
	return []string{"amd64", "arm64"}
}

func shippedPackages() []string {
	return []string{
		"./apps/snapflow/cmd/snapflow",
		"./apps/snapflow/cmd/snapflowd",
		"./libs/microvm-go/cmd/guest-init",
	}
}

type Module struct {
	Path    string
	Version string
	Dir     string
}

type listedPackage struct {
	Module *Module
}

func listModules(ctx context.Context, workspaceRoot string) ([]Module, error) {
	var modules []Module
	for _, architecture := range targetArchitectures() {
		listed, err := listArchitectureModules(ctx, workspaceRoot, architecture)
		if err != nil {
			return nil, err
		}
		modules = append(modules, listed...)
	}
	return uniqueSorted(modules), nil
}

func listArchitectureModules(ctx context.Context, workspaceRoot, architecture string) ([]Module, error) {
	environment := []string{"CGO_ENABLED=0", "GOOS=" + targetOS, "GOARCH=" + architecture}
	arguments := append([]string{"list", "-deps", "-json=Module"}, shippedPackages()...)
	output, err := commandOutput(ctx, workspaceRoot, environment, "go", arguments...)
	if err != nil {
		return nil, fmt.Errorf("list %s/%s dependencies: %w", targetOS, architecture, err)
	}
	modules, err := decodeModules(bytes.NewReader(output))
	if err != nil {
		return nil, fmt.Errorf("decode %s/%s dependencies: %w", targetOS, architecture, err)
	}
	return modules, nil
}

func decodeModules(stream io.Reader) ([]Module, error) {
	decoder := json.NewDecoder(stream)
	var modules []Module
	for {
		var listed listedPackage
		err := decoder.Decode(&listed)
		if errors.Is(err, io.EOF) {
			return modules, nil
		}
		if err != nil {
			return nil, fmt.Errorf("decode go list package: %w", err)
		}
		if listed.Module != nil && !strings.HasPrefix(listed.Module.Path, firstPartyPrefix) {
			modules = append(modules, *listed.Module)
		}
	}
}

func uniqueSorted(modules []Module) []Module {
	sorted := slices.Clone(modules)
	slices.SortFunc(sorted, compareModules)
	return slices.CompactFunc(sorted, func(left, right Module) bool {
		return compareModules(left, right) == 0
	})
}

func compareModules(left, right Module) int {
	return cmp.Or(strings.Compare(left.Path, right.Path), strings.Compare(left.Version, right.Version))
}
