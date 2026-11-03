// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	operationSucceeded = "success"
	operationFailed    = "failure"

	operationLabel = "operation"
	statusLabel    = "status"
	modeLabel      = "mode"

	durationBucketStart  = 0.01
	durationBucketFactor = 2
	durationBucketCount  = 13
)

type Metrics struct {
	operations *prometheus.CounterVec
	durations  *prometheus.HistogramVec
}

func NewMetrics(registerer prometheus.Registerer) (*Metrics, error) {
	metrics := &Metrics{
		operations: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "snapflow_runtime_operation_total",
				Help: "Total number of sandbox runtime operations.",
			},
			[]string{operationLabel, statusLabel},
		),
		durations: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "snapflow_runtime_operation_duration_seconds",
				Help:    "Duration of sandbox runtime operations.",
				Buckets: prometheus.ExponentialBuckets(durationBucketStart, durationBucketFactor, durationBucketCount),
			},
			[]string{operationLabel, statusLabel, modeLabel},
		),
	}
	for _, collector := range []prometheus.Collector{metrics.operations, metrics.durations} {
		if err := registerer.Register(collector); err != nil {
			return nil, fmt.Errorf("register sandbox runtime metrics: %w", err)
		}
	}
	return metrics, nil
}

func (metrics *Metrics) observe(operation, mode string, elapsed time.Duration, err error) {
	status := operationSucceeded
	if err != nil {
		status = operationFailed
	}
	metrics.operations.WithLabelValues(operation, status).Inc()
	metrics.durations.WithLabelValues(operation, status, mode).Observe(elapsed.Seconds())
}
