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

package guest

import (
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"sort"
	"strings"

	"github.com/distribution/reference"
	"github.com/opencontainers/go-digest"
)

const PlatformMountPath = "/run/snapflow/platform"

var (
	ErrBundleNotConfigured    = errors.New("platform bundle is not configured")
	ErrMutableBundleReference = errors.New("platform bundle reference is mutable")
)

type FilesystemFormat string

const FilesystemEROFS FilesystemFormat = "erofs"

type Bundle struct {
	Name                  string
	Version               string
	ReleaseDigest         string
	Image                 string
	AllowMutableReference bool
	Required              bool
	Capabilities          []SandboxCapability
	MountPath             string
	Components            []Manifest
}

func (bundle Bundle) Validate() error {
	if err := bundle.validateIdentity(); err != nil {
		return err
	}
	if err := bundle.validateCapabilities(); err != nil {
		return err
	}
	return bundle.validateComponents()
}

func (bundle Bundle) validateIdentity() error {
	if !componentNamePattern.MatchString(bundle.Name) {
		return fmt.Errorf("guest bundle name %q must match %s", bundle.Name, componentNamePattern)
	}
	if strings.TrimSpace(bundle.Version) == "" {
		return fmt.Errorf("guest bundle %q version is required", bundle.Name)
	}
	releaseDigest, err := digest.Parse(strings.TrimSpace(bundle.ReleaseDigest))
	if err != nil || releaseDigest.Algorithm() != digest.SHA256 {
		return fmt.Errorf("guest bundle %q release digest must be a valid sha256 digest", bundle.Name)
	}
	if strings.TrimSpace(bundle.Image) == "" {
		return fmt.Errorf("guest bundle %q image is required", bundle.Name)
	}
	if !bundle.AllowMutableReference && !isImmutableOCIReference(bundle.Image) {
		return fmt.Errorf("%w: guest bundle %q must use a digest-pinned OCI image", ErrMutableBundleReference, bundle.Name)
	}
	if !cleanPathWithin(bundle.MountPath, PlatformMountPath) {
		return fmt.Errorf("guest bundle %q mount path must be a clean path beneath %s", bundle.Name, PlatformMountPath)
	}
	return nil
}

func (bundle Bundle) validateCapabilities() error {
	normalized, err := NormalizeSandboxCapabilities(bundle.Capabilities)
	if err != nil {
		return fmt.Errorf("guest bundle %q capabilities: %w", bundle.Name, err)
	}
	if !slices.Equal(normalized, bundle.Capabilities) {
		return fmt.Errorf("guest bundle %q capabilities must be sorted and canonical", bundle.Name)
	}
	return nil
}

func (bundle Bundle) validateComponents() error {
	if len(bundle.Components) == 0 {
		return fmt.Errorf("guest bundle %q must contain at least one component", bundle.Name)
	}
	names := make(map[string]struct{}, len(bundle.Components))
	services := make(map[string]struct{})
	ports := make(map[uint32]struct{})
	for _, component := range bundle.Components {
		if err := ValidateManifest(component); err != nil {
			return fmt.Errorf("guest bundle %q component: %w", bundle.Name, err)
		}
		if !cleanPathWithin(component.GuestPath, bundle.MountPath) {
			return fmt.Errorf("guest bundle %q component %q must be beneath bundle mount path", bundle.Name, component.Name)
		}
		if _, exists := names[component.Name]; exists {
			return fmt.Errorf("guest bundle %q repeats component %q", bundle.Name, component.Name)
		}
		names[component.Name] = struct{}{}
		if err := bundle.claimServices(component, services, ports); err != nil {
			return err
		}
	}
	return nil
}

func (bundle Bundle) claimServices(component Manifest, services map[string]struct{}, ports map[uint32]struct{}) error {
	for _, service := range declaredServices(component) {
		if _, exists := services[service.Name]; exists {
			return fmt.Errorf("guest bundle %q repeats service %q", bundle.Name, service.Name)
		}
		if _, exists := ports[service.Port]; exists {
			return fmt.Errorf("guest bundle %q repeats service port %d", bundle.Name, service.Port)
		}
		services[service.Name], ports[service.Port] = struct{}{}, struct{}{}
	}
	return nil
}

