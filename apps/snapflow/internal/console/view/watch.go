// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"errors"
	"time"

	tea "charm.land/bubbletea/v2"
	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/admin"
)

const (
	keyQuit      = "q"
	keyEscape    = "esc"
	keyInterrupt = "ctrl+c"
)

type WatchConfig struct {
	Theme    style.Theme
	Interval time.Duration
	Fetch    func() admin.StatusResult
}

type Watch struct {
	cfg    WatchConfig
	result admin.StatusResult
	loaded bool
}

type statusMsg admin.StatusResult

type refreshMsg struct{}

func NewWatch(cfg WatchConfig) (Watch, error) {
	if cfg.Fetch == nil || cfg.Interval <= 0 {
		return Watch{}, errors.New("status watch needs a fetch function and a positive interval")
	}
	return Watch{cfg: cfg}, nil
}

func (watch Watch) Init() tea.Cmd {
	return watch.fetch
}

func (watch Watch) Update(message tea.Msg) (tea.Model, tea.Cmd) {
	switch message := message.(type) {
	case statusMsg:
		watch.result, watch.loaded = admin.StatusResult(message), true
		return watch, tea.Tick(watch.cfg.Interval, func(time.Time) tea.Msg { return refreshMsg{} })
	case refreshMsg:
		return watch, watch.fetch
	case tea.KeyPressMsg:
		switch message.String() {
		case keyQuit, keyEscape, keyInterrupt:
			return watch, tea.Quit
		}
	}
	return watch, nil
}

func (watch Watch) View() tea.View {
	if !watch.loaded {
		return tea.NewView(Header(watch.cfg.Theme, text.LabelMachine, ""))
	}
	footer := watch.cfg.Theme.Muted.Render(text.WatchFooter(watch.cfg.Interval))
	return tea.NewView(Lines(Status(watch.cfg.Theme, watch.result), "", watch.cfg.Theme.Indent.Render(footer)))
}

func (watch Watch) fetch() tea.Msg {
	return statusMsg(watch.cfg.Fetch())
}

func (watch Watch) Ready() bool {
	return watch.loaded && watch.result.Ready
}
