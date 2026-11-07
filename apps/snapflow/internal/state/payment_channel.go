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

// PaymentChannel is the latest verified voucher of one payment channel paying
// for a sandbox on this machine, and the payment hold placed on that sandbox.
type PaymentChannel struct {
	ChannelID string
	SandboxID string
	LeaseID   string
	State     apiclient.PaymentChannelState
	// Voucher and Domain are nil until the first voucher is accepted.
	Voucher *apiclient.MachineSignedVoucher
	Domain  *apiclient.EscrowDomain
	// HoldWindow is how long the sandbox may run without a newly accepted
	// voucher, kept so a restart while the API is unreachable still enforces it.
	HoldWindow time.Duration
	// AcceptedAt is when this machine accepted Voucher; zero without one.
	AcceptedAt time.Time
	// HeldAt is when the sandbox was held for payment; zero when it is not.
	HeldAt time.Time
}

func (channel PaymentChannel) validate() error {
	if channel.ChannelID == "" || channel.SandboxID == "" || channel.LeaseID == "" {
		return errors.New("payment channel record requires a channel, sandbox and lease")
	}
	if !channel.State.Valid() {
		return fmt.Errorf("payment channel %s has unknown state %q", channel.ChannelID, channel.State)
	}
	if (channel.Voucher == nil) != (channel.Domain == nil) || (channel.Voucher == nil) != channel.AcceptedAt.IsZero() {
		return fmt.Errorf("payment channel %s must store a voucher with its domain and acceptance time", channel.ChannelID)
	}
	if channel.HoldWindow <= 0 {
		return fmt.Errorf("payment channel %s requires a positive hold window", channel.ChannelID)
	}
	return nil
}

const paymentChannelColumns = `channel_id, sandbox_id, lease_id, state, voucher, domain,
	hold_window_ms, accepted_at, held_at`

// ReplacePaymentChannels stores the channels of the latest accepted document
// and forgets every channel it no longer lists. Holds are kept: only
// SetPaymentHold changes them.
func (database *Database) ReplacePaymentChannels(ctx context.Context, channels []PaymentChannel) error {
	stored, err := database.LoadPaymentChannels(ctx)
	if err != nil {
		return err
	}
	listed := make(map[string]bool, len(channels))
	for _, channel := range channels {
		listed[channel.ChannelID] = true
	}
	return database.inTransaction(ctx, "replacement of payment channels", func(transaction *sql.Tx) error {
		updatedAt := time.Now().UnixMilli()
		for _, channel := range channels {
			if err := savePaymentChannel(ctx, transaction, channel, updatedAt); err != nil {
				return err
			}
		}
		for _, channel := range stored {
			if listed[channel.ChannelID] {
				continue
			}
			if _, err := transaction.ExecContext(
				ctx, "DELETE FROM machine_payment_channel WHERE channel_id = ?", channel.ChannelID,
			); err != nil {
				return fmt.Errorf("forget payment channel %s: %w", channel.ChannelID, err)
			}
		}
		return nil
	})
}

func savePaymentChannel(ctx context.Context, transaction *sql.Tx, channel PaymentChannel, updatedAt int64) error {
	if err := channel.validate(); err != nil {
		return err
	}
	voucher, err := optionalJSON(channel.Voucher)
	if err != nil {
		return fmt.Errorf("encode payment channel %s voucher: %w", channel.ChannelID, err)
	}
	domain, err := optionalJSON(channel.Domain)
	if err != nil {
		return fmt.Errorf("encode payment channel %s domain: %w", channel.ChannelID, err)
	}
	if _, err := transaction.ExecContext(
		ctx, `
		INSERT INTO machine_payment_channel (`+paymentChannelColumns+`, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
		ON CONFLICT(channel_id) DO UPDATE SET
			sandbox_id = excluded.sandbox_id,
			lease_id = excluded.lease_id,
			state = excluded.state,
			voucher = excluded.voucher,
			domain = excluded.domain,
			hold_window_ms = excluded.hold_window_ms,
			accepted_at = excluded.accepted_at,
			updated_at = excluded.updated_at
	`,
		channel.ChannelID, channel.SandboxID, channel.LeaseID, string(channel.State), voucher, domain,
		channel.HoldWindow.Milliseconds(), optionalMilliseconds(channel.AcceptedAt), updatedAt,
	); err != nil {
		return fmt.Errorf("save payment channel %s: %w", channel.ChannelID, err)
	}
	return nil
}

// SetPaymentHold holds every channel row of the sandbox from heldAt, or
// releases them when heldAt is zero.
func (database *Database) SetPaymentHold(ctx context.Context, sandboxID string, heldAt time.Time) error {
	if _, err := database.sql.ExecContext(
		ctx, "UPDATE machine_payment_channel SET held_at = ? WHERE sandbox_id = ?",
		optionalMilliseconds(heldAt), sandboxID,
	); err != nil {
		return fmt.Errorf("set the payment hold of sandbox %s: %w", sandboxID, err)
	}
	return nil
}

func (database *Database) LoadPaymentChannels(ctx context.Context) ([]PaymentChannel, error) {
	return queryAll(ctx, database, "payment channels",
		"SELECT "+paymentChannelColumns+" FROM machine_payment_channel ORDER BY sandbox_id, channel_id",
		scanPaymentChannel)
}

// InspectPaymentChannels reads the stored channels without opening the
// database for writing, so the CLI can run next to the daemon.
func InspectPaymentChannels(ctx context.Context, stateDirectory string) (channels []PaymentChannel, resultErr error) {
	database, err := openDatabaseReadOnly(ctx, stateDirectory)
	if err != nil {
		return nil, fmt.Errorf("open Snapflow state: %w", err)
	}
	defer func() {
		if closeErr := database.Close(ctx); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close Snapflow state: %w", closeErr))
		}
	}()
	return database.LoadPaymentChannels(ctx)
}

func scanPaymentChannel(rows *sql.Rows) (PaymentChannel, error) {
	var (
		channel      PaymentChannel
		state        string
		voucher      sql.NullString
		domain       sql.NullString
		holdWindowMs int64
		acceptedAt   sql.NullInt64
		heldAt       sql.NullInt64
	)
	if err := rows.Scan(
		&channel.ChannelID, &channel.SandboxID, &channel.LeaseID, &state, &voucher, &domain,
		&holdWindowMs, &acceptedAt, &heldAt,
	); err != nil {
		return PaymentChannel{}, fmt.Errorf("read payment channel: %w", err)
	}
	channel.State = apiclient.PaymentChannelState(state)
	channel.HoldWindow = time.Duration(holdWindowMs) * time.Millisecond
	channel.AcceptedAt = fromOptionalMilliseconds(acceptedAt)
	channel.HeldAt = fromOptionalMilliseconds(heldAt)
	if voucher.Valid {
		channel.Voucher = &apiclient.MachineSignedVoucher{}
		if err := json.Unmarshal([]byte(voucher.String), channel.Voucher); err != nil {
			return PaymentChannel{}, fmt.Errorf("decode payment channel %s voucher: %w", channel.ChannelID, err)
		}
	}
	if domain.Valid {
		channel.Domain = &apiclient.EscrowDomain{}
		if err := json.Unmarshal([]byte(domain.String), channel.Domain); err != nil {
			return PaymentChannel{}, fmt.Errorf("decode payment channel %s domain: %w", channel.ChannelID, err)
		}
	}
	return channel, nil
}

func optionalJSON[T any](value *T) (sql.NullString, error) {
	if value == nil {
		return sql.NullString{}, nil
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return sql.NullString{}, err
	}
	return sql.NullString{String: string(encoded), Valid: true}, nil
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
