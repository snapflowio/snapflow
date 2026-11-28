// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package qualification

import (
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"time"

	distributionreference "github.com/distribution/reference"
)

const minimumNonceLength = 32

func validate(cfg Config, request Request, now time.Time) error {
	checks := []func() error{
		cfg.validate,
		func() error { return validateTimeBounds(request, now) },
		func() error { return validatePolicy(request) },
		func() error { return validateBinding(cfg, request) },
		func() error { return validateCheckSet(request) },
		func() error { return validateWorkLimits(request.WorkLimits) },
		func() error { return validateCanary(request.Canary) },
		func() error { return validateWorkDirectory(cfg.WorkDirectory) },
	}
	for _, check := range checks {
		if err := check(); err != nil {
			return err
		}
	}
	return nil
}

func (cfg Config) validate() error {
	if cfg.Runtime == nil || cfg.LocalRuntimes == nil || cfg.Converger == nil || cfg.Identity == nil {
		return errors.New("machine qualification runtime, local runtimes, converger and identity are required")
	}
	if err := cfg.Identity.Validate(); err != nil {
		return fmt.Errorf("validate machine qualification identity: %w", err)
	}
	return nil
}

func validateTimeBounds(request Request, now time.Time) error {
	issuedAt, issuedErr := time.Parse(time.RFC3339Nano, request.IssuedAt)
	expiresAt, expiresErr := time.Parse(time.RFC3339Nano, request.ExpiresAt)
	if issuedErr != nil || expiresErr != nil || expiresAt.Before(now) || issuedAt.After(now.Add(maximumClockSkew)) {
		return errors.New("machine qualification request is expired or has invalid time bounds")
	}
	return nil
}

func validatePolicy(request Request) error {
	if request.SchemaVersion != schemaVersion || request.PolicyVersion != policyVersion || request.Audience != expectedAudience {
		return errors.New("machine qualification request uses an unsupported schema, policy, or audience")
	}
	return nil
}

func validateBinding(cfg Config, request Request) error {
	identityBound := request.MachineID == cfg.Identity.MachineID && request.MachineKeyID == cfg.Identity.KeyID
	sessionBound := request.SessionID == cfg.SessionID && request.SessionGeneration == cfg.SessionGeneration
	if !identityBound || !sessionBound {
		return errors.New("machine qualification request identity or session binding is invalid")
	}
	if len(request.Nonce) < minimumNonceLength || !validSHA256Digest(request.InputFingerprint) || !validSHA256Digest(cfg.ReleaseDigest) {
		return errors.New("machine qualification nonce or digest binding is invalid")
	}
	return nil
}

func validateCheckSet(request Request) error {
	checks := slices.Clone(request.RequestedCheckIDs)
	slices.Sort(checks)
	expected := slices.Clone(requiredChecks())
	slices.Sort(expected)
	if !slices.Equal(checks, expected) {
		return errors.New("machine qualification check set does not match policy")
	}
	return nil
}

func validateWorkLimits(limits WorkLimits) error {
	if !withinLimit(int64(limits.MaximumDurationSeconds), maximumDurationSeconds) ||
		!withinLimit(limits.DiskSampleBytes, maximumDiskSampleBytes) ||
		!withinLimit(int64(limits.CPUIterations), maximumCPUIterations) {
		return errors.New("machine qualification work limits exceed policy")
	}
	return nil
}

func withinLimit(value, maximum int64) bool {
	return value > 0 && value <= maximum
}

func validateCanary(canary Canary) error {
	parsedCanary, err := distributionreference.ParseAnyReference(canary.Snapshot)
	if err != nil {
		return fmt.Errorf("machine qualification canary snapshot is invalid: %w", err)
	}
	if _, immutable := parsedCanary.(distributionreference.Digested); !immutable {
		return errors.New("machine qualification canary snapshot must use an immutable digest")
	}
	if canary.CPU <= 0 || canary.MemoryGiB <= 0 || canary.StorageGiB <= 0 {
		return errors.New("machine qualification canary resources must be positive")
	}
	return nil
}

func validateWorkDirectory(directory string) error {
	if !filepath.IsAbs(directory) {
		return errors.New("machine qualification work directory must be absolute")
	}
	return nil
}
