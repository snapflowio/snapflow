// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"slices"
	"strings"

	"github.com/distribution/distribution/v3/registry/auth"
	"github.com/golang-jwt/jwt/v5"
)

const (
	// TokenUsername is the Basic username every registry token is presented with.
	TokenUsername = "snapflow-token"

	tokenIssuer    = "snapflow-api"
	tokenAudience  = "snapflow-registry"
	tokenAlgorithm = "EdDSA"

	resourceTypeRepository = "repository"
	namespaceWildcard      = "/*"

	actionPull   = "pull"
	actionPush   = "push"
	actionDelete = "delete"
)

func grantableActions() []string {
	return []string{actionPull, actionPush, actionDelete}
}

// accessEntry is one element of the distribution token `access` claim. A name
// ending in "/*" grants every repository below that namespace.
type accessEntry struct {
	Type    string   `json:"type"`
	Name    string   `json:"name"`
	Actions []string `json:"actions"`
}

type tokenClaims struct {
	jwt.RegisteredClaims
	Access []accessEntry `json:"access"`
}

func (entry accessEntry) allows(repository, action string) bool {
	return entry.Type == resourceTypeRepository &&
		slices.Contains(grantableActions(), action) &&
		slices.Contains(entry.Actions, action) &&
		repositoryMatches(entry.Name, repository)
}

func repositoryMatches(pattern, repository string) bool {
	if namespace, wildcard := strings.CutSuffix(pattern, namespaceWildcard); wildcard {
		return namespace != "" && strings.HasPrefix(repository, namespace+"/")
	}
	return pattern == repository
}

func (claims *tokenClaims) allows(requested auth.Access) bool {
	if requested.Type != resourceTypeRepository {
		return false
	}
	return slices.ContainsFunc(claims.Access, func(entry accessEntry) bool {
		return entry.allows(requested.Name, requested.Action)
	})
}
