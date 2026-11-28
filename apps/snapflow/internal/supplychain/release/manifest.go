// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package release

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path"
	"slices"
	"strings"
	"time"

	"github.com/distribution/reference"
	"github.com/opencontainers/go-digest"
	"golang.org/x/mod/semver"
)

const (
	Schema  = "snapflow.release.v1"
	Product = "snapflow-runtime"

	ReleaseRootDirectory = "snapflow-runtime"
	ManifestFileName     = "manifest.json"

	maximumManifestBytes = 1024 * 1024
	digestPrefix         = "sha256:"
	readOnlyFileMode     = 0o444
	executableFileMode   = 0o555

	RoleSnapflow        FileRole = "snapflow"
	RoleSnapflowd       FileRole = "snapflowd"
	RoleFirecracker     FileRole = "firecracker"
	RoleCloudHypervisor FileRole = "cloud-hypervisor"
	RoleMkfsErofs       FileRole = "mkfs-erofs"
	RoleKernel          FileRole = "kernel"
	RoleInitrd          FileRole = "initrd"
	RoleNotices         FileRole = "third-party-notices"
)

func requiredRoles() []FileRole {
	return []FileRole{
		RoleSnapflow,
		RoleSnapflowd,
		RoleFirecracker,
		RoleCloudHypervisor,
		RoleMkfsErofs,
		RoleKernel,
		RoleInitrd,
	}
}

type FileRole string

type Manifest struct {
	Schema       string       `json:"schema"`
	Product      string       `json:"product"`
	Version      string       `json:"version"`
	Revision     string       `json:"revision"`
	BuiltAt      time.Time    `json:"builtAt"`
	OS           string       `json:"os"`
	Architecture string       `json:"architecture"`
	Guest        GuestRelease `json:"guest"`
	Files        []File       `json:"files"`
}

type GuestRelease struct {
	Reference              string `json:"reference"`
	ControlProtocolVersion int    `json:"controlProtocolVersion"`
}

type File struct {
	Role    FileRole `json:"role"`
	Path    string   `json:"path"`
	Version string   `json:"version"`
	SHA256  string   `json:"sha256"`
	Size    int64    `json:"size"`
	Mode    uint32   `json:"mode"`
}

type AssetPaths struct {
	Snapflow        string `json:"snapflow"`
	Snapflowd       string `json:"snapflowd"`
	Firecracker     string `json:"firecracker"`
	CloudHypervisor string `json:"cloudHypervisor"`
	MkfsErofs       string `json:"mkfsErofs"`
	Kernel          string `json:"kernel"`
	Initrd          string `json:"initrd"`
}

func Marshal(manifest Manifest) ([]byte, error) {
	if err := manifest.Validate(); err != nil {
		return nil, err
	}
	encoded, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("encode Snapflow release manifest: %w", err)
	}
	return append(encoded, '\n'), nil
}

func Decode(encoded []byte) (Manifest, error) {
	if len(encoded) > maximumManifestBytes {
		return Manifest{}, fmt.Errorf("the Snapflow release manifest exceeds %d-byte limit", maximumManifestBytes)
	}
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.DisallowUnknownFields()
	var manifest Manifest
	if err := decoder.Decode(&manifest); err != nil {
		return Manifest{}, fmt.Errorf("decode Snapflow release manifest: %w", err)
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		if err == nil {
			return Manifest{}, errors.New("decode Snapflow release manifest: trailing JSON value")
		}
		return Manifest{}, fmt.Errorf("decode trailing Snapflow release manifest data: %w", err)
	}
	if err := manifest.Validate(); err != nil {
		return Manifest{}, err
	}
	canonical, err := Marshal(manifest)
	if err != nil {
		return Manifest{}, err
	}
	if !bytes.Equal(encoded, canonical) {
		return Manifest{}, errors.New("the Snapflow release manifest is not canonical JSON")
	}
	return manifest, nil
}

func (manifest Manifest) Validate() error {
	if err := manifest.validateIdentity(); err != nil {
		return err
	}
	if err := validateImmutableReference(manifest.Guest.Reference); err != nil {
		return fmt.Errorf("the Snapflow release guest reference: %w", err)
	}
	if err := validateFiles(manifest.Files); err != nil {
		return err
	}
	return nil
}

func (manifest Manifest) validateIdentity() error {
	_, supportedArchitecture := supportedPlatforms()[manifest.Architecture]
	switch {
	case manifest.Schema != Schema:
		return fmt.Errorf("unsupported Snapflow release schema %q", manifest.Schema)
	case manifest.Product != Product:
		return fmt.Errorf("the Snapflow release product must be %q", Product)
	case !semver.IsValid("v" + manifest.Version):
		return fmt.Errorf("the Snapflow release version %q is not a semantic version", manifest.Version)
	case strings.TrimSpace(manifest.Revision) == "":
		return errors.New("the Snapflow release revision is required")
	case manifest.BuiltAt.IsZero() || manifest.BuiltAt.Location() != time.UTC:
		return errors.New("the Snapflow release builtAt must be a non-zero UTC timestamp")
	case manifest.OS != manifestOS:
		return fmt.Errorf("unsupported Snapflow release operating system %q", manifest.OS)
	case !supportedArchitecture:
		return fmt.Errorf("unsupported Snapflow release architecture %q", manifest.Architecture)
	case manifest.Guest.ControlProtocolVersion < 1:
		return errors.New("the Snapflow release guest control protocol version must be positive")
	default:
		return nil
	}
}

