// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package network

import "strings"

func miningPoolDomains() []string {
	return []string{
		"2miners.com", "antpool.com", "bohemianpool.com", "braiins.com", "pool.btc.com", "c3pool.com", "c3pool.org",
		"coinhive.com", "crypto-pool.fr", "dwarfpool.com", "emcd.io", "ethermine.org", "ezil.me", "f2pool.com",
		"flexpool.io", "hashvault.pro", "herominers.com", "hiveon.net", "kryptex.network", "minergate.com",
		"minemonero.pro", "minexmr.com", "mining-dutch.nl", "miningpoolhub.com", "moneroocean.stream",
		"monerohash.com", "nanopool.org", "nicehash.com", "pool.binance.com", "poolin.com", "prohashing.com",
		"rplant.xyz", "slushpool.com", "supportxmr.com", "unmineable.com", "viabtc.com", "woolypooly.com",
		"xmrfast.com", "xmrpool.eu", "xmrpool.net", "zergpool.com", "zpool.ca",
	}
}

func miningPoolHosts() []string {
	return []string{
		"pool.supportxmr.com", "gulf.moneroocean.stream", "xmr-eu1.nanopool.org", "xmr-eu2.nanopool.org",
		"xmr-us-east1.nanopool.org", "xmr-us-west1.nanopool.org", "xmr-asia1.nanopool.org",
		"pool.hashvault.pro", "auto.c3pool.org", "xmr.2miners.com", "etc.2miners.com", "rvn.2miners.com",
		"kas.2miners.com", "randomxmonero.auto.nicehash.com", "kawpow.auto.nicehash.com",
		"autolykos.auto.nicehash.com", "etchash.auto.nicehash.com", "xmr.f2pool.com", "btc.f2pool.com",
		"monero.herominers.com", "rx.unmineable.com", "stratum.antpool.com", "btc.viabtc.com",
		"stratum.braiins.com", "xmr.kryptex.network", "pool.xmrpool.eu", "xmr.zergpool.com",
		"randomx.rplant.xyz", "xmr.pool.minergate.com",
	}
}

func isMiningPoolDomain(name string) bool {
	name = strings.ToLower(strings.TrimSuffix(name, "."))
	for _, domain := range miningPoolDomains() {
		if name == domain || strings.HasSuffix(name, "."+domain) {
			return true
		}
	}
	return false
}
