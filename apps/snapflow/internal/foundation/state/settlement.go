// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const settlementEscrowSingletonID = 1

type SettlementEscrow struct {
	Domain        apiclient.EscrowDomain
	Windows       apiclient.EscrowWindows
	HoldWindow    time.Duration
	PayoutMinimum string
}

type SettlementChannel struct {
	Channel    apiclient.MachineSettlementChannel
	AcceptedAt time.Time
}

func (channel SettlementChannel) ID() string { return channel.Channel.PaymentChannelId.String() }

type PaymentHold struct {
	HeldAt time.Time `json:"heldAt"`
	Reason string    `json:"reason"`
	Detail string    `json:"detail"`
}

type SandboxPaymentHold struct {
	SandboxID string `json:"sandboxId"`
	PaymentHold
}

func (channel SettlementChannel) validate() error {
	if (channel.Channel.Voucher == nil) != channel.AcceptedAt.IsZero() {
		return fmt.Errorf("settlement channel %s must store its voucher with the acceptance time", channel.ID())
	}
	return nil
}

func (escrow SettlementEscrow) validate() error {
	if escrow.HoldWindow <= 0 {
		return errors.New("the settlement escrow requires a positive hold window")
	}
	if escrow.PayoutMinimum == "" {
		return errors.New("the settlement escrow requires a payout minimum")
	}
	return nil
}

func (database *Database) ReplaceSettlement(ctx context.Context, escrow SettlementEscrow, channels []SettlementChannel) error {
	if err := escrow.validate(); err != nil {
		return err
	}
	listed := make([]string, 0, len(channels))
	for _, channel := range channels {
		listed = append(listed, channel.ID())
	}
	listedJSON, err := json.Marshal(listed)
	if err != nil {
		return fmt.Errorf("encode listed settlement channels: %w", err)
	}
	return database.inTransaction(ctx, "replacement of settlement channels", func(transaction *sql.Tx) error {
		updatedAt := time.Now().UnixMilli()
		if err := saveSettlementEscrow(ctx, transaction, escrow, updatedAt); err != nil {
			return err
		}
		for _, channel := range channels {
			if err := saveSettlementChannel(ctx, transaction, channel, updatedAt); err != nil {
				return err
			}
		}
		if _, err := transaction.ExecContext(
			ctx,
			"DELETE FROM machine_settlement_channel WHERE payment_channel_id NOT IN (SELECT value FROM json_each(?))",
			string(listedJSON),
		); err != nil {
			return fmt.Errorf("forget unlisted settlement channels: %w", err)
		}
		return nil
	})
}

func saveSettlementEscrow(ctx context.Context, transaction *sql.Tx, escrow SettlementEscrow, updatedAt int64) error {
	domain, err := json.Marshal(escrow.Domain)
	if err != nil {
		return fmt.Errorf("encode settlement escrow domain: %w", err)
	}
	windows, err := json.Marshal(escrow.Windows)
	if err != nil {
		return fmt.Errorf("encode settlement escrow windows: %w", err)
	}
	if _, err := transaction.ExecContext(
		ctx, `
		INSERT INTO machine_settlement_escrow (
			singleton_id, domain, windows, hold_window_ms, payout_minimum, updated_at
		) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(singleton_id) DO UPDATE SET
			domain = excluded.domain,
			windows = excluded.windows,
			hold_window_ms = excluded.hold_window_ms,
			payout_minimum = excluded.payout_minimum,
			updated_at = excluded.updated_at
	`, settlementEscrowSingletonID, string(domain), string(windows), escrow.HoldWindow.Milliseconds(),
		escrow.PayoutMinimum, updatedAt,
	); err != nil {
		return fmt.Errorf("save settlement escrow: %w", err)
	}
	return nil
}

func saveSettlementChannel(ctx context.Context, transaction *sql.Tx, channel SettlementChannel, updatedAt int64) error {
	if err := channel.validate(); err != nil {
		return err
	}
	encoded, err := json.Marshal(channel.Channel)
	if err != nil {
		return fmt.Errorf("encode settlement channel %s: %w", channel.ID(), err)
	}
	if _, err := transaction.ExecContext(
		ctx, `
		INSERT INTO machine_settlement_channel (payment_channel_id, channel, accepted_at, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(payment_channel_id) DO UPDATE SET
			channel = excluded.channel,
			accepted_at = excluded.accepted_at,
			updated_at = excluded.updated_at
	`, channel.ID(), string(encoded), optionalMilliseconds(channel.AcceptedAt), updatedAt,
	); err != nil {
		return fmt.Errorf("save settlement channel %s: %w", channel.ID(), err)
	}
	return nil
}

