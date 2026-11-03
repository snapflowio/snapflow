// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

const (
	organizationListPath      = "/auth/organization/list"
	organizationSetActivePath = "/auth/organization/set-active"
	sessionPath               = "/auth/get-session"

	listOrganizationsOperation  = "list your organizations"
	setActiveOrganizationAction = "select the organization"
	readSessionOperation        = "read the approval session"
)

var (
	ErrUnknownOrganization  = errors.New("the selected organization does not exist or you are not a member of it")
	ErrNoActiveOrganization = errors.New("the approval session has no active organization")
)

type Organization struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type OrganizationChoice struct {
	Organizations []Organization
	Active        Organization
}

type setActiveOrganizationRequest struct {
	OrganizationID string `json:"organizationId"`
}

type approvalSession struct {
	ActiveOrganizationID string `json:"activeOrganizationId"`
}

type sessionResponse struct {
	Session approvalSession `json:"session"`
}

func (client *deviceClient) selectOrganization(ctx context.Context, accessToken string, cfg RegistrationConfig) (Organization, error) {
	organizations, err := client.listOrganizations(ctx, accessToken)
	if err != nil {
		return Organization{}, err
	}
	if cfg.Organization != "" {
		chosen, found := findOrganization(organizations, cfg.Organization)
		if !found {
			return Organization{}, fmt.Errorf("%w: %s", ErrUnknownOrganization, cfg.Organization)
		}
		return chosen, client.setActiveOrganization(ctx, accessToken, chosen.ID)
	}
	activeID, err := client.activeOrganizationID(ctx, accessToken)
	if err != nil {
		return Organization{}, err
	}
	active, found := findOrganization(organizations, activeID)
	if !found {
		return Organization{}, ErrNoActiveOrganization
	}
	if len(organizations) == 1 {
		return active, nil
	}
	chosen, err := cfg.ChooseOrganization(ctx, OrganizationChoice{Organizations: organizations, Active: active})
	if err != nil || chosen.ID == active.ID {
		return chosen, err
	}
	return chosen, client.setActiveOrganization(ctx, accessToken, chosen.ID)
}

func findOrganization(organizations []Organization, idOrSlug string) (Organization, bool) {
	for _, organization := range organizations {
		if organization.ID == idOrSlug || organization.Slug == idOrSlug {
			return organization, true
		}
	}
	return Organization{}, false
}

func (client *deviceClient) listOrganizations(ctx context.Context, accessToken string) ([]Organization, error) {
	response, err := client.get(ctx, organizationListPath, accessToken)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", listOrganizationsOperation, err)
	}
	if err := response.check(listOrganizationsOperation); err != nil {
		return nil, err
	}
	var organizations []Organization
	if err := json.Unmarshal(response.body, &organizations); err != nil {
		return nil, fmt.Errorf("decode organizations: %w", err)
	}
	return organizations, nil
}

func (client *deviceClient) activeOrganizationID(ctx context.Context, accessToken string) (string, error) {
	response, err := client.get(ctx, sessionPath, accessToken)
	if err != nil {
		return "", fmt.Errorf("%s: %w", readSessionOperation, err)
	}
	if err := response.check(readSessionOperation); err != nil {
		return "", err
	}
	var session sessionResponse
	if err := json.Unmarshal(response.body, &session); err != nil {
		return "", fmt.Errorf("decode approval session: %w", err)
	}
	activeID := strings.TrimSpace(session.Session.ActiveOrganizationID)
	if activeID == "" {
		return "", ErrNoActiveOrganization
	}
	return activeID, nil
}

func (client *deviceClient) setActiveOrganization(ctx context.Context, accessToken, organizationID string) error {
	response, err := client.post(ctx, organizationSetActivePath, accessToken, setActiveOrganizationRequest{OrganizationID: organizationID})
	if err != nil {
		return fmt.Errorf("%s: %w", setActiveOrganizationAction, err)
	}
	if err := response.check(setActiveOrganizationAction); err != nil {
		return err
	}
	return nil
}
