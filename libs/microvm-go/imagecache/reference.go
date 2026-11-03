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
	"fmt"
	"strings"

	"github.com/distribution/reference"
)

type ImageRef struct {
	raw        string
	repository string
	tag        string
	digest     string
}

func ParseImageRef(value string) (ImageRef, error) {
	named, err := reference.ParseNormalizedNamed(strings.TrimSpace(value))
	if err != nil {
		return ImageRef{}, fmt.Errorf("%w: %w", ErrInvalidImageRef, err)
	}

	imageRef := ImageRef{
		repository: reference.Domain(named) + "/" + reference.Path(named),
	}

	if canonical, ok := named.(reference.Canonical); ok {
		imageRef.digest = canonical.Digest().String()
		imageRef.raw = canonical.String()
		return imageRef, nil
	}

	tagged := reference.TagNameOnly(named)
	imageRef.raw = tagged.String()
	if tag, ok := tagged.(reference.Tagged); ok {
		imageRef.tag = tag.Tag()
	}
	return imageRef, nil
}

func (r ImageRef) String() string {
	return r.raw
}

func (r ImageRef) Repository() string {
	return r.repository
}

func (r ImageRef) Tag() string {
	return r.tag
}

func (r ImageRef) Digest() string {
	return r.digest
}

func (r ImageRef) IsDigest() bool {
	return r.digest != ""
}

func (r ImageRef) DigestHex() string {
	if r.digest == "" {
		return ""
	}
	_, hex, found := strings.Cut(r.digest, ":")
	if !found {
		return ""
	}
	return hex
}
