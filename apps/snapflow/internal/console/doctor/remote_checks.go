// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package doctor

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/go-containerregistry/pkg/authn"
	"github.com/google/go-containerregistry/pkg/name"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/release"
)

const diagnosticHTTPTimeout = 10 * time.Second

func endpointStatus(ctx context.Context, baseURL, endpoint string) (resultErr error) {
	parsed, err := url.Parse(strings.TrimRight(baseURL, "/"))
	if err != nil {
		return err
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/" + endpoint
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return err
	}
	response, err := (&http.Client{Timeout: diagnosticHTTPTimeout}).Do(request)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := response.Body.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close %s response: %w", parsed.Redacted(), closeErr))
		}
	}()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("%s returned HTTP %d", parsed.Redacted(), response.StatusCode)
	}
	return nil
}

func registry(ctx context.Context, selectedProfile config.Profile, verified release.VerifiedRelease) error {
	if verified.Root == "" {
		return errors.New("guest release cannot be checked before the Snapflow release is valid")
	}
	if err := selectedProfile.ValidateGuestRegistry(selectedProfile.GuestRegistryOrigin, verified.Manifest.Guest.Reference); err != nil {
		return err
	}
	options := []name.Option{name.StrictValidation}
	if selectedProfile.Name == config.Development {
		options = append(options, name.Insecure)
	}
	reference, err := name.ParseReference(verified.Manifest.Guest.Reference, options...)
	if err != nil {
		return err
	}
	_, err = remote.Head(reference, remote.WithContext(ctx), remote.WithAuthFromKeychain(authn.DefaultKeychain))
	return err
}
