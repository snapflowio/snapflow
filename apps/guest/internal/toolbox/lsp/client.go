// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package lsp

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/sourcegraph/jsonrpc2"
)

type Client struct {
	conn *jsonrpc2.Conn
}

type InitializeParams struct {
	ProcessID    int                `json:"processId"`
	ClientInfo   ClientInfo         `json:"clientInfo"`
	RootURI      string             `json:"rootUri"`
	Capabilities ClientCapabilities `json:"capabilities"`
}

type ClientInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type ClientCapabilities struct {
	TextDocument TextDocumentClientCapabilities `json:"textDocument"`
	Workspace    WorkspaceClientCapabilities    `json:"workspace"`
}

type TextDocumentClientCapabilities struct {
	Completion     CompletionClientCapabilities     `json:"completion"`
	DocumentSymbol DocumentSymbolClientCapabilities `json:"documentSymbol"`
}

type CompletionClientCapabilities struct {
	DynamicRegistration bool                       `json:"dynamicRegistration"`
	CompletionItem      CompletionItemCapabilities `json:"completionItem"`
	ContextSupport      bool                       `json:"contextSupport"`
}

type CompletionItemCapabilities struct {
	SnippetSupport          bool     `json:"snippetSupport"`
	CommitCharactersSupport bool     `json:"commitCharactersSupport"`
	DocumentationFormat     []string `json:"documentationFormat"`
	DeprecatedSupport       bool     `json:"deprecatedSupport"`
	PreselectSupport        bool     `json:"preselectSupport"`
}

type DocumentSymbolClientCapabilities struct {
	DynamicRegistration bool           `json:"dynamicRegistration"`
	SymbolKind          SymbolKindInfo `json:"symbolKind"`
}

type SymbolKindInfo struct {
	ValueSet []int `json:"valueSet"`
}

type WorkspaceClientCapabilities struct {
	Symbol WorkspaceSymbolClientCapabilities `json:"symbol"`
}

type WorkspaceSymbolClientCapabilities struct {
	DynamicRegistration bool `json:"dynamicRegistration"`
}

type Range struct {
	Start LspPosition `json:"start" validate:"required"`
	End   LspPosition `json:"end" validate:"required"`
} //	@name	Range

type TextDocumentIdentifier struct {
	URI string `json:"uri" validate:"required"`
}

type VersionedTextDocumentIdentifier struct {
	URI     string `json:"uri" validate:"required"`
	Version int    `json:"version" validate:"required"`
} //	@name	VersionedTextDocumentIdentifier

type CompletionParams struct {
	TextDocument TextDocumentIdentifier `json:"textDocument" validate:"required"`
	Position     LspPosition            `json:"position" validate:"required"`
	Context      *CompletionContext     `json:"context,omitempty" validate:"optional"`
} //	@name	CompletionParams

type CompletionContext struct {
	TriggerKind      int     `json:"triggerKind" validate:"required"`
	TriggerCharacter *string `json:"triggerCharacter,omitempty" validate:"optional"`
} //	@name	CompletionContext

type CompletionItem struct {
	Label         string      `json:"label" validate:"required"`
	Kind          *int        `json:"kind,omitempty" validate:"optional"`
	Detail        *string     `json:"detail,omitempty" validate:"optional"`
	Documentation interface{} `json:"documentation,omitempty" validate:"optional"`
	SortText      *string     `json:"sortText,omitempty" validate:"optional"`
	FilterText    *string     `json:"filterText,omitempty" validate:"optional"`
	InsertText    *string     `json:"insertText,omitempty" validate:"optional"`
} //	@name	CompletionItem

type CompletionList struct {
	IsIncomplete bool             `json:"isIncomplete" validate:"required"`
	Items        []CompletionItem `json:"items" validate:"required"`
} //	@name	CompletionList

