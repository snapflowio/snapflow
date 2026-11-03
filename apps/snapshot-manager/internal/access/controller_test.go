// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/distribution/distribution/v3/registry/auth"
	"github.com/golang-jwt/jwt/v5"
	"github.com/snapflowio/snapshot-manager/internal/access/accesstest"
)

const (
	testOrganization    = "7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f"
	otherOrganization   = "0d5e1c2b-3a4f-4e6d-8c7b-9a0f1e2d3c4b"
	buildCacheNamespace = "transient/" + testOrganization + "/buildcache"
	testSubject         = "org:" + testOrganization
	deniedSubject       = "machine:revoked"
	tokenAge            = 2 * time.Hour
	hmacKey             = "not-the-signing-key"
)

func newTestController(t *testing.T, issuer *accesstest.TokenIssuer, parameters func(*Verifier) map[string]any) auth.AccessController {
	t.Helper()
	verifier, err := NewVerifier(t.Context(), VerifierConfig{JWKSURL: issuer.JWKSURL(), DeniedSubjects: []string{deniedSubject}})
	if err != nil {
		t.Fatal(err)
	}
	controller, err := newAccessController(parameters(verifier))
	if err != nil {
		t.Fatal(err)
	}
	return controller
}

func registryParameters(verifier *Verifier) map[string]any { return Parameters(verifier) }

func mirrorParameters(verifier *Verifier) map[string]any { return MirrorParameters(verifier) }

func authorize(t *testing.T, controller auth.AccessController, token, repository, action string) error {
	t.Helper()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/v2/", http.NoBody)
	request.SetBasicAuth(TokenUsername, token)
	access := auth.Access{Resource: auth.Resource{Type: resourceTypeRepository, Name: repository}, Action: action}
	_, err := controller.Authorized(request, access)
	return err
}

func TestNamespaceTokenCannotLeaveItsNamespace(t *testing.T) {
	issuer := accesstest.NewIssuer(t)
	controller := newTestController(t, issuer, registryParameters)
	token := issuer.Token(t, testSubject, accesstest.Push(buildCacheNamespace+"/*"))
	for _, action := range []string{actionPull, actionPush} {
		if err := authorize(t, controller, token, buildCacheNamespace+"/0123456789abcdef", action); err != nil {
			t.Fatalf("%s inside the build cache was denied: %v", action, err)
		}
	}
	for _, repository := range []string{
		buildCacheNamespace,
		"transient/" + testOrganization + "/app",
		"transient/" + testOrganization + "/buildcache-other/key",
		"transient/" + otherOrganization + "/buildcache/0123456789abcdef",
		"snapflow/snapshot-0123abcd",
		"library/alpine",
	} {
		for _, action := range []string{actionPull, actionPush, actionDelete} {
			if err := authorize(t, controller, token, repository, action); err == nil {
				t.Fatalf("build cache token was granted %s on %s", action, repository)
			}
		}
	}
}

func TestRepositoryTokenGrantsOnlyItsActions(t *testing.T) {
	issuer := accesstest.NewIssuer(t)
	controller := newTestController(t, issuer, registryParameters)
	token := issuer.Token(t, "machine:1", accesstest.Pull("snapflow/snapshot-a"))
	if err := authorize(t, controller, token, "snapflow/snapshot-a", actionPull); err != nil {
		t.Fatalf("assigned pull was denied: %v", err)
	}
	if err := authorize(t, controller, token, "snapflow/snapshot-a", actionPush); err == nil {
		t.Fatal("pull token was granted a push")
	}
	if err := authorize(t, controller, token, "snapflow/snapshot-b", actionPull); err == nil {
		t.Fatal("token was granted a repository it does not name")
	}
}

func TestMirrorRequiresTheMirrorScope(t *testing.T) {
	issuer := accesstest.NewIssuer(t)
	controller := newTestController(t, issuer, mirrorParameters)
	mirrorToken := issuer.Token(t, testSubject, accesstest.Pull(MirrorNamespace+"/*"))
	if err := authorize(t, controller, mirrorToken, "library/alpine", actionPull); err != nil {
		t.Fatalf("mirror pull was denied: %v", err)
	}
	if err := authorize(t, controller, mirrorToken, "library/alpine", actionPush); err == nil {
		t.Fatal("mirror granted a push")
	}
	buildToken := issuer.Token(t, testSubject, accesstest.Push(buildCacheNamespace+"/*"))
	if err := authorize(t, controller, buildToken, "library/alpine", actionPull); err == nil {
		t.Fatal("mirror granted a pull to a token without the mirror scope")
	}
}

func TestVerifierRejectsInvalidTokens(t *testing.T) {
	issuer := accesstest.NewIssuer(t)
	controller := newTestController(t, issuer, registryParameters)
	entry := accesstest.Pull("snapflow/snapshot-a")
	past := time.Now().Add(-tokenAge)
	valid := func() jwt.RegisteredClaims {
		now := time.Now()
		return jwt.RegisteredClaims{
			Issuer:    accesstest.Issuer,
			Audience:  jwt.ClaimStrings{accesstest.Audience},
			Subject:   "machine:1",
			ID:        "token-1",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
		}
	}
	expired := valid()
	expired.IssuedAt, expired.ExpiresAt = jwt.NewNumericDate(past), jwt.NewNumericDate(past.Add(time.Minute))
	foreignAudience := valid()
	foreignAudience.Audience = jwt.ClaimStrings{"another-registry"}
	missingID := valid()
	missingID.ID = ""
	hmacToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, valid()).SignedString([]byte(hmacKey))
	if err != nil {
		t.Fatal(err)
	}
	for name, token := range map[string]string{
		"expired":          issuer.Sign(t, expired, entry),
		"foreign audience": issuer.Sign(t, foreignAudience, entry),
		"missing id":       issuer.Sign(t, missingID, entry),
		"denied subject":   issuer.Token(t, deniedSubject, entry),
		"hmac signed":      hmacToken,
		"not a token":      "not-a-token",
	} {
		if err := authorize(t, controller, token, "snapflow/snapshot-a", actionPull); err == nil {
			t.Fatalf("%s token was accepted", name)
		}
	}
}
