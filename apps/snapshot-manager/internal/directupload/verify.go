// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package directupload

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/opencontainers/go-digest"
)

func (service *Service) verify(ctx context.Context, verifying record) {
	defer service.tracker.finishVerifying(verifying.ID)
	settled, err := service.settle(ctx, verifying)
	if err != nil {
		service.config.Logger.ErrorContext(ctx, "Direct upload verification did not finish",
			"upload", verifying.ID, "repository", verifying.Repository, "digest", verifying.Digest, "error", err)
		return
	}
	service.tracker.release(verifying.Subject, verifying.ID)
	service.config.Logger.InfoContext(ctx, "Direct upload verified",
		"upload", settled.ID, "repository", settled.Repository, "digest", settled.Digest,
		"size", settled.Size, "state", settled.State, "error", settled.Error)
}

func (service *Service) settle(ctx context.Context, verifying record) (record, error) {
	settled := verifying
	err := service.measure(ctx, verifying)
	switch {
	case errors.Is(err, errContentMismatch):
		if deleteErr := service.config.Storage.Delete(ctx, stagedDataPath(verifying.ID)); deleteErr != nil {
			return record{}, fmt.Errorf("delete mismatched upload %s: %w", verifying.ID, deleteErr)
		}
		settled.State = stateFailed
		settled.Error = err.Error()
	case err != nil:
		return record{}, err
	default:
		if err := service.promote(ctx, verifying); err != nil {
			return record{}, err
		}
		settled.State = stateLinked
	}
	return settled, service.saveRecord(ctx, settled)
}

func (service *Service) measure(ctx context.Context, verifying record) (err error) {
	reader, err := service.config.Storage.Reader(ctx, stagedDataPath(verifying.ID), 0)
	if err != nil {
		return fmt.Errorf("open upload %s: %w", verifying.ID, err)
	}
	defer func() {
		if closeErr := reader.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("close upload %s: %w", verifying.ID, closeErr))
		}
	}()
	digester := digest.SHA256.Digester()
	size, err := io.Copy(digester.Hash(), io.LimitReader(reader, verifying.Size+1))
	if err != nil {
		return fmt.Errorf("read upload %s: %w", verifying.ID, err)
	}
	if actual := digester.Digest(); size != verifying.Size || actual != verifying.Digest {
		return fmt.Errorf("%w: got %d bytes with digest %s, expected %d bytes with digest %s",
			errContentMismatch, size, actual, verifying.Size, verifying.Digest)
	}
	return nil
}

func (service *Service) promote(ctx context.Context, verified record) error {
	service.config.Gate.RLock()
	defer service.config.Gate.RUnlock()
	staged := stagedDataPath(verified.ID)
	blob := blobDataPath(verified.Digest)
	present, err := service.exists(ctx, blob)
	if err != nil {
		return err
	}
	if present {
		if err := service.config.Storage.Delete(ctx, staged); err != nil {
			return fmt.Errorf("delete duplicate upload %s: %w", verified.ID, err)
		}
	} else if err := service.config.Storage.Move(ctx, staged, blob); err != nil {
		return fmt.Errorf("move upload %s to %s: %w", verified.ID, verified.Digest, err)
	}
	return service.writeLink(ctx, verified.Repository, verified.Digest)
}
