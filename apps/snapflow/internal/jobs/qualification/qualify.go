// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package qualification

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/snapflowio/snapflow/internal/jobs/canary"
	"github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/sandbox"
	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/tunnel-go/canonicaljson"
)

const (
	digestPrefix = "sha256:"
	reasonPassed = "passed"
	reasonFailed = "failed"
)

type Runtime interface {
	Health(context.Context) []runtime.ServiceHealth
	Capabilities(context.Context) (runtime.Capabilities, error)
	canary.Runtime
}

type Config struct {
	Runtime           Runtime
	LocalRuntimes     *sandbox.LocalRuntimes
	Converger         canary.Converger
	Identity          *state.Identity
	SessionID         string
	SessionGeneration int
	ReleaseDigest     string
	WorkDirectory     string
}

type checkResult struct {
	CheckID    string `json:"checkId"`
	Passed     bool   `json:"passed"`
	DurationMS int64  `json:"durationMs"`
	ReasonCode string `json:"reasonCode"`
}

type evidencePayload struct {
	SchemaVersion          int            `json:"schemaVersion"`
	PolicyVersion          int            `json:"policyVersion"`
	Audience               string         `json:"audience"`
	ChallengeID            string         `json:"challengeId"`
	RequestDigest          string         `json:"requestDigest"`
	MachineID              string         `json:"machineId"`
	SessionID              string         `json:"sessionId"`
	SessionGeneration      int            `json:"sessionGeneration"`
	MachineKeyID           string         `json:"machineKeyId"`
	Nonce                  string         `json:"nonce"`
	InputFingerprint       string         `json:"inputFingerprint"`
	IssuedAt               string         `json:"issuedAt"`
	CompletedAt            string         `json:"completedAt"`
	ReleaseDigest          string         `json:"releaseDigest"`
	EnvironmentFingerprint string         `json:"environmentFingerprint"`
	CheckResults           []checkResult  `json:"checkResults"`
	Metrics                map[string]int `json:"metrics"`
}

type Evidence struct {
	Payload   evidencePayload `json:"payload"`
	Signature string          `json:"signature"`
}

func Run(ctx context.Context, cfg Config, payload string, opts ...Option) (Evidence, error) {
	logger := newOptions(opts).logger
	request, err := decodeRequest(payload)
	if err != nil {
		return Evidence{}, err
	}
	if err := validate(cfg, request, time.Now().UTC()); err != nil {
		return Evidence{}, err
	}
	qualificationContext, cancel := context.WithTimeout(
		ctx,
		time.Duration(request.WorkLimits.MaximumDurationSeconds)*time.Second,
	)
	defer cancel()
	checks := make([]checkResult, 0, len(requiredChecks()))
	metrics := make(map[string]int)
	for _, checkID := range request.RequestedCheckIDs {
		startedAt := time.Now()
		checkErr := executeCheck(qualificationContext, cfg, request, checkID, metrics)
		if checkErr != nil {
			logger.WarnContext(ctx, "Machine qualification check failed",
				slog.String("check_id", checkID), slog.String("challenge_id", request.ChallengeID),
				slog.Any("error", checkErr))
		}
		checks = append(checks, checkResult{
			CheckID: checkID, Passed: checkErr == nil,
			DurationMS: time.Since(startedAt).Milliseconds(),
			ReasonCode: checkReason(checkErr),
		})
	}
	return sign(cfg, request, checks, metrics)
}

func sign(cfg Config, request Request, checks []checkResult, metrics map[string]int) (Evidence, error) {
	canonicalRequest, err := canonicaljson.Marshal(request)
	if err != nil {
		return Evidence{}, fmt.Errorf("canonicalize machine qualification request: %w", err)
	}
	requestDigest := sha256.Sum256(canonicalRequest)
	payload := evidencePayload{
		SchemaVersion: request.SchemaVersion, PolicyVersion: request.PolicyVersion,
		Audience: request.Audience, ChallengeID: request.ChallengeID,
		RequestDigest: hex.EncodeToString(requestDigest[:]),
		MachineID:     request.MachineID, SessionID: request.SessionID,
		SessionGeneration: request.SessionGeneration, MachineKeyID: request.MachineKeyID,
		Nonce: request.Nonce, InputFingerprint: request.InputFingerprint,
		IssuedAt: request.IssuedAt, CompletedAt: time.Now().UTC().Format(time.RFC3339Nano),
		ReleaseDigest: cfg.ReleaseDigest, EnvironmentFingerprint: request.InputFingerprint,
		CheckResults: checks, Metrics: metrics,
	}
	canonical, err := canonicaljson.Marshal(payload)
	if err != nil {
		return Evidence{}, fmt.Errorf("canonicalize machine qualification evidence: %w", err)
	}
	signature, err := cfg.Identity.SignPayload(canonical)
	if err != nil {
		return Evidence{}, fmt.Errorf("sign machine qualification evidence: %w", err)
	}
	return Evidence{Payload: payload, Signature: signature}, nil
}

func validSHA256Digest(value string) bool {
	encoded, found := strings.CutPrefix(value, digestPrefix)
	if !found || len(encoded) != sha256.Size*2 {
		return false
	}
	decoded, err := hex.DecodeString(encoded)
	return err == nil && len(decoded) == sha256.Size
}

func checkReason(err error) string {
	if err == nil {
		return reasonPassed
	}
	return reasonFailed
}
