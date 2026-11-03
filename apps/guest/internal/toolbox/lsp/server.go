// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package lsp

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"sync"

	"github.com/sourcegraph/jsonrpc2"
)

const (
	languageTypeScript = "typescript"
	languagePython     = "python"
	clientVersion      = "0.0.1"
	lastSymbolKind     = 13
	markdownFormat     = "markdown"
	plainTextFormat    = "plaintext"
)

type languageSpec struct {
	command string
	args    []string
}

func languageSpecs() map[string]languageSpec {
	return map[string]languageSpec{
		languageTypeScript: {command: "typescript-language-server", args: []string{"--stdio"}},
		languagePython:     {command: "pylsp"},
	}
}

type languageServer struct {
	languageID string
	spec       languageSpec
	logger     *slog.Logger
	mu         sync.Mutex
	client     *Client
	conn       *jsonrpc2.Conn
	cancel     context.CancelFunc
}

type stdioStream struct {
	io.Reader
	io.WriteCloser
}

func (s *stdioStream) Close() error {
	return s.WriteCloser.Close()
}

func newLanguageServer(languageID string, spec languageSpec, logger *slog.Logger) *languageServer {
	return &languageServer{
		languageID: languageID,
		spec:       spec,
		logger:     logger.With(slog.String("component", languageID+"_lsp_server")),
	}
}

func (s *languageServer) running() (*Client, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.client == nil {
		return nil, errors.New("server not initialized")
	}
	return s.client, nil
}

func (s *languageServer) Initialize(ctx context.Context, pathToProject string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.client != nil {
		return nil
	}
	processContext, cancel := context.WithCancel(context.WithoutCancel(ctx))
	cmd := exec.CommandContext(processContext, s.spec.command, s.spec.args...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("open %s language server input: %w", s.languageID, err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("open %s language server output: %w", s.languageID, err)
	}
	if err := cmd.Start(); err != nil {
		cancel()
		return fmt.Errorf("start %s language server: %w", s.languageID, err)
	}
	conn := jsonrpc2.NewConn(processContext, jsonrpc2.NewBufferedStream(&stdioStream{Reader: stdout, WriteCloser: stdin}, jsonrpc2.VSCodeObjectCodec{}), jsonrpc2.HandlerWithError(s.handleServerRequest))
	client := &Client{conn: conn}
	if err := client.Initialize(ctx, s.initializeParams(pathToProject)); err != nil {
		cancel()
		return errors.Join(fmt.Errorf("initialize %s language server: %w", s.languageID, err), conn.Close())
	}
	s.client = client
	s.conn = conn
	s.cancel = cancel
	return nil
}

func (s *languageServer) handleServerRequest(ctx context.Context, conn *jsonrpc2.Conn, request *jsonrpc2.Request) (any, error) {
	s.logger.DebugContext(ctx, "Received language server request", "method", request.Method, "params", request.Params)
	return nil, nil
}

func (s *languageServer) initializeParams(pathToProject string) InitializeParams {
	symbolKinds := make([]int, lastSymbolKind)
	for index := range symbolKinds {
		symbolKinds[index] = index + 1
	}
	return InitializeParams{
		ProcessID:  os.Getpid(),
		ClientInfo: ClientInfo{Name: "snapflow-" + s.languageID + "-lsp-client", Version: clientVersion},
		RootURI:    fileURIPrefix + pathToProject,
		Capabilities: ClientCapabilities{
			TextDocument: TextDocumentClientCapabilities{
				Completion: CompletionClientCapabilities{
					DynamicRegistration: true,
					CompletionItem: CompletionItemCapabilities{
						SnippetSupport:          true,
						CommitCharactersSupport: true,
						DocumentationFormat:     []string{markdownFormat, plainTextFormat},
						DeprecatedSupport:       true,
						PreselectSupport:        true,
					},
					ContextSupport: true,
				},
				DocumentSymbol: DocumentSymbolClientCapabilities{
					DynamicRegistration: true,
					SymbolKind:          SymbolKindInfo{ValueSet: symbolKinds},
				},
			},
			Workspace: WorkspaceClientCapabilities{
				Symbol: WorkspaceSymbolClientCapabilities{DynamicRegistration: true},
			},
		},
	}
}

func (s *languageServer) Shutdown(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.client == nil {
		return nil
	}
	shutdownErr := s.client.Shutdown(ctx)
	closeErr := s.conn.Close()
	s.cancel()
	s.client = nil
	s.conn = nil
	if shutdownErr != nil {
		return fmt.Errorf("shutdown %s language server: %w", s.languageID, errors.Join(shutdownErr, closeErr))
	}
	return nil
}
