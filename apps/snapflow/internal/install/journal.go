// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package install

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/snapflowio/snapflow/internal/tuf"
)

const (
	journalSchema        = "snapflow.release-journal.v1"
	maximumJournalBytes  = 1024 * 1024
	journalFileMode      = 0o600
	journalDirectoryMode = 0o700
)

type ReleaseRecord struct {
	Digest      string      `json:"digest"`
	Channel     tuf.Channel `json:"channel"`
	Version     string      `json:"version"`
	InstalledAt time.Time   `json:"installedAt"`
}

type Journal struct {
	Schema         string         `json:"schema"`
	HighestVersion string         `json:"highestVersion,omitempty"`
	Active         *ReleaseRecord `json:"active,omitempty"`
	Previous       *ReleaseRecord `json:"previous,omitempty"`
	Staged         *ReleaseRecord `json:"staged,omitempty"`
}

func InspectJournal(stateRoot string) (Journal, error) {
	if !filepath.IsAbs(stateRoot) {
		return Journal{}, errors.New("release state root must be absolute")
	}
	return loadJournal(filepath.Clean(stateRoot))
}

func loadJournal(stateRoot string) (Journal, error) {
	journalPath := filepath.Join(stateRoot, JournalFileName)
	encoded, err := os.ReadFile(journalPath)
	if errors.Is(err, os.ErrNotExist) {
		return Journal{Schema: journalSchema}, nil
	}
	if err != nil {
		return Journal{}, fmt.Errorf("read release journal: %w", err)
	}
	if len(encoded) > maximumJournalBytes {
		return Journal{}, errors.New("release journal exceeds size limit")
	}
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.DisallowUnknownFields()
	journal := Journal{}
	if err := decoder.Decode(&journal); err != nil {
		return Journal{}, fmt.Errorf("decode release journal: %w", err)
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return Journal{}, errors.New("release journal contains trailing JSON")
	}
	if journal.Schema != journalSchema {
		return Journal{}, fmt.Errorf("unsupported release journal schema %q", journal.Schema)
	}
	if err := journal.validate(); err != nil {
		return Journal{}, err
	}
	return journal, nil
}

func saveJournal(stateRoot string, journal Journal) error {
	journal.Schema = journalSchema
	if err := journal.validate(); err != nil {
		return err
	}
	encoded, err := json.MarshalIndent(journal, "", "  ")
	if err != nil {
		return fmt.Errorf("encode release journal: %w", err)
	}
	encoded = append(encoded, '\n')
	if err := os.MkdirAll(stateRoot, journalDirectoryMode); err != nil {
		return fmt.Errorf("create release state directory: %w", err)
	}
	if err := atomicfile.WriteFile(filepath.Join(stateRoot, JournalFileName), encoded, journalFileMode); err != nil {
		return fmt.Errorf("commit release journal: %w", err)
	}
	return nil
}

func (journal Journal) validate() error {
	for _, candidate := range []struct {
		name   string
		record *ReleaseRecord
	}{
		{name: "active", record: journal.Active},
		{name: "previous", record: journal.Previous},
		{name: "staged", record: journal.Staged},
	} {
		if err := validateReleaseRecord(candidate.name, candidate.record, journal.HighestVersion); err != nil {
			return err
		}
	}
	if journal.Active != nil && journal.Previous != nil && journal.Active.Digest == journal.Previous.Digest {
		return fmt.Errorf("release journal repeats digest %s", journal.Active.Digest)
	}
	if journal.Active != nil && journal.Staged != nil && journal.Active.Digest == journal.Staged.Digest {
		return fmt.Errorf("release journal stages the already active digest %s", journal.Active.Digest)
	}
	return nil
}

func (journal Journal) knows(version, bundleDigest string) bool {
	for _, record := range []*ReleaseRecord{journal.Active, journal.Previous} {
		if record != nil && record.Version == version && record.Digest == bundleDigest {
			return true
		}
	}
	return false
}

func validateReleaseRecord(name string, record *ReleaseRecord, highestVersion string) error {
	if record == nil {
		return nil
	}
	parsed, err := releaseDirectory("/", record.Digest)
	if err != nil || filepath.Base(parsed) == "." {
		return fmt.Errorf("release journal %s record has an invalid digest", name)
	}
	if _, err := tuf.ParseChannel(string(record.Channel)); err != nil || strings.TrimSpace(record.Version) == "" ||
		record.InstalledAt.IsZero() {
		return fmt.Errorf("release journal %s record is incomplete", name)
	}
	if highestVersion == "" || tuf.CompareVersions(record.Version, highestVersion) > 0 {
		return fmt.Errorf("release journal %s version exceeds the trusted high-water mark", name)
	}
	return nil
}