func validateFiles(files []File) error {
	if len(files) < len(requiredRoles()) {
		return errors.New("the Snapflow release manifest does not contain every required asset")
	}
	seenRoles := make(map[FileRole]struct{}, len(files))
	for index, file := range files {
		if err := file.validate(); err != nil {
			return err
		}
		if index > 0 && file.Path <= files[index-1].Path {
			return errors.New("the Snapflow release files must be uniquely sorted by path")
		}
		if _, exists := seenRoles[file.Role]; exists {
			return fmt.Errorf("the Snapflow release role %q is repeated", file.Role)
		}
		seenRoles[file.Role] = struct{}{}
	}
	for _, role := range requiredRoles() {
		if _, exists := seenRoles[role]; !exists {
			return fmt.Errorf("the Snapflow release required role %q is missing", role)
		}
	}
	return nil
}

func (manifest Manifest) AssetPaths(root string) AssetPaths {
	return AssetPaths{
		Snapflow:        manifest.filePath(root, RoleSnapflow),
		Snapflowd:       manifest.filePath(root, RoleSnapflowd),
		Firecracker:     manifest.filePath(root, RoleFirecracker),
		CloudHypervisor: manifest.filePath(root, RoleCloudHypervisor),
		MkfsErofs:       manifest.filePath(root, RoleMkfsErofs),
		Kernel:          manifest.filePath(root, RoleKernel),
		Initrd:          manifest.filePath(root, RoleInitrd),
	}
}

func SortFiles(files []File) {
	slices.SortFunc(files, func(left, right File) int {
		return strings.Compare(left.Path, right.Path)
	})
}

func (manifest Manifest) file(role FileRole) File {
	for _, file := range manifest.Files {
		if file.Role == role {
			return file
		}
	}
	return File{}
}

func (manifest Manifest) FileIdentity(role FileRole) string {
	return manifest.file(role).SHA256
}

func (manifest Manifest) FileVersion(role FileRole) string {
	return manifest.file(role).Version
}

func (manifest Manifest) filePath(root string, role FileRole) string {
	return path.Join(root, manifest.file(role).Path)
}

func (file File) validate() error {
	if !knownRole(file.Role) {
		return fmt.Errorf("unknown Snapflow release file role %q", file.Role)
	}
	if strings.TrimSpace(file.Version) == "" {
		return fmt.Errorf("the Snapflow release file %q has no version", file.Role)
	}
	if !validRelativePath(file.Path) {
		return fmt.Errorf("the Snapflow release file %q has invalid path %q", file.Role, file.Path)
	}
	if file.Size <= 0 {
		return fmt.Errorf("the Snapflow release file %q must have a positive size", file.Role)
	}
	if !validSHA256(file.SHA256) {
		return fmt.Errorf("the Snapflow release file %q has an invalid SHA-256 digest", file.Role)
	}
	expectedMode := roleMode(file.Role)
	if file.Mode != expectedMode {
		return fmt.Errorf("the Snapflow release file %q mode %#o must be %#o", file.Role, file.Mode, expectedMode)
	}
	return nil
}

func knownRole(role FileRole) bool {
	return slices.Contains(append(requiredRoles()[:], RoleNotices), role)
}

func executableRole(role FileRole) bool {
	return role == RoleSnapflow || role == RoleSnapflowd || role == RoleFirecracker || role == RoleCloudHypervisor ||
		role == RoleMkfsErofs
}

func roleMode(role FileRole) uint32 {
	if executableRole(role) {
		return executableFileMode
	}
	return readOnlyFileMode
}

func validRelativePath(value string) bool {
	if value == "" || strings.Contains(value, "\\") || strings.HasPrefix(value, "/") {
		return false
	}
	cleaned := path.Clean(value)
	return cleaned == value && cleaned != "." && cleaned != ".." && !strings.HasPrefix(cleaned, "../")
}

func validSHA256(value string) bool {
	encoded, ok := strings.CutPrefix(strings.TrimSpace(value), digestPrefix)
	if !ok || len(encoded) != sha256.Size*2 {
		return false
	}
	decoded, err := hex.DecodeString(encoded)
	return err == nil && len(decoded) == sha256.Size
}

func validateImmutableReference(value string) error {
	named, err := reference.ParseNormalizedNamed(strings.TrimSpace(value))
	if err != nil {
		return err
	}
	digested, ok := named.(reference.Digested)
	if !ok {
		return errors.New("reference must be digest-pinned")
	}
	parsed := digest.Digest(digested.Digest().String())
	if err := parsed.Validate(); err != nil {
		return err
	}
	if parsed.Algorithm() != digest.SHA256 {
		return fmt.Errorf("reference digest algorithm must be %s", digest.SHA256)
	}
	return nil
}
