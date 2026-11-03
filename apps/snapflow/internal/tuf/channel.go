// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/snapflowio/snapflow/internal/release"
	"golang.org/x/mod/semver"
)

const (
	StableChannel       Channel = "stable"
	BetaChannel         Channel = "beta"
	channelSchema               = "snapflow.channel.v1"
	maximumChannelBytes         = 64 * 1024
	maximumBundleBytes          = 1024 * 1024 * 1024
)

type Channel string

type ChannelRelease struct {
	Schema       string  `json:"schema"`
	Channel      Channel `json:"channel"`
	OS           string  `json:"os"`
	Architecture string  `json:"architecture"`
	Version      string  `json:"version"`
	SHA256       string  `json:"sha256"`
	Length       int64   `json:"length"`
}

func ParseChannel(value string) (Channel, error) {
	switch Channel(strings.TrimSpace(value)) {
	case StableChannel:
		return StableChannel, nil
	case BetaChannel:
		return BetaChannel, nil
	default:
		return "", errors.New("channel must be stable or beta")
	}
}

func (selected ChannelRelease) AssetPath() string {
	return release.BundleAssetPath(selected.Version, selected.Architecture)
}

func (selected ChannelRelease) validate(channel Channel, architecture string) error {
	switch {
	case selected.Schema != channelSchema || selected.Channel != channel:
		return errors.New("channel release identity does not match the requested channel")
	case selected.OS != releaseOS || selected.Architecture != architecture || !supportedArchitecture(architecture):
		return errors.New("channel release platform does not match the requested platform")
	case !semver.IsValid("v" + selected.Version):
		return fmt.Errorf("channel release version %q is not a semantic version", selected.Version)
	case !validSHA256(selected.SHA256):
		return errors.New("channel release has an invalid SHA-256 digest")
	case selected.Length <= 0 || selected.Length > maximumBundleBytes:
		return errors.New("channel release has an invalid length")
	default:
		return nil
	}
}

func CompareVersions(left, right string) int {
	return semver.Compare("v"+left, "v"+right)
}

func encodeChannelRelease(selected ChannelRelease) ([]byte, error) {
	if err := selected.validate(selected.Channel, selected.Architecture); err != nil {
		return nil, err
	}
	encoded, err := json.MarshalIndent(selected, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("encode channel release: %w", err)
	}
	return append(encoded, '\n'), nil
}

func decodeChannelRelease(encoded []byte, channel Channel, architecture string) (ChannelRelease, error) {
	if len(encoded) > maximumChannelBytes {
		return ChannelRelease{}, errors.New("channel release exceeds size limit")
	}
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.DisallowUnknownFields()
	selected := ChannelRelease{}
	if err := decoder.Decode(&selected); err != nil {
		return ChannelRelease{}, fmt.Errorf("decode channel release: %w", err)
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return ChannelRelease{}, errors.New("channel release contains trailing JSON")
	}
	if err := selected.validate(channel, architecture); err != nil {
		return ChannelRelease{}, err
	}
	return selected, nil
}

func validSHA256(value string) bool {
	encoded, found := strings.CutPrefix(value, sha256DigestPrefix)
	if !found || len(encoded) != sha256HexLength {
		return false
	}
	for _, character := range encoded {
		if !strings.ContainsRune("0123456789abcdef", character) {
			return false
		}
	}
	return true
}
