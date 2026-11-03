// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package suite

import (
	"fmt"
	"math/rand/v2"
	"regexp"
	"strings"
	"time"
)

const (
	cpuCorpusSeed      = 0x534e4150464c4f57
	cpuCorpusStream    = 0x42454e43484d524b
	cpuTextBytes       = 256 * kibibyte
	cpuVocabularyWords = 2_048
	cpuWordMinLetters  = 2
	cpuWordMaxLetters  = 10
	cpuZipfExponent    = 1.1
	cpuZipfOffset      = 1
	cpuMessageMinWords = 6
	cpuMessageMaxWords = 18
	cpuRecordTags      = 4
	cpuActiveOdds      = 2
	cpuJSONRecords     = 1_024
	cpuSortElements    = 1 << 16
	cpuMatrixDimension = 128
	// Matrix cells are drawn uniformly from [-1, 1): span * [0, 1) - offset.
	cpuMatrixValueSpan   = 2
	cpuMatrixValueOffset = 1
	cpuAddressOctetLimit = 256
	cpuLogEpoch          = 1_790_000_000
	cpuLogStepSeconds    = 7
	cpuLetters           = "abcdefghijklmnopqrstuvwxyz"
	cpuLogLine           = "%s level=%s user=%s email=%s addr=%d.%d.%d.%d msg=%s\n"
	cpuPattern           = `[a-z]+@[a-z]+\.(?:com|net|org|io)|\b(?:\d{1,3}\.){3}\d{1,3}\b`
)

type cpuRecord struct {
	ID      uint64   `json:"id"`
	User    string   `json:"user"`
	Email   string   `json:"email"`
	Level   string   `json:"level"`
	Message string   `json:"message"`
	Tags    []string `json:"tags"`
	Score   float64  `json:"score"`
	Active  bool     `json:"active"`
}

type cpuCorpus struct {
	text    []byte
	records []cpuRecord
	pattern *regexp.Regexp
	numbers []uint64
	left    []float64
	right   []float64
}

type cpuTextSource struct {
	random          *rand.Rand
	vocabulary      []string
	zipf            *rand.Zipf
	levels          []string
	topLevelDomains []string
}

func newCPUCorpus() *cpuCorpus {
	random := rand.New(rand.NewPCG(cpuCorpusSeed, cpuCorpusStream))
	source := cpuTextSource{
		random:          random,
		vocabulary:      make([]string, cpuVocabularyWords),
		levels:          []string{"debug", "info", "warn", "error"},
		topLevelDomains: []string{"com", "net", "org", "io"},
	}
	for index := range source.vocabulary {
		letters := make([]byte, cpuWordMinLetters+random.IntN(cpuWordMaxLetters-cpuWordMinLetters+1))
		for position := range letters {
			letters[position] = cpuLetters[random.IntN(len(cpuLetters))]
		}
		source.vocabulary[index] = string(letters)
	}
	source.zipf = rand.NewZipf(random, cpuZipfExponent, cpuZipfOffset, cpuVocabularyWords-1)
	corpus := &cpuCorpus{
		pattern: regexp.MustCompile(cpuPattern),
		numbers: make([]uint64, cpuSortElements),
		left:    make([]float64, cpuMatrixDimension*cpuMatrixDimension),
		right:   make([]float64, cpuMatrixDimension*cpuMatrixDimension),
	}
	var text strings.Builder
	for line := 0; text.Len() < cpuTextBytes; line++ {
		text.WriteString(source.logLine(line))
	}
	corpus.text = []byte(text.String())
	corpus.records = make([]cpuRecord, cpuJSONRecords)
	for index := range corpus.records {
		corpus.records[index] = source.record(uint64(index))
	}
	for index := range corpus.numbers {
		corpus.numbers[index] = random.Uint64()
	}
	for index := range corpus.left {
		corpus.left[index] = cpuMatrixValueSpan*random.Float64() - cpuMatrixValueOffset
		corpus.right[index] = cpuMatrixValueSpan*random.Float64() - cpuMatrixValueOffset
	}
	return corpus
}

func (source cpuTextSource) word() string {
	return source.vocabulary[source.zipf.Uint64()]
}

func (source cpuTextSource) message() string {
	words := make([]string, cpuMessageMinWords+source.random.IntN(cpuMessageMaxWords-cpuMessageMinWords+1))
	for index := range words {
		words[index] = source.word()
	}
	return strings.Join(words, " ")
}

func (source cpuTextSource) email() string {
	return source.word() + "@" + source.word() + "." + source.topLevelDomains[source.random.IntN(len(source.topLevelDomains))]
}

func (source cpuTextSource) logLine(line int) string {
	timestamp := time.Unix(cpuLogEpoch+int64(line)*cpuLogStepSeconds, 0).UTC().Format(time.RFC3339)
	octet := func() int { return source.random.IntN(cpuAddressOctetLimit) }
	return fmt.Sprintf(cpuLogLine, timestamp, source.levels[source.random.IntN(len(source.levels))], source.word(), source.email(),
		octet(), octet(), octet(), octet(), source.message())
}

func (source cpuTextSource) record(id uint64) cpuRecord {
	tags := make([]string, cpuRecordTags)
	for index := range tags {
		tags[index] = source.word()
	}
	return cpuRecord{
		ID: id, User: source.word(), Email: source.email(), Level: source.levels[source.random.IntN(len(source.levels))],
		Message: source.message(), Tags: tags, Score: source.random.Float64(), Active: source.random.IntN(cpuActiveOdds) == 0,
	}
}
