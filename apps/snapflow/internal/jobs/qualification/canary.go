// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package qualification

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/snapflowio/common-go/pkg/toolboxapi"
	"github.com/snapflowio/snapflow/internal/jobs/canary"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	canaryUser           = "root"
	canaryShell          = "sh"
	canaryShellCommand   = "-c"
	canaryCommandTimeout = 10
	canaryNameBytes      = 6
	canaryVariablePrefix = "K"
	canaryDigestPrefix   = "/tmp/."
	canaryEntrypoint     = "umask 077; printf %%s \"$%s\" | sha256sum | cut -d ' ' -f1 > %s; exec sleep 120"
	canaryCommand        = "while [ ! -s %[1]s ]; do sleep 0.1; done; cat %[1]s"
)

type canaryNames struct {
	variable   string
	digestPath string
}

func RunCanaryMicroVM(ctx context.Context, cfg Config, request Request) error {
	names, err := newCanaryNames()
	if err != nil {
		return err
	}
	return canary.Run(ctx, canary.Config{
		Runtime: cfg.Runtime, LocalRuntimes: cfg.LocalRuntimes, Converger: cfg.Converger,
		Environment: map[string]string{names.variable: request.Nonce},
	}, canarySpec(request, names), func(ctx context.Context, session *canary.Session) error {
		return verifyCanarySecret(ctx, session, names, request.Nonce)
	})
}

func newCanaryNames() (canaryNames, error) {
	variable := make([]byte, canaryNameBytes)
	digestPath := make([]byte, canaryNameBytes)
	if _, err := rand.Read(variable); err != nil {
		return canaryNames{}, fmt.Errorf("generate machine qualification canary names: %w", err)
	}
	if _, err := rand.Read(digestPath); err != nil {
		return canaryNames{}, fmt.Errorf("generate machine qualification canary names: %w", err)
	}
	return canaryNames{
		variable:   canaryVariablePrefix + strings.ToUpper(hex.EncodeToString(variable)),
		digestPath: canaryDigestPrefix + hex.EncodeToString(digestPath),
	}, nil
}

func canarySpec(request Request, names canaryNames) *machinev1alpha1.SandboxSpec {
	blockNetwork := true
	return &machinev1alpha1.SandboxSpec{
		Mode:         string(workload.SandboxModeEphemeral),
		Capabilities: []string{string(workload.SandboxCapabilityDeveloperTools)},
		UserId:       request.MachineID, OsUser: canaryUser,
		Resources: &machinev1alpha1.SandboxResources{
			CpuQuota: request.Canary.CPU, MemoryQuota: request.Canary.MemoryGiB, StorageQuota: request.Canary.StorageGiB,
		},
		Network: &machinev1alpha1.NetworkPolicy{BlockAll: &blockNetwork},
		Source: &machinev1alpha1.SandboxSpec_Image{Image: &machinev1alpha1.SandboxImage{
			Ref: request.Canary.Snapshot,
			Entrypoint: []string{
				canaryShell, canaryShellCommand, fmt.Sprintf(canaryEntrypoint, names.variable, names.digestPath),
			},
		}},
	}
}

func verifyCanarySecret(ctx context.Context, session *canary.Session, names canaryNames, secret string) error {
	timeout := uint32(canaryCommandTimeout)
	result, err := session.Execute(ctx, toolboxapi.ExecuteRequest{
		Command: fmt.Sprintf(canaryCommand, names.digestPath), Timeout: &timeout,
	})
	if err != nil {
		return fmt.Errorf("execute machine qualification canary secret check: %w", err)
	}
	if result.ExitCode != 0 {
		return errors.New("machine qualification canary secret check failed")
	}
	expectedDigest := sha256.Sum256([]byte(secret))
	if strings.TrimSpace(result.Result) != hex.EncodeToString(expectedDigest[:]) {
		return errors.New("machine qualification canary secret digest did not match")
	}
	return nil
}