func (database *Database) SetPaymentHold(ctx context.Context, sandboxID string, hold PaymentHold) error {
	var err error
	if hold.HeldAt.IsZero() {
		_, err = database.sql.ExecContext(ctx, "DELETE FROM machine_payment_hold WHERE sandbox_id = ?", sandboxID)
	} else {
		_, err = database.sql.ExecContext(ctx, `
			INSERT INTO machine_payment_hold (sandbox_id, held_at, reason, detail) VALUES (?, ?, ?, ?)
			ON CONFLICT(sandbox_id) DO UPDATE SET
				held_at = excluded.held_at, reason = excluded.reason, detail = excluded.detail
		`, sandboxID, hold.HeldAt.UnixMilli(), hold.Reason, hold.Detail)
	}
	if err != nil {
		return fmt.Errorf("set the payment hold of sandbox %s: %w", sandboxID, err)
	}
	return nil
}

func (database *Database) LoadPaymentHolds(ctx context.Context) ([]SandboxPaymentHold, error) {
	holds, err := queryAll(ctx, database, "payment holds",
		"SELECT sandbox_id, held_at, reason, detail FROM machine_payment_hold ORDER BY sandbox_id", scanPaymentHold)
	if err != nil {
		return nil, err
	}
	if holds == nil {
		holds = []SandboxPaymentHold{}
	}
	return holds, nil
}

func (database *Database) LoadSettlement(ctx context.Context) (*SettlementEscrow, []SettlementChannel, error) {
	escrow, err := database.loadSettlementEscrow(ctx)
	if err != nil {
		return nil, nil, err
	}
	channels, err := queryAll(ctx, database, "settlement channels",
		"SELECT payment_channel_id, channel, accepted_at FROM machine_settlement_channel ORDER BY payment_channel_id",
		scanSettlementChannel)
	if err != nil {
		return nil, nil, err
	}
	return escrow, channels, nil
}

func (database *Database) loadSettlementEscrow(ctx context.Context) (*SettlementEscrow, error) {
	var (
		escrow          SettlementEscrow
		domain, windows string
		holdWindowMs    int64
	)
	err := database.sql.QueryRowContext(ctx, `
		SELECT domain, windows, hold_window_ms, payout_minimum
		FROM machine_settlement_escrow WHERE singleton_id = ?
	`, settlementEscrowSingletonID).Scan(&domain, &windows, &holdWindowMs, &escrow.PayoutMinimum)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load settlement escrow: %w", err)
	}
	if err := json.Unmarshal([]byte(domain), &escrow.Domain); err != nil {
		return nil, fmt.Errorf("decode settlement escrow domain: %w", err)
	}
	if err := json.Unmarshal([]byte(windows), &escrow.Windows); err != nil {
		return nil, fmt.Errorf("decode settlement escrow windows: %w", err)
	}
	escrow.HoldWindow = time.Duration(holdWindowMs) * time.Millisecond
	return &escrow, nil
}

func InspectPaymentHolds(ctx context.Context, stateDirectory string) (holds []SandboxPaymentHold, resultErr error) {
	database, err := openDatabaseReadOnly(ctx, stateDirectory)
	if err != nil {
		return nil, fmt.Errorf("open Snapflow state: %w", err)
	}
	defer func() {
		if closeErr := database.Close(ctx); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close Snapflow state: %w", closeErr))
		}
	}()
	return database.LoadPaymentHolds(ctx)
}

func scanSettlementChannel(rows *sql.Rows) (SettlementChannel, error) {
	var (
		channel    SettlementChannel
		channelID  string
		encoded    string
		acceptedAt sql.NullInt64
	)
	if err := rows.Scan(&channelID, &encoded, &acceptedAt); err != nil {
		return SettlementChannel{}, fmt.Errorf("read settlement channel: %w", err)
	}
	if err := json.Unmarshal([]byte(encoded), &channel.Channel); err != nil {
		return SettlementChannel{}, fmt.Errorf("decode settlement channel %s: %w", channelID, err)
	}
	channel.AcceptedAt = fromOptionalMilliseconds(acceptedAt)
	return channel, nil
}

func scanPaymentHold(rows *sql.Rows) (SandboxPaymentHold, error) {
	var (
		hold   SandboxPaymentHold
		heldAt int64
	)
	if err := rows.Scan(&hold.SandboxID, &heldAt, &hold.Reason, &hold.Detail); err != nil {
		return SandboxPaymentHold{}, fmt.Errorf("read payment hold: %w", err)
	}
	hold.HeldAt = time.UnixMilli(heldAt)
	return hold, nil
}

func optionalMilliseconds(at time.Time) sql.NullInt64 {
	if at.IsZero() {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: at.UnixMilli(), Valid: true}
}

func fromOptionalMilliseconds(value sql.NullInt64) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return time.UnixMilli(value.Int64)
}
