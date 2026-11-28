// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package lsp

type LspServerRequest struct {
	LanguageId    string `json:"languageId" validate:"required"`
	PathToProject string `json:"pathToProject" validate:"required"`
} //	@name	LspServerRequest

type LspDocumentRequest struct {
	LanguageId    string `json:"languageId" validate:"required"`
	PathToProject string `json:"pathToProject" validate:"required"`
	Uri           string `json:"uri" validate:"required"`
} //	@name	LspDocumentRequest

type LspCompletionParams struct {
	LanguageId    string             `json:"languageId" validate:"required"`
	PathToProject string             `json:"pathToProject" validate:"required"`
	Uri           string             `json:"uri" validate:"required"`
	Position      LspPosition        `json:"position" validate:"required"`
	Context       *CompletionContext `json:"context,omitempty" validate:"optional"`
} //	@name	LspCompletionParams