func isImmutableOCIReference(value string) bool {
	named, err := reference.ParseNormalizedNamed(strings.TrimSpace(value))
	if err != nil {
		return false
	}
	digested, ok := named.(reference.Digested)
	if !ok || digested.Digest().Algorithm() != digest.SHA256 {
		return false
	}
	return digested.Digest().Validate() == nil
}

func (format FilesystemFormat) Valid() bool {
	switch format {
	case FilesystemEROFS:
		return true
	default:
		return false
	}
}

func NormalizeSandboxCapabilities(capabilities []SandboxCapability) ([]SandboxCapability, error) {
	requested := make(map[SandboxCapability]struct{}, len(capabilities)+1)
	for _, capability := range capabilities {
		if !capability.Valid() {
			return nil, fmt.Errorf("unknown sandbox capability %q", capability)
		}
		requested[capability] = struct{}{}
	}
	if _, desktop := requested[SandboxCapabilityDesktop]; desktop {
		requested[SandboxCapabilityDeveloperTools] = struct{}{}
	}
	result := make([]SandboxCapability, 0, len(requested))
	for capability := range requested {
		result = append(result, capability)
	}
	sort.Slice(result, func(left, right int) bool { return result[left] < result[right] })
	return result, nil
}

func SelectBundles(bundles []Bundle, capabilities []SandboxCapability) ([]Bundle, error) {
	requested, err := NormalizeSandboxCapabilities(capabilities)
	if err != nil {
		return nil, err
	}
	if err := ValidateBundles(bundles); err != nil {
		return nil, err
	}

	ordered := cloneBundles(bundles)
	sort.Slice(ordered, func(left, right int) bool {
		if ordered[left].Required != ordered[right].Required {
			return ordered[left].Required
		}
		return ordered[left].Name < ordered[right].Name
	})

	requestedSet := capabilitySet(requested)
	covered := make(map[SandboxCapability]struct{}, len(requested))
	selected := make([]Bundle, 0, len(ordered))
	for _, bundle := range ordered {
		if bundle.Required {
			selected = append(selected, bundle)
			coverRequestedCapabilities(covered, requestedSet, bundle.Capabilities)
			continue
		}
		if !capabilitiesAreSubset(bundle.Capabilities, requestedSet) ||
			!addsUncoveredCapability(bundle.Capabilities, requestedSet, covered) {
			continue
		}
		selected = append(selected, bundle)
		coverRequestedCapabilities(covered, requestedSet, bundle.Capabilities)
	}

	missing := make([]SandboxCapability, 0)
	for _, capability := range requested {
		if _, ok := covered[capability]; !ok {
			missing = append(missing, capability)
		}
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("%w for capabilities %v", ErrBundleNotConfigured, missing)
	}
	return resolveBundles(selected, requestedSet)
}

func resolveBundles(bundles []Bundle, requested map[SandboxCapability]struct{}) ([]Bundle, error) {
	for bundleIndex := range bundles {
		for componentIndex, component := range bundles[bundleIndex].Components {
			resolved, err := resolveManifest(component, requested)
			if err != nil {
				return nil, fmt.Errorf("guest bundle %q: %w", bundles[bundleIndex].Name, err)
			}
			bundles[bundleIndex].Components[componentIndex] = resolved
		}
	}
	return bundles, nil
}

func ValidateBundles(bundles []Bundle) error {
	index := newBundleIndex(len(bundles))
	for _, bundle := range bundles {
		if err := bundle.Validate(); err != nil {
			return err
		}
		if err := index.add(bundle); err != nil {
			return err
		}
	}
	return nil
}

type bundleIndex struct {
	names          map[string]struct{}
	mountPaths     map[string]string
	componentNames map[string]string
	serviceNames   map[string]string
	servicePorts   map[uint32]string
	capabilitySets map[string]string
	releaseDigest  string
}

func newBundleIndex(size int) *bundleIndex {
	return &bundleIndex{
		names:          make(map[string]struct{}, size),
		mountPaths:     make(map[string]string, size),
		componentNames: make(map[string]string),
		serviceNames:   make(map[string]string),
		servicePorts:   make(map[uint32]string),
		capabilitySets: make(map[string]string, size),
	}
}

