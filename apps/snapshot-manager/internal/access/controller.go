// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"errors"
	"fmt"
	"net/http"
	"path"

	"github.com/distribution/distribution/v3/registry/auth"
)

// accessController grants a request only what its registry token names, on
// every route; there is no credential that bypasses the scope check.
type accessController struct {
	realm     string
	verifier  *Verifier
	namespace string
}

func newAccessController(options map[string]any) (auth.AccessController, error) {
	realm, ok := options[OptionRealm].(string)
	if !ok || realm == "" {
		return nil, fmt.Errorf("%w: %s", ErrOptionRequired, OptionRealm)
	}
	verifier, ok := options[OptionVerifier].(*Verifier)
	if !ok || verifier == nil {
		return nil, fmt.Errorf("%w: %s", ErrOptionRequired, OptionVerifier)
	}
	return &accessController{realm: realm, verifier: verifier, namespace: optionalString(options, OptionNamespace)}, nil
}

func optionalString(options map[string]any, name string) string {
	if value, ok := options[name].(string); ok {
		return value
	}
	return ""
}

func (ac *accessController) Authorized(r *http.Request, access ...auth.Access) (*auth.Grant, error) {
	username, token, ok := r.BasicAuth()
	if !ok {
		return nil, ac.challenge(errors.Join(auth.ErrInvalidCredential, ErrCredentialMissing))
	}
	if username != TokenUsername {
		return nil, ac.challenge(errors.Join(auth.ErrAuthenticationFailure, ErrUnexpectedUser))
	}
	claims, err := ac.verifier.verify(token)
	if err != nil {
		return nil, ac.challenge(errors.Join(auth.ErrAuthenticationFailure, err))
	}
	resources := make([]auth.Resource, 0, len(access))
	for _, requested := range access {
		if !claims.allows(ac.scoped(requested)) {
			return nil, ac.challenge(fmt.Errorf("%w: %s on %s %s",
				ErrAccessDenied, requested.Action, requested.Type, requested.Name))
		}
		resources = append(resources, requested.Resource)
	}
	return &auth.Grant{User: auth.UserInfo{Name: claims.Subject}, Resources: resources}, nil
}

// scoped names a request the way tokens do: mirror repositories sit below
// MirrorNamespace so a snapshot token can never pull through the mirror.
func (ac *accessController) scoped(requested auth.Access) auth.Access {
	if ac.namespace == "" || requested.Type != resourceTypeRepository {
		return requested
	}
	requested.Name = path.Join(ac.namespace, requested.Name)
	return requested
}

func (ac *accessController) challenge(err error) challenge {
	return challenge{realm: ac.realm, err: err}
}
