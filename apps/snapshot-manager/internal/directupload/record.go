// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package directupload

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"time"

	storagedriver "github.com/distribution/distribution/v3/registry/storage/driver"
	"github.com/opencontainers/go-digest"
)

type state string

const (
	statePending   state = "pending"
	stateVerifying state = "verifying"
	stateLinked    state = "linked"
	stateFailed    state = "failed"
)

var uploadID = regexp.MustCompile(`^[A-Z2-7]{26}$`)

type record struct {
	ID         string        `json:"id"`
	Subject    string        `json:"subject"`
	Repository string        `json:"repository"`
	Digest     digest.Digest `json:"digest"`
	Size       int64         `json:"size"`
	State      state         `json:"state"`
	Error      string        `json:"error,omitempty"`
	ExpiresAt  time.Time     `json:"expiresAt"`
}

func (service *Service) loadRecord(ctx context.Context, id string) (record, error) {
	if !uploadID.MatchString(id) {
		return record{}, errUploadNotFound
	}
	content, err := service.config.Storage.GetContent(ctx, statePath(id))
	if errors.As(err, &storagedriver.PathNotFoundError{}) {
		return record{}, errUploadNotFound
	}
	if err != nil {
		return record{}, fmt.Errorf("read upload %s: %w", id, err)
	}
	var loaded record
	if err := json.Unmarshal(content, &loaded); err != nil {
		return record{}, fmt.Errorf("decode upload %s: %w", id, err)
	}
	return loaded, nil
}

func (service *Service) saveRecord(ctx context.Context, saved record) error {
	content, err := json.Marshal(saved)
	if err != nil {
		return fmt.Errorf("encode upload %s: %w", saved.ID, err)
	}
	if err := service.config.Storage.PutContent(ctx, statePath(saved.ID), content); err != nil {
		return fmt.Errorf("write upload %s: %w", saved.ID, err)
	}
	return nil
}

func (service *Service) exists(ctx context.Context, path string) (bool, error) {
	_, err := service.config.Storage.Stat(ctx, path)
	if errors.As(err, &storagedriver.PathNotFoundError{}) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("stat %s: %w", path, err)
	}
	return true, nil
}

func (service *Service) writeLink(ctx context.Context, repository string, blob digest.Digest) error {
	if err := service.config.Storage.PutContent(ctx, layerLinkPath(repository, blob), []byte(blob.String())); err != nil {
		return fmt.Errorf("link %s into %s: %w", blob, repository, err)
	}
	return nil
}