func (index *bundleIndex) add(bundle Bundle) error {
	if _, exists := index.names[bundle.Name]; exists {
		return fmt.Errorf("guest bundle name %q is duplicated", bundle.Name)
	}
	index.names[bundle.Name] = struct{}{}
	if index.releaseDigest == "" {
		index.releaseDigest = bundle.ReleaseDigest
	} else if bundle.ReleaseDigest != index.releaseDigest {
		return fmt.Errorf("guest bundle %q belongs to release %s, expected %s", bundle.Name, bundle.ReleaseDigest, index.releaseDigest)
	}
	if existing, exists := index.mountPaths[bundle.MountPath]; exists {
		return fmt.Errorf("guest bundles %q and %q use the same mount path %q", existing, bundle.Name, bundle.MountPath)
	}
	index.mountPaths[bundle.MountPath] = bundle.Name
	for _, component := range bundle.Components {
		if err := index.addComponent(bundle.Name, component); err != nil {
			return err
		}
	}
	key := capabilitySetKey(bundle.Capabilities)
	if existing, exists := index.capabilitySets[key]; exists {
		return fmt.Errorf("guest bundles %q and %q provide the same capability set", existing, bundle.Name)
	}
	index.capabilitySets[key] = bundle.Name
	return nil
}

func (index *bundleIndex) addComponent(bundleName string, component Manifest) error {
	if existing, exists := index.componentNames[component.Name]; exists {
		return fmt.Errorf("guest bundles %q and %q repeat component %q", existing, bundleName, component.Name)
	}
	index.componentNames[component.Name] = bundleName
	for _, service := range declaredServices(component) {
		if existing, exists := index.serviceNames[service.Name]; exists {
			return fmt.Errorf("guest bundles %q and %q repeat service %q", existing, bundleName, service.Name)
		}
		if existing, exists := index.servicePorts[service.Port]; exists {
			return fmt.Errorf("guest bundles %q and %q repeat service port %d", existing, bundleName, service.Port)
		}
		index.serviceNames[service.Name] = bundleName
		index.servicePorts[service.Port] = bundleName
	}
	return nil
}

func capabilitySetKey(capabilities []SandboxCapability) string {
	values := make([]string, len(capabilities))
	for index, capability := range capabilities {
		values[index] = string(capability)
	}
	return strings.Join(values, "\x00")
}

func cloneBundle(source Bundle) Bundle {
	result := source
	result.Capabilities = append([]SandboxCapability(nil), source.Capabilities...)
	result.Components = make([]Manifest, len(source.Components))
	for index, component := range source.Components {
		result.Components[index] = cloneManifest(component)
	}
	return result
}

func cloneBundles(source []Bundle) []Bundle {
	result := make([]Bundle, len(source))
	for index, bundle := range source {
		result[index] = cloneBundle(bundle)
	}
	return result
}

func capabilitySet(capabilities []SandboxCapability) map[SandboxCapability]struct{} {
	result := make(map[SandboxCapability]struct{}, len(capabilities))
	for _, capability := range capabilities {
		result[capability] = struct{}{}
	}
	return result
}

func capabilitiesAreSubset(capabilities []SandboxCapability, requested map[SandboxCapability]struct{}) bool {
	for _, capability := range capabilities {
		if _, ok := requested[capability]; !ok {
			return false
		}
	}
	return true
}

func addsUncoveredCapability(
	capabilities []SandboxCapability,
	requested, covered map[SandboxCapability]struct{},
) bool {
	for _, capability := range capabilities {
		if _, wanted := requested[capability]; !wanted {
			continue
		}
		if _, alreadyCovered := covered[capability]; !alreadyCovered {
			return true
		}
	}
	return false
}

func coverRequestedCapabilities(
	covered, requested map[SandboxCapability]struct{},
	capabilities []SandboxCapability,
) {
	for _, capability := range capabilities {
		if _, wanted := requested[capability]; wanted {
			covered[capability] = struct{}{}
		}
	}
}

func cleanPathWithin(path, root string) bool {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path || path == root {
		return false
	}
	relative, err := filepath.Rel(root, path)
	return err == nil && relative != "." && relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}
