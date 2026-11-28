// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package inventory

import (
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"slices"
	"strings"

	"github.com/shirou/gopsutil/v4/cpu"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	digestLineSeparator  = "\n"
	digestFieldSeparator = ":"
)

type Sources struct {
	System   fs.FS
	GPUUUIDs []string
}

func NewCollector(sources Sources) func(context.Context) (*machinev1alpha1.HostInventory, error) {
	return func(ctx context.Context) (*machinev1alpha1.HostInventory, error) {
		return Collect(ctx, sources)
	}
}

func Collect(ctx context.Context, sources Sources) (*machinev1alpha1.HostInventory, error) {
	if sources.System == nil {
		return nil, errors.New("host inventory requires the system filesystem")
	}
	components, err := readComponents(sources)
	if err != nil {
		return nil, err
	}
	model, err := cpuModel(ctx)
	if err != nil {
		return nil, err
	}
	return &machinev1alpha1.HostInventory{
		Components:      components,
		InventoryDigest: Digest(components),
		CpuModel:        model,
	}, nil
}

func Digest(components []*machinev1alpha1.FingerprintComponent) string {
	lines := make([]string, 0, len(components))
	for _, component := range components {
		lines = append(lines, kindNames()[component.GetKind()]+digestFieldSeparator+component.GetValueDigest())
	}
	slices.Sort(lines)
	digest := sha256.Sum256([]byte(strings.Join(lines, digestLineSeparator)))
	return hex.EncodeToString(digest[:])
}

func readComponents(sources Sources) ([]*machinev1alpha1.FingerprintComponent, error) {
	values := map[machinev1alpha1.FingerprintKind][]string{}
	for kind, path := range dmiIdentifiers() {
		value, err := readIdentifier(sources.System, path)
		if err != nil {
			return nil, err
		}
		values[kind] = []string{value}
	}
	diskSerials, err := readDiskSerials(sources.System)
	if err != nil {
		return nil, err
	}
	values[machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_DISK_SERIAL] = diskSerials
	values[machinev1alpha1.FingerprintKind_FINGERPRINT_KIND_GPU_UUID] = sources.GPUUUIDs
	return components(values), nil
}

func components(values map[machinev1alpha1.FingerprintKind][]string) []*machinev1alpha1.FingerprintComponent {
	unique := map[string]*machinev1alpha1.FingerprintComponent{}
	for kind, kindValues := range values {
		for _, value := range kindValues {
			normalized := strings.TrimSpace(value)
			if !meaningful(normalized) {
				continue
			}
			digest := ValueDigest(normalized)
			unique[kind.String()+digestFieldSeparator+digest] = &machinev1alpha1.FingerprintComponent{Kind: kind, ValueDigest: digest}
		}
	}
	result := make([]*machinev1alpha1.FingerprintComponent, 0, len(unique))
	for _, component := range unique {
		result = append(result, component)
	}
	slices.SortFunc(result, func(left, right *machinev1alpha1.FingerprintComponent) int {
		return cmp.Or(cmp.Compare(left.GetKind(), right.GetKind()), strings.Compare(left.GetValueDigest(), right.GetValueDigest()))
	})
	return result
}

func ValueDigest(value string) string {
	digest := sha256.Sum256([]byte(strings.TrimSpace(value)))
	return hex.EncodeToString(digest[:])
}

func cpuModel(ctx context.Context) (string, error) {
	processors, err := cpu.InfoWithContext(ctx)
	if err != nil {
		return "", fmt.Errorf("read host CPU model: %w", err)
	}
	for _, processor := range processors {
		if model := strings.TrimSpace(processor.ModelName); model != "" {
			return model, nil
		}
	}
	return "", errors.New("host CPU model is unavailable")
}
