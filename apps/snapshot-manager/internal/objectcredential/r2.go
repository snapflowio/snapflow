// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package objectcredential

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/golang-jwt/jwt/v5"
)

const (
	r2HostSeparator     = "."
	r2SessionPrefix     = "jwt/"
	r2ClaimBucket       = "bucket"
	r2ClaimActions      = "actions"
	r2ClaimPaths        = "paths"
	r2ClaimPrefixPaths  = "prefixPaths"
	r2ClaimObjectPaths  = "objectPaths"
	r2ClaimSubject      = "sub"
	r2ClaimIssuer       = "iss"
	r2ClaimAudience     = "aud"
	r2ClaimIssuedAt     = "iat"
	r2ClaimExpiresAt    = "exp"
	r2ActionPut         = "PutObject"
	r2ActionCreatePart  = "CreateMultipartUpload"
	r2ActionUploadPart  = "UploadPart"
	r2ActionComplete    = "CompleteMultipartUpload"
	r2ActionAbortUpload = "AbortMultipartUpload"
)

var r2AccountID = regexp.MustCompile(`^[0-9a-f]{32}$`)

type r2Issuer struct {
	credentials aws.CredentialsProvider
	accountID   string
	audience    string
}

func newR2Issuer(credentials aws.CredentialsProvider, host string) (*r2Issuer, error) {
	accountID, _, _ := strings.Cut(host, r2HostSeparator)
	if !r2AccountID.MatchString(accountID) {
		return nil, fmt.Errorf("%w: %s", ErrR2AccountID, host)
	}
	return &r2Issuer{credentials: credentials, accountID: accountID, audience: host}, nil
}

func r2UploadActions() []string {
	return []string{r2ActionPut, r2ActionCreatePart, r2ActionUploadPart, r2ActionComplete, r2ActionAbortUpload}
}

func (issuer *r2Issuer) Issue(ctx context.Context, grant Grant) (Credential, error) {
	parent, err := issuer.credentials.Retrieve(ctx)
	if err != nil {
		return Credential{}, fmt.Errorf("retrieve parent object storage credential: %w", err)
	}
	issued := time.Now()
	expires := issued.Add(grant.TTL)
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		r2ClaimBucket:  grant.Bucket,
		r2ClaimActions: r2UploadActions(),
		r2ClaimPaths: map[string][]string{
			r2ClaimPrefixPaths: {},
			r2ClaimObjectPaths: {grant.Key},
		},
		r2ClaimSubject:   issuer.accountID,
		r2ClaimIssuer:    parent.AccessKeyID,
		r2ClaimAudience:  issuer.audience,
		r2ClaimIssuedAt:  issued.Unix(),
		r2ClaimExpiresAt: expires.Unix(),
	}).SignedString([]byte(parent.SecretAccessKey))
	if err != nil {
		return Credential{}, fmt.Errorf("sign r2 temporary credential: %w", err)
	}
	secret := sha256.Sum256([]byte(token))
	return Credential{
		AccessKeyID:     parent.AccessKeyID,
		SecretAccessKey: hex.EncodeToString(secret[:]),
		SessionToken:    base64.StdEncoding.EncodeToString([]byte(r2SessionPrefix + token)),
		Expires:         time.Unix(expires.Unix(), 0).UTC(),
	}, nil
}