type LspSymbol struct {
	Kind     int         `json:"kind" validate:"required"`
	Location LspLocation `json:"location" validate:"required"`
	Name     string      `json:"name" validate:"required"`
} //	@name	LspSymbol

type LspLocation struct {
	Range LspRange `json:"range" validate:"required"`
	URI   string   `json:"uri" validate:"required"`
} //	@name	LspLocation

type LspRange struct {
	End   LspPosition `json:"end" validate:"required"`
	Start LspPosition `json:"start" validate:"required"`
} //	@name	LspRange

type LspPosition struct {
	Character int `json:"character" validate:"required"`
	Line      int `json:"line" validate:"required"`
} //	@name	LspPosition

type WorkspaceSymbolParams struct {
	Query string `json:"query" validate:"required"`
} //	@name	WorkspaceSymbolParams

type textDocumentParams struct {
	TextDocument TextDocumentIdentifier `json:"textDocument"`
}

type textDocumentItem struct {
	URI        string `json:"uri"`
	LanguageID string `json:"languageId"`
	Version    int    `json:"version"`
	Text       string `json:"text"`
}

type didOpenParams struct {
	TextDocument textDocumentItem `json:"textDocument"`
}

const (
	fileURIPrefix          = "file://"
	initialDocumentVersion = 1
)

func (c *Client) NotifyDidClose(ctx context.Context, uri string) error {
	return c.conn.Notify(ctx, "textDocument/didClose", textDocumentParams{TextDocument: TextDocumentIdentifier{URI: uri}})
}

func (c *Client) GetWorkspaceSymbols(ctx context.Context, query string) ([]LspSymbol, error) {
	var symbols []LspSymbol
	err := c.conn.Call(ctx, "workspace/symbol", WorkspaceSymbolParams{Query: query}, &symbols)
	return symbols, err
}

func (c *Client) GetCompletion(ctx context.Context, params CompletionParams) (*CompletionList, error) {
	var result json.RawMessage
	if err := c.conn.Call(ctx, "textDocument/completion", params, &result); err != nil {
		return nil, err
	}
	return decodeCompletion(result)
}

func decodeCompletion(result json.RawMessage) (*CompletionList, error) {
	completions := &CompletionList{Items: []CompletionItem{}}
	trimmed := strings.TrimSpace(string(result))
	switch {
	case trimmed == "" || trimmed == "null":
		return completions, nil
	case strings.HasPrefix(trimmed, "["):
		if err := json.Unmarshal(result, &completions.Items); err != nil {
			return nil, fmt.Errorf("decode completion items: %w", err)
		}
		return completions, nil
	default:
		if err := json.Unmarshal(result, completions); err != nil {
			return nil, fmt.Errorf("decode completion list: %w", err)
		}
		return completions, nil
	}
}

func (c *Client) DidOpen(ctx context.Context, uri, languageID string) error {
	content, err := os.ReadFile(strings.TrimPrefix(uri, fileURIPrefix))
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}
	return c.conn.Notify(ctx, "textDocument/didOpen", didOpenParams{TextDocument: textDocumentItem{
		URI:        uri,
		LanguageID: languageID,
		Version:    initialDocumentVersion,
		Text:       string(content),
	}})
}

func (c *Client) GetDocumentSymbols(ctx context.Context, uri string) ([]LspSymbol, error) {
	var symbols []LspSymbol
	err := c.conn.Call(ctx, "textDocument/documentSymbol", textDocumentParams{TextDocument: TextDocumentIdentifier{URI: uri}}, &symbols)
	return symbols, err
}

func (c *Client) Initialize(ctx context.Context, params InitializeParams) error {
	var result json.RawMessage
	if err := c.conn.Call(ctx, "initialize", params, &result); err != nil {
		return err
	}
	return c.conn.Notify(ctx, "initialized", nil)
}

func (c *Client) Shutdown(ctx context.Context) error {
	return c.conn.Notify(ctx, "shutdown", nil)
}
