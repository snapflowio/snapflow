// Code generated via abigen V2 - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package escrow

import (
	"bytes"
	"errors"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind/v2"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = bytes.Equal
	_ = errors.New
	_ = big.NewInt
	_ = common.Big1
	_ = types.BloomLookup
	_ = abi.ConvertType
)

// Account is an auto generated low-level Go binding around an user-defined struct.
type Account struct {
	Free     *big.Int
	Pending  *big.Int
	UnlockAt uint64
}

// AccountBlock is an auto generated low-level Go binding around an user-defined struct.
type AccountBlock struct {
	BlockedAt uint64
	Until     uint64
	Reason    uint8
}

// AutoTopUp is an auto generated low-level Go binding around an user-defined struct.
type AutoTopUp struct {
	Relayer     common.Address
	MinInterval uint32
	LastTopUpAt uint64
	Amount      *big.Int
	Threshold   *big.Int
	MaxRelayFee *big.Int
}

// ClaimItem is an auto generated low-level Go binding around an user-defined struct.
type ClaimItem struct {
	Voucher   Voucher
	Signature []byte
	Signer    common.Address
	MaxAmount *big.Int
}

// ClaimsFreeze is an auto generated low-level Go binding around an user-defined struct.
type ClaimsFreeze struct {
	Since       uint64
	Until       uint64
	Accumulated uint64
	Armed       bool
}

// DepositCaps is an auto generated low-level Go binding around an user-defined struct.
type DepositCaps struct {
	Total      *big.Int
	PerAccount *big.Int
}

// EscrowRoles is an auto generated low-level Go binding around an user-defined struct.
type EscrowRoles struct {
	Admin         common.Address
	Pauser        common.Address
	Guardian      common.Address
	ClaimsFreezer common.Address
	Compliance    common.Address
}

// EscrowWindows is an auto generated low-level Go binding around an user-defined struct.
type EscrowWindows struct {
	WithdrawalDelay  uint64
	ClaimWindow      uint64
	SignerThawPeriod uint64
}

// SignerGrant is an auto generated low-level Go binding around an user-defined struct.
type SignerGrant struct {
	Customer           common.Address
	Expiry             uint64
	Revoked            bool
	MaxFeeBps          uint16
	HourlyCap          *big.Int
	PendingHourlyCap   *big.Int
	UpdatedAt          uint64
	Available          *big.Int
	PendingEffectiveAt uint64
	ThawEnd            uint64
	FreezeOffset       uint64
	Remainder          uint16
	Host               common.Address
}

// SignerScope is an auto generated low-level Go binding around an user-defined struct.
type SignerScope struct {
	HourlyCap *big.Int
	Expiry    uint64
	MaxFeeBps uint16
	Host      common.Address
}

// Voucher is an auto generated low-level Go binding around an user-defined struct.
type Voucher struct {
	Customer         common.Address
	Host             common.Address
	FeeReceiver      common.Address
	FeeBps           uint16
	Salt             [32]byte
	CumulativeAmount *big.Int
	Timestamp        uint64
	Metadata         [32]byte
}

// SnapflowEscrowMetaData contains all meta data concerning the SnapflowEscrow contract.
var SnapflowEscrowMetaData = bind.MetaData{
	ABI: "[{\"type\":\"constructor\",\"inputs\":[{\"name\":\"token_\",\"type\":\"address\",\"internalType\":\"contractIERC20\"},{\"name\":\"roles\",\"type\":\"tuple\",\"internalType\":\"structEscrowRoles\",\"components\":[{\"name\":\"admin\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"pauser\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"guardian\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"claimsFreezer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"compliance\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"name\":\"windows\",\"type\":\"tuple\",\"internalType\":\"structEscrowWindows\",\"components\":[{\"name\":\"withdrawalDelay\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"claimWindow\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"signerThawPeriod\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"name\":\"caps\",\"type\":\"tuple\",\"internalType\":\"structDepositCaps\",\"components\":[{\"name\":\"total\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"perAccount\",\"type\":\"uint128\",\"internalType\":\"uint128\"}]}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"CLAIMS_FREEZE_ROLE\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"COMPLIANCE_ROLE\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"DEFAULT_ADMIN_ROLE\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"PAUSER_ROLE\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"acceptDefaultAdminTransfer\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"accountOf\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structAccount\",\"components\":[{\"name\":\"free\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"pending\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"unlockAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"authorizeSigner\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"scope\",\"type\":\"tuple\",\"internalType\":\"structSignerScope\",\"components\":[{\"name\":\"hourlyCap\",\"type\":\"uint96\",\"internalType\":\"uint96\"},{\"name\":\"expiry\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"maxFeeBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"name\":\"proofDeadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"proof\",\"type\":\"bytes\",\"internalType\":\"bytes\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"autoTopUp\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"relayFee\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"autoTopUpOf\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structAutoTopUp\",\"components\":[{\"name\":\"relayer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"minInterval\",\"type\":\"uint32\",\"internalType\":\"uint32\"},{\"name\":\"lastTopUpAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"amount\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"threshold\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"maxRelayFee\",\"type\":\"uint128\",\"internalType\":\"uint128\"}]}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"availableOf\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"beginDefaultAdminTransfer\",\"inputs\":[{\"name\":\"newAdmin\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"blockAccount\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"reason\",\"type\":\"uint8\",\"internalType\":\"enumBlockReason\"},{\"name\":\"duration\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"blockOf\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structAccountBlock\",\"components\":[{\"name\":\"blockedAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"until\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"reason\",\"type\":\"uint8\",\"internalType\":\"enumBlockReason\"}]}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"blockedAt\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"cancelDefaultAdminTransfer\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"cancelWithdrawal\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"changeDefaultAdminDelay\",\"inputs\":[{\"name\":\"newDelay\",\"type\":\"uint48\",\"internalType\":\"uint48\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"channelIdOf\",\"inputs\":[{\"name\":\"voucher\",\"type\":\"tuple\",\"internalType\":\"structVoucher\",\"components\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"feeReceiver\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"feeBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"salt\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"cumulativeAmount\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"timestamp\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"metadata\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]}],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"claim\",\"inputs\":[{\"name\":\"voucher\",\"type\":\"tuple\",\"internalType\":\"structVoucher\",\"components\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"feeReceiver\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"feeBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"salt\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"cumulativeAmount\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"timestamp\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"metadata\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"name\":\"signature\",\"type\":\"bytes\",\"internalType\":\"bytes\"},{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"maxAmount\",\"type\":\"uint128\",\"internalType\":\"uint128\"}],\"outputs\":[{\"name\":\"paid\",\"type\":\"uint128\",\"internalType\":\"uint128\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"claimBatch\",\"inputs\":[{\"name\":\"items\",\"type\":\"tuple[]\",\"internalType\":\"structClaimItem[]\",\"components\":[{\"name\":\"voucher\",\"type\":\"tuple\",\"internalType\":\"structVoucher\",\"components\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"feeReceiver\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"feeBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"salt\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"cumulativeAmount\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"timestamp\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"metadata\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"name\":\"signature\",\"type\":\"bytes\",\"internalType\":\"bytes\"},{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"maxAmount\",\"type\":\"uint128\",\"internalType\":\"uint128\"}]}],\"outputs\":[{\"name\":\"totalPaid\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"claimBatchAndWithdraw\",\"inputs\":[{\"name\":\"items\",\"type\":\"tuple[]\",\"internalType\":\"structClaimItem[]\",\"components\":[{\"name\":\"voucher\",\"type\":\"tuple\",\"internalType\":\"structVoucher\",\"components\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"feeReceiver\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"feeBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"salt\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"cumulativeAmount\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"timestamp\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"metadata\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"name\":\"signature\",\"type\":\"bytes\",\"internalType\":\"bytes\"},{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"maxAmount\",\"type\":\"uint128\",\"internalType\":\"uint128\"}]},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"payout\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"relayFee\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"hostSignature\",\"type\":\"bytes\",\"internalType\":\"bytes\"}],\"outputs\":[{\"name\":\"totalPaid\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"claimWindow\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"claimedOf\",\"inputs\":[{\"name\":\"channelId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint128\",\"internalType\":\"uint128\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"claimsFreeze\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structClaimsFreeze\",\"components\":[{\"name\":\"since\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"until\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"accumulated\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"armed\",\"type\":\"bool\",\"internalType\":\"bool\"}]}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"completeWithdrawal\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"defaultAdmin\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"defaultAdminDelay\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint48\",\"internalType\":\"uint48\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"defaultAdminDelayIncreaseWait\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint48\",\"internalType\":\"uint48\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"deposit\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"depositCaps\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structDepositCaps\",\"components\":[{\"name\":\"total\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"perAccount\",\"type\":\"uint128\",\"internalType\":\"uint128\"}]}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"depositFor\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"depositWithAuthorization\",\"inputs\":[{\"name\":\"payer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"relayFee\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"validAfter\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"validBefore\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"salt\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"signature\",\"type\":\"bytes\",\"internalType\":\"bytes\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"depositWithPermit\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"v\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"r\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"s\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"disableAutoTopUp\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"eip712Domain\",\"inputs\":[],\"outputs\":[{\"name\":\"fields\",\"type\":\"bytes1\",\"internalType\":\"bytes1\"},{\"name\":\"name\",\"type\":\"string\",\"internalType\":\"string\"},{\"name\":\"version\",\"type\":\"string\",\"internalType\":\"string\"},{\"name\":\"chainId\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"verifyingContract\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"salt\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"extensions\",\"type\":\"uint256[]\",\"internalType\":\"uint256[]\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"feesAccruedOf\",\"inputs\":[{\"name\":\"feeReceiver\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"freezeClaims\",\"inputs\":[{\"name\":\"duration\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"frozenBalanceOf\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getRoleAdmin\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"grantRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"hasRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"hostBalanceOf\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"hostWithdrawalDigest\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"payout\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"relayer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"relayFee\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"nonce\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"hostWithdrawalNonceOf\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"lowerSignerLimit\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"hourlyCap\",\"type\":\"uint96\",\"internalType\":\"uint96\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"maxDepositOf\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"owner\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"pause\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"paused\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"payoutAddressDigest\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"payout\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"nonce\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"payoutAddressOf\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"payoutNonceOf\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"pendingDefaultAdmin\",\"inputs\":[],\"outputs\":[{\"name\":\"newAdmin\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"schedule\",\"type\":\"uint48\",\"internalType\":\"uint48\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"pendingDefaultAdminDelay\",\"inputs\":[],\"outputs\":[{\"name\":\"newDelay\",\"type\":\"uint48\",\"internalType\":\"uint48\"},{\"name\":\"schedule\",\"type\":\"uint48\",\"internalType\":\"uint48\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"raiseSignerLimit\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"hourlyCap\",\"type\":\"uint96\",\"internalType\":\"uint96\"},{\"name\":\"expiry\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"rearmClaimsFreeze\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"recoverSurplus\",\"inputs\":[{\"name\":\"to\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"releaseFrozen\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"renounceRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"requestWithdrawal\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"revokeRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"revokeSigner\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"rollbackDefaultAdminDelay\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setAutoTopUp\",\"inputs\":[{\"name\":\"relayer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"threshold\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"maxRelayFee\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"minInterval\",\"type\":\"uint32\",\"internalType\":\"uint32\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setDepositCaps\",\"inputs\":[{\"name\":\"caps\",\"type\":\"tuple\",\"internalType\":\"structDepositCaps\",\"components\":[{\"name\":\"total\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"perAccount\",\"type\":\"uint128\",\"internalType\":\"uint128\"}]}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setPayoutAddress\",\"inputs\":[{\"name\":\"payout\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setPayoutAddressWithSig\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"payout\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"signature\",\"type\":\"bytes\",\"internalType\":\"bytes\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"signerOf\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structSignerGrant\",\"components\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"expiry\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"revoked\",\"type\":\"bool\",\"internalType\":\"bool\"},{\"name\":\"maxFeeBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"hourlyCap\",\"type\":\"uint96\",\"internalType\":\"uint96\"},{\"name\":\"pendingHourlyCap\",\"type\":\"uint96\",\"internalType\":\"uint96\"},{\"name\":\"updatedAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"available\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"pendingEffectiveAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"thawEnd\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"freezeOffset\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"remainder\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"}]}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"signerThawPeriod\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"supportsInterface\",\"inputs\":[{\"name\":\"interfaceId\",\"type\":\"bytes4\",\"internalType\":\"bytes4\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"sweepFees\",\"inputs\":[{\"name\":\"feeReceiver\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"thawSigner\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"token\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"contractIERC20\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"totalHeld\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"unblockAccount\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"unfrozenTime\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"unpause\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"voucherDigest\",\"inputs\":[{\"name\":\"voucher\",\"type\":\"tuple\",\"internalType\":\"structVoucher\",\"components\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"feeReceiver\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"feeBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"salt\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"cumulativeAmount\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"timestamp\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"metadata\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]}],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"withdrawHost\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"withdrawHostWithSig\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"payout\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"relayFee\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"signature\",\"type\":\"bytes\",\"internalType\":\"bytes\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"withdrawalDelay\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"stateMutability\":\"view\"},{\"type\":\"event\",\"name\":\"AccountBlocked\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"reason\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"enumBlockReason\"},{\"name\":\"blockedAt\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"},{\"name\":\"until\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"AccountUnblocked\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"AutoTopUpDisabled\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"AutoTopUpExecuted\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"relayer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"relayFee\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"AutoTopUpSet\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"relayer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"},{\"name\":\"threshold\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"},{\"name\":\"maxRelayFee\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"},{\"name\":\"minInterval\",\"type\":\"uint32\",\"indexed\":false,\"internalType\":\"uint32\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ClaimResult\",\"inputs\":[{\"name\":\"channelId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"paid\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"},{\"name\":\"reason\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"enumClaimFailure\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Claimed\",\"inputs\":[{\"name\":\"channelId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"host\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"signer\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"},{\"name\":\"feeReceiver\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"},{\"name\":\"paid\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"},{\"name\":\"fee\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"},{\"name\":\"claimed\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ClaimsFreezeRearmed\",\"inputs\":[],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ClaimsFrozen\",\"inputs\":[{\"name\":\"by\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"until\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"DefaultAdminDelayChangeCanceled\",\"inputs\":[],\"anonymous\":false},{\"type\":\"event\",\"name\":\"DefaultAdminDelayChangeScheduled\",\"inputs\":[{\"name\":\"newDelay\",\"type\":\"uint48\",\"indexed\":false,\"internalType\":\"uint48\"},{\"name\":\"effectSchedule\",\"type\":\"uint48\",\"indexed\":false,\"internalType\":\"uint48\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"DefaultAdminTransferCanceled\",\"inputs\":[],\"anonymous\":false},{\"type\":\"event\",\"name\":\"DefaultAdminTransferScheduled\",\"inputs\":[{\"name\":\"newAdmin\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"acceptSchedule\",\"type\":\"uint48\",\"indexed\":false,\"internalType\":\"uint48\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"DepositCapsSet\",\"inputs\":[{\"name\":\"total\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"},{\"name\":\"perAccount\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Deposited\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"payer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"EIP712DomainChanged\",\"inputs\":[],\"anonymous\":false},{\"type\":\"event\",\"name\":\"FeesSwept\",\"inputs\":[{\"name\":\"feeReceiver\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Frozen\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"FrozenReleased\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"HostWithdrawn\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"payout\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Paused\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"PayoutAddressSet\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"payout\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RelayFeePaid\",\"inputs\":[{\"name\":\"relayer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"payer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RoleAdminChanged\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"previousAdminRole\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"newAdminRole\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RoleGranted\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"sender\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RoleRevoked\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"sender\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"SignerAuthorized\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"signer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"hourlyCap\",\"type\":\"uint96\",\"indexed\":false,\"internalType\":\"uint96\"},{\"name\":\"expiry\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"},{\"name\":\"maxFeeBps\",\"type\":\"uint16\",\"indexed\":false,\"internalType\":\"uint16\"},{\"name\":\"host\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"SignerLimitLowerScheduled\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"signer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"hourlyCap\",\"type\":\"uint96\",\"indexed\":false,\"internalType\":\"uint96\"},{\"name\":\"effectiveAt\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"SignerLimitRaised\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"signer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"hourlyCap\",\"type\":\"uint96\",\"indexed\":false,\"internalType\":\"uint96\"},{\"name\":\"expiry\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"SignerRevoked\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"signer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"SignerThawed\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"signer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"thawEnd\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"SurplusRecovered\",\"inputs\":[{\"name\":\"to\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Unpaused\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"WithdrawalCancelled\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"WithdrawalRequested\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"pending\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"},{\"name\":\"unlockAt\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Withdrawn\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"error\",\"name\":\"AccessControlBadConfirmation\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"AccessControlEnforcedDefaultAdminDelay\",\"inputs\":[{\"name\":\"schedule\",\"type\":\"uint48\",\"internalType\":\"uint48\"}]},{\"type\":\"error\",\"name\":\"AccessControlEnforcedDefaultAdminRules\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"AccessControlInvalidDefaultAdmin\",\"inputs\":[{\"name\":\"defaultAdmin\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"AccessControlUnauthorizedAccount\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"neededRole\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"AccountDepositCapExceeded\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"room\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"AccountNotBlocked\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"AdminDelayTooShort\",\"inputs\":[{\"name\":\"delay\",\"type\":\"uint48\",\"internalType\":\"uint48\"},{\"name\":\"minDelay\",\"type\":\"uint48\",\"internalType\":\"uint48\"}]},{\"type\":\"error\",\"name\":\"AutoTopUpIntervalTooShort\",\"inputs\":[{\"name\":\"interval\",\"type\":\"uint32\",\"internalType\":\"uint32\"},{\"name\":\"minInterval\",\"type\":\"uint32\",\"internalType\":\"uint32\"}]},{\"type\":\"error\",\"name\":\"AutoTopUpNotEnabled\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"AutoTopUpNotNeeded\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"available\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"AutoTopUpTooSoon\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"nextAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"BatchTooLarge\",\"inputs\":[{\"name\":\"size\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"maxSize\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"BlockDurationOutOfRange\",\"inputs\":[{\"name\":\"duration\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"maxDuration\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"Blocked\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"ClaimWindowOutOfRange\",\"inputs\":[{\"name\":\"window\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"ClaimsAreFrozen\",\"inputs\":[{\"name\":\"until\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"ClaimsFreezeArmed\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ClaimsFreezeCoolingDown\",\"inputs\":[{\"name\":\"rearmAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"ClaimsFreezeTooLong\",\"inputs\":[{\"name\":\"duration\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"maxDuration\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"ClaimsFreezeUnavailable\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"CustomerBlockedForVoucher\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"blockedAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"EmptyBatch\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"EnforcedPause\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ExpectedPause\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"FeeAboveSignerLimit\",\"inputs\":[{\"name\":\"feeBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"maxFeeBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"}]},{\"type\":\"error\",\"name\":\"HostWithdrawalSignatureExpired\",\"inputs\":[{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"InsufficientBalance\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"InsufficientFreeBalance\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"requested\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"available\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"InvalidAutoTopUpRelayer\",\"inputs\":[{\"name\":\"relayer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"InvalidHostWithdrawalSignature\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"InvalidPayoutSignature\",\"inputs\":[{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"InvalidShortString\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidSignature\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"InvalidSigner\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"InvalidSignerProof\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"InvalidSignerScope\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidVoucherTerms\",\"inputs\":[{\"name\":\"channelId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"NoSurplus\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"NoWithdrawalPending\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"NotAuthorized\",\"inputs\":[{\"name\":\"caller\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"NothingToClaim\",\"inputs\":[{\"name\":\"channelId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"NothingToWithdraw\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"PayoutSignatureExpired\",\"inputs\":[{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"ReentrancyGuardReentrantCall\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"RelayFeeTooHigh\",\"inputs\":[{\"name\":\"relayFee\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"maxRelayFee\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"SafeCastOverflowedUintDowncast\",\"inputs\":[{\"name\":\"bits\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"value\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"SafeERC20FailedOperation\",\"inputs\":[{\"name\":\"token\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"SignerAlreadyBound\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"SignerAlreadyThawing\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"thawEnd\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"SignerCapReached\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"SignerExpired\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"SignerHostMismatch\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"SignerNotAuthorized\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"SignerNotThawing\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"SignerProofExpired\",\"inputs\":[{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"SignerStillThawing\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"thawEnd\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"SignerThawPeriodOutOfRange\",\"inputs\":[{\"name\":\"period\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"StringTooLong\",\"inputs\":[{\"name\":\"str\",\"type\":\"string\",\"internalType\":\"string\"}]},{\"type\":\"error\",\"name\":\"TotalDepositCapExceeded\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"room\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"VoucherFromFuture\",\"inputs\":[{\"name\":\"timestamp\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"WithdrawalDelayOutOfRange\",\"inputs\":[{\"name\":\"delay\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"WithdrawalLocked\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"unlockAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"ZeroAddress\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ZeroAmount\",\"inputs\":[]}]",
	ID:  "SnapflowEscrow",
}

// SnapflowEscrow is an auto generated Go binding around an Ethereum contract.
type SnapflowEscrow struct {
	abi abi.ABI
}

// GetABI returns the ABI associated with this contract binding.
func (c *SnapflowEscrow) GetABI() abi.ABI {
	return c.abi
}

// NewSnapflowEscrow creates a new instance of SnapflowEscrow.
func NewSnapflowEscrow() *SnapflowEscrow {
	parsed, err := SnapflowEscrowMetaData.ParseABI()
	if err != nil {
		panic(errors.New("invalid ABI: " + err.Error()))
	}
	return &SnapflowEscrow{abi: *parsed}
}

// Instance creates a wrapper for a deployed contract instance at the given address.
// Use this to create the instance object passed to abigen v2 library functions Call, Transact, etc.
func (c *SnapflowEscrow) Instance(backend bind.ContractBackend, addr common.Address) *bind.BoundContract {
	return bind.NewBoundContract(addr, c.abi, backend, backend, backend)
}

// PackConstructor is the Go binding used to pack the parameters required for
// contract deployment.
//
// Solidity: constructor(address token_, (address,address,address,address,address) roles, (uint64,uint64,uint64) windows, (uint128,uint128) caps) returns()
func (snapflowEscrow *SnapflowEscrow) PackConstructor(token_ common.Address, roles EscrowRoles, windows EscrowWindows, caps DepositCaps) []byte {
	enc, err := snapflowEscrow.abi.Pack("", token_, roles, windows, caps)
	if err != nil {
		panic(err)
	}
	return enc
}

// PackCLAIMSFREEZEROLE is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xb427b9d4.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function CLAIMS_FREEZE_ROLE() view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) PackCLAIMSFREEZEROLE() []byte {
	enc, err := snapflowEscrow.abi.Pack("CLAIMS_FREEZE_ROLE")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackCLAIMSFREEZEROLE is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xb427b9d4.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function CLAIMS_FREEZE_ROLE() view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) TryPackCLAIMSFREEZEROLE() ([]byte, error) {
	return snapflowEscrow.abi.Pack("CLAIMS_FREEZE_ROLE")
}

// UnpackCLAIMSFREEZEROLE is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xb427b9d4.
//
// Solidity: function CLAIMS_FREEZE_ROLE() view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) UnpackCLAIMSFREEZEROLE(data []byte) ([32]byte, error) {
	out, err := snapflowEscrow.abi.Unpack("CLAIMS_FREEZE_ROLE", data)
	if err != nil {
		return *new([32]byte), err
	}
	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)
	return out0, nil
}

// PackCOMPLIANCEROLE is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x062d3bd7.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function COMPLIANCE_ROLE() view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) PackCOMPLIANCEROLE() []byte {
	enc, err := snapflowEscrow.abi.Pack("COMPLIANCE_ROLE")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackCOMPLIANCEROLE is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x062d3bd7.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function COMPLIANCE_ROLE() view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) TryPackCOMPLIANCEROLE() ([]byte, error) {
	return snapflowEscrow.abi.Pack("COMPLIANCE_ROLE")
}

// UnpackCOMPLIANCEROLE is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x062d3bd7.
//
// Solidity: function COMPLIANCE_ROLE() view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) UnpackCOMPLIANCEROLE(data []byte) ([32]byte, error) {
	out, err := snapflowEscrow.abi.Unpack("COMPLIANCE_ROLE", data)
	if err != nil {
		return *new([32]byte), err
	}
	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)
	return out0, nil
}

// PackDEFAULTADMINROLE is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xa217fddf.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function DEFAULT_ADMIN_ROLE() view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) PackDEFAULTADMINROLE() []byte {
	enc, err := snapflowEscrow.abi.Pack("DEFAULT_ADMIN_ROLE")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackDEFAULTADMINROLE is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xa217fddf.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function DEFAULT_ADMIN_ROLE() view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) TryPackDEFAULTADMINROLE() ([]byte, error) {
	return snapflowEscrow.abi.Pack("DEFAULT_ADMIN_ROLE")
}

// UnpackDEFAULTADMINROLE is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xa217fddf.
//
// Solidity: function DEFAULT_ADMIN_ROLE() view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) UnpackDEFAULTADMINROLE(data []byte) ([32]byte, error) {
	out, err := snapflowEscrow.abi.Unpack("DEFAULT_ADMIN_ROLE", data)
	if err != nil {
		return *new([32]byte), err
	}
	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)
	return out0, nil
}

// PackPAUSERROLE is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xe63ab1e9.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function PAUSER_ROLE() view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) PackPAUSERROLE() []byte {
	enc, err := snapflowEscrow.abi.Pack("PAUSER_ROLE")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackPAUSERROLE is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xe63ab1e9.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function PAUSER_ROLE() view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) TryPackPAUSERROLE() ([]byte, error) {
	return snapflowEscrow.abi.Pack("PAUSER_ROLE")
}

// UnpackPAUSERROLE is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xe63ab1e9.
//
// Solidity: function PAUSER_ROLE() view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) UnpackPAUSERROLE(data []byte) ([32]byte, error) {
	out, err := snapflowEscrow.abi.Unpack("PAUSER_ROLE", data)
	if err != nil {
		return *new([32]byte), err
	}
	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)
	return out0, nil
}

// PackAcceptDefaultAdminTransfer is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xcefc1429.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function acceptDefaultAdminTransfer() returns()
func (snapflowEscrow *SnapflowEscrow) PackAcceptDefaultAdminTransfer() []byte {
	enc, err := snapflowEscrow.abi.Pack("acceptDefaultAdminTransfer")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackAcceptDefaultAdminTransfer is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xcefc1429.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function acceptDefaultAdminTransfer() returns()
func (snapflowEscrow *SnapflowEscrow) TryPackAcceptDefaultAdminTransfer() ([]byte, error) {
	return snapflowEscrow.abi.Pack("acceptDefaultAdminTransfer")
}

// PackAccountOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x8086b8ba.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function accountOf(address account) view returns((uint128,uint128,uint64))
func (snapflowEscrow *SnapflowEscrow) PackAccountOf(account common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("accountOf", account)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackAccountOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x8086b8ba.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function accountOf(address account) view returns((uint128,uint128,uint64))
func (snapflowEscrow *SnapflowEscrow) TryPackAccountOf(account common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("accountOf", account)
}

// UnpackAccountOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x8086b8ba.
//
// Solidity: function accountOf(address account) view returns((uint128,uint128,uint64))
func (snapflowEscrow *SnapflowEscrow) UnpackAccountOf(data []byte) (Account, error) {
	out, err := snapflowEscrow.abi.Unpack("accountOf", data)
	if err != nil {
		return *new(Account), err
	}
	out0 := *abi.ConvertType(out[0], new(Account)).(*Account)
	return out0, nil
}

// PackAuthorizeSigner is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x90e444c5.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function authorizeSigner(address signer, (uint96,uint64,uint16,address) scope, uint256 proofDeadline, bytes proof) returns()
func (snapflowEscrow *SnapflowEscrow) PackAuthorizeSigner(signer common.Address, scope SignerScope, proofDeadline *big.Int, proof []byte) []byte {
	enc, err := snapflowEscrow.abi.Pack("authorizeSigner", signer, scope, proofDeadline, proof)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackAuthorizeSigner is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x90e444c5.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function authorizeSigner(address signer, (uint96,uint64,uint16,address) scope, uint256 proofDeadline, bytes proof) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackAuthorizeSigner(signer common.Address, scope SignerScope, proofDeadline *big.Int, proof []byte) ([]byte, error) {
	return snapflowEscrow.abi.Pack("authorizeSigner", signer, scope, proofDeadline, proof)
}

// PackAutoTopUp is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x12151c36.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function autoTopUp(address customer, uint256 relayFee) returns()
func (snapflowEscrow *SnapflowEscrow) PackAutoTopUp(customer common.Address, relayFee *big.Int) []byte {
	enc, err := snapflowEscrow.abi.Pack("autoTopUp", customer, relayFee)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackAutoTopUp is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x12151c36.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function autoTopUp(address customer, uint256 relayFee) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackAutoTopUp(customer common.Address, relayFee *big.Int) ([]byte, error) {
	return snapflowEscrow.abi.Pack("autoTopUp", customer, relayFee)
}

// PackAutoTopUpOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xf44a4527.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function autoTopUpOf(address customer) view returns((address,uint32,uint64,uint128,uint128,uint128))
func (snapflowEscrow *SnapflowEscrow) PackAutoTopUpOf(customer common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("autoTopUpOf", customer)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackAutoTopUpOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xf44a4527.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function autoTopUpOf(address customer) view returns((address,uint32,uint64,uint128,uint128,uint128))
func (snapflowEscrow *SnapflowEscrow) TryPackAutoTopUpOf(customer common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("autoTopUpOf", customer)
}

// UnpackAutoTopUpOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xf44a4527.
//
// Solidity: function autoTopUpOf(address customer) view returns((address,uint32,uint64,uint128,uint128,uint128))
func (snapflowEscrow *SnapflowEscrow) UnpackAutoTopUpOf(data []byte) (AutoTopUp, error) {
	out, err := snapflowEscrow.abi.Unpack("autoTopUpOf", data)
	if err != nil {
		return *new(AutoTopUp), err
	}
	out0 := *abi.ConvertType(out[0], new(AutoTopUp)).(*AutoTopUp)
	return out0, nil
}

// PackAvailableOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xd546da90.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function availableOf(address customer) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) PackAvailableOf(customer common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("availableOf", customer)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackAvailableOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xd546da90.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function availableOf(address customer) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) TryPackAvailableOf(customer common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("availableOf", customer)
}

// UnpackAvailableOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xd546da90.
//
// Solidity: function availableOf(address customer) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) UnpackAvailableOf(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("availableOf", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackBeginDefaultAdminTransfer is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x634e93da.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function beginDefaultAdminTransfer(address newAdmin) returns()
func (snapflowEscrow *SnapflowEscrow) PackBeginDefaultAdminTransfer(newAdmin common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("beginDefaultAdminTransfer", newAdmin)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackBeginDefaultAdminTransfer is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x634e93da.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function beginDefaultAdminTransfer(address newAdmin) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackBeginDefaultAdminTransfer(newAdmin common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("beginDefaultAdminTransfer", newAdmin)
}

// PackBlockAccount is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x10bb4d15.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function blockAccount(address account, uint8 reason, uint64 duration) returns()
func (snapflowEscrow *SnapflowEscrow) PackBlockAccount(account common.Address, reason uint8, duration uint64) []byte {
	enc, err := snapflowEscrow.abi.Pack("blockAccount", account, reason, duration)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackBlockAccount is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x10bb4d15.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function blockAccount(address account, uint8 reason, uint64 duration) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackBlockAccount(account common.Address, reason uint8, duration uint64) ([]byte, error) {
	return snapflowEscrow.abi.Pack("blockAccount", account, reason, duration)
}

// PackBlockOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xcf08c455.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function blockOf(address account) view returns((uint64,uint64,uint8))
func (snapflowEscrow *SnapflowEscrow) PackBlockOf(account common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("blockOf", account)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackBlockOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xcf08c455.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function blockOf(address account) view returns((uint64,uint64,uint8))
func (snapflowEscrow *SnapflowEscrow) TryPackBlockOf(account common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("blockOf", account)
}

// UnpackBlockOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xcf08c455.
//
// Solidity: function blockOf(address account) view returns((uint64,uint64,uint8))
func (snapflowEscrow *SnapflowEscrow) UnpackBlockOf(data []byte) (AccountBlock, error) {
	out, err := snapflowEscrow.abi.Unpack("blockOf", data)
	if err != nil {
		return *new(AccountBlock), err
	}
	out0 := *abi.ConvertType(out[0], new(AccountBlock)).(*AccountBlock)
	return out0, nil
}

// PackBlockedAt is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xcb0ea0e4.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function blockedAt(address account) view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) PackBlockedAt(account common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("blockedAt", account)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackBlockedAt is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xcb0ea0e4.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function blockedAt(address account) view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) TryPackBlockedAt(account common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("blockedAt", account)
}

// UnpackBlockedAt is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xcb0ea0e4.
//
// Solidity: function blockedAt(address account) view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) UnpackBlockedAt(data []byte) (uint64, error) {
	out, err := snapflowEscrow.abi.Unpack("blockedAt", data)
	if err != nil {
		return *new(uint64), err
	}
	out0 := *abi.ConvertType(out[0], new(uint64)).(*uint64)
	return out0, nil
}

// PackCancelDefaultAdminTransfer is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xd602b9fd.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function cancelDefaultAdminTransfer() returns()
func (snapflowEscrow *SnapflowEscrow) PackCancelDefaultAdminTransfer() []byte {
	enc, err := snapflowEscrow.abi.Pack("cancelDefaultAdminTransfer")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackCancelDefaultAdminTransfer is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xd602b9fd.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function cancelDefaultAdminTransfer() returns()
func (snapflowEscrow *SnapflowEscrow) TryPackCancelDefaultAdminTransfer() ([]byte, error) {
	return snapflowEscrow.abi.Pack("cancelDefaultAdminTransfer")
}

// PackCancelWithdrawal is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x22611280.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function cancelWithdrawal() returns()
func (snapflowEscrow *SnapflowEscrow) PackCancelWithdrawal() []byte {
	enc, err := snapflowEscrow.abi.Pack("cancelWithdrawal")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackCancelWithdrawal is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x22611280.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function cancelWithdrawal() returns()
func (snapflowEscrow *SnapflowEscrow) TryPackCancelWithdrawal() ([]byte, error) {
	return snapflowEscrow.abi.Pack("cancelWithdrawal")
}

// PackChangeDefaultAdminDelay is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x649a5ec7.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function changeDefaultAdminDelay(uint48 newDelay) returns()
func (snapflowEscrow *SnapflowEscrow) PackChangeDefaultAdminDelay(newDelay *big.Int) []byte {
	enc, err := snapflowEscrow.abi.Pack("changeDefaultAdminDelay", newDelay)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackChangeDefaultAdminDelay is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x649a5ec7.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function changeDefaultAdminDelay(uint48 newDelay) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackChangeDefaultAdminDelay(newDelay *big.Int) ([]byte, error) {
	return snapflowEscrow.abi.Pack("changeDefaultAdminDelay", newDelay)
}

// PackChannelIdOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xccb24135.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function channelIdOf((address,address,address,uint16,bytes32,uint128,uint64,bytes32) voucher) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) PackChannelIdOf(voucher Voucher) []byte {
	enc, err := snapflowEscrow.abi.Pack("channelIdOf", voucher)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackChannelIdOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xccb24135.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function channelIdOf((address,address,address,uint16,bytes32,uint128,uint64,bytes32) voucher) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) TryPackChannelIdOf(voucher Voucher) ([]byte, error) {
	return snapflowEscrow.abi.Pack("channelIdOf", voucher)
}

// UnpackChannelIdOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xccb24135.
//
// Solidity: function channelIdOf((address,address,address,uint16,bytes32,uint128,uint64,bytes32) voucher) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) UnpackChannelIdOf(data []byte) ([32]byte, error) {
	out, err := snapflowEscrow.abi.Unpack("channelIdOf", data)
	if err != nil {
		return *new([32]byte), err
	}
	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)
	return out0, nil
}

// PackClaim is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x07ae5453.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function claim((address,address,address,uint16,bytes32,uint128,uint64,bytes32) voucher, bytes signature, address signer, uint128 maxAmount) returns(uint128 paid)
func (snapflowEscrow *SnapflowEscrow) PackClaim(voucher Voucher, signature []byte, signer common.Address, maxAmount *big.Int) []byte {
	enc, err := snapflowEscrow.abi.Pack("claim", voucher, signature, signer, maxAmount)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackClaim is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x07ae5453.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function claim((address,address,address,uint16,bytes32,uint128,uint64,bytes32) voucher, bytes signature, address signer, uint128 maxAmount) returns(uint128 paid)
func (snapflowEscrow *SnapflowEscrow) TryPackClaim(voucher Voucher, signature []byte, signer common.Address, maxAmount *big.Int) ([]byte, error) {
	return snapflowEscrow.abi.Pack("claim", voucher, signature, signer, maxAmount)
}

// UnpackClaim is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x07ae5453.
//
// Solidity: function claim((address,address,address,uint16,bytes32,uint128,uint64,bytes32) voucher, bytes signature, address signer, uint128 maxAmount) returns(uint128 paid)
func (snapflowEscrow *SnapflowEscrow) UnpackClaim(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("claim", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackClaimBatch is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xd1e5ee66.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function claimBatch(((address,address,address,uint16,bytes32,uint128,uint64,bytes32),bytes,address,uint128)[] items) returns(uint256 totalPaid)
func (snapflowEscrow *SnapflowEscrow) PackClaimBatch(items []ClaimItem) []byte {
	enc, err := snapflowEscrow.abi.Pack("claimBatch", items)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackClaimBatch is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xd1e5ee66.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function claimBatch(((address,address,address,uint16,bytes32,uint128,uint64,bytes32),bytes,address,uint128)[] items) returns(uint256 totalPaid)
func (snapflowEscrow *SnapflowEscrow) TryPackClaimBatch(items []ClaimItem) ([]byte, error) {
	return snapflowEscrow.abi.Pack("claimBatch", items)
}

// UnpackClaimBatch is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xd1e5ee66.
//
// Solidity: function claimBatch(((address,address,address,uint16,bytes32,uint128,uint64,bytes32),bytes,address,uint128)[] items) returns(uint256 totalPaid)
func (snapflowEscrow *SnapflowEscrow) UnpackClaimBatch(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("claimBatch", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackClaimBatchAndWithdraw is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xe8bbf4be.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function claimBatchAndWithdraw(((address,address,address,uint16,bytes32,uint128,uint64,bytes32),bytes,address,uint128)[] items, address host, address payout, uint256 relayFee, uint256 deadline, bytes hostSignature) returns(uint256 totalPaid)
func (snapflowEscrow *SnapflowEscrow) PackClaimBatchAndWithdraw(items []ClaimItem, host common.Address, payout common.Address, relayFee *big.Int, deadline *big.Int, hostSignature []byte) []byte {
	enc, err := snapflowEscrow.abi.Pack("claimBatchAndWithdraw", items, host, payout, relayFee, deadline, hostSignature)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackClaimBatchAndWithdraw is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xe8bbf4be.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function claimBatchAndWithdraw(((address,address,address,uint16,bytes32,uint128,uint64,bytes32),bytes,address,uint128)[] items, address host, address payout, uint256 relayFee, uint256 deadline, bytes hostSignature) returns(uint256 totalPaid)
func (snapflowEscrow *SnapflowEscrow) TryPackClaimBatchAndWithdraw(items []ClaimItem, host common.Address, payout common.Address, relayFee *big.Int, deadline *big.Int, hostSignature []byte) ([]byte, error) {
	return snapflowEscrow.abi.Pack("claimBatchAndWithdraw", items, host, payout, relayFee, deadline, hostSignature)
}

// UnpackClaimBatchAndWithdraw is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xe8bbf4be.
//
// Solidity: function claimBatchAndWithdraw(((address,address,address,uint16,bytes32,uint128,uint64,bytes32),bytes,address,uint128)[] items, address host, address payout, uint256 relayFee, uint256 deadline, bytes hostSignature) returns(uint256 totalPaid)
func (snapflowEscrow *SnapflowEscrow) UnpackClaimBatchAndWithdraw(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("claimBatchAndWithdraw", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackClaimWindow is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xc5d37ae1.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function claimWindow() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) PackClaimWindow() []byte {
	enc, err := snapflowEscrow.abi.Pack("claimWindow")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackClaimWindow is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xc5d37ae1.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function claimWindow() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) TryPackClaimWindow() ([]byte, error) {
	return snapflowEscrow.abi.Pack("claimWindow")
}

// UnpackClaimWindow is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xc5d37ae1.
//
// Solidity: function claimWindow() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) UnpackClaimWindow(data []byte) (uint64, error) {
	out, err := snapflowEscrow.abi.Unpack("claimWindow", data)
	if err != nil {
		return *new(uint64), err
	}
	out0 := *abi.ConvertType(out[0], new(uint64)).(*uint64)
	return out0, nil
}

// PackClaimedOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xf80e09f1.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function claimedOf(bytes32 channelId) view returns(uint128)
func (snapflowEscrow *SnapflowEscrow) PackClaimedOf(channelId [32]byte) []byte {
	enc, err := snapflowEscrow.abi.Pack("claimedOf", channelId)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackClaimedOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xf80e09f1.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function claimedOf(bytes32 channelId) view returns(uint128)
func (snapflowEscrow *SnapflowEscrow) TryPackClaimedOf(channelId [32]byte) ([]byte, error) {
	return snapflowEscrow.abi.Pack("claimedOf", channelId)
}

// UnpackClaimedOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xf80e09f1.
//
// Solidity: function claimedOf(bytes32 channelId) view returns(uint128)
func (snapflowEscrow *SnapflowEscrow) UnpackClaimedOf(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("claimedOf", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackClaimsFreeze is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x47d7c5d7.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function claimsFreeze() view returns((uint64,uint64,uint64,bool))
func (snapflowEscrow *SnapflowEscrow) PackClaimsFreeze() []byte {
	enc, err := snapflowEscrow.abi.Pack("claimsFreeze")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackClaimsFreeze is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x47d7c5d7.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function claimsFreeze() view returns((uint64,uint64,uint64,bool))
func (snapflowEscrow *SnapflowEscrow) TryPackClaimsFreeze() ([]byte, error) {
	return snapflowEscrow.abi.Pack("claimsFreeze")
}

// UnpackClaimsFreeze is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x47d7c5d7.
//
// Solidity: function claimsFreeze() view returns((uint64,uint64,uint64,bool))
func (snapflowEscrow *SnapflowEscrow) UnpackClaimsFreeze(data []byte) (ClaimsFreeze, error) {
	out, err := snapflowEscrow.abi.Unpack("claimsFreeze", data)
	if err != nil {
		return *new(ClaimsFreeze), err
	}
	out0 := *abi.ConvertType(out[0], new(ClaimsFreeze)).(*ClaimsFreeze)
	return out0, nil
}

// PackCompleteWithdrawal is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xe03ff7cb.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function completeWithdrawal() returns()
func (snapflowEscrow *SnapflowEscrow) PackCompleteWithdrawal() []byte {
	enc, err := snapflowEscrow.abi.Pack("completeWithdrawal")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackCompleteWithdrawal is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xe03ff7cb.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function completeWithdrawal() returns()
func (snapflowEscrow *SnapflowEscrow) TryPackCompleteWithdrawal() ([]byte, error) {
	return snapflowEscrow.abi.Pack("completeWithdrawal")
}

// PackDefaultAdmin is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x84ef8ffc.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function defaultAdmin() view returns(address)
func (snapflowEscrow *SnapflowEscrow) PackDefaultAdmin() []byte {
	enc, err := snapflowEscrow.abi.Pack("defaultAdmin")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackDefaultAdmin is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x84ef8ffc.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function defaultAdmin() view returns(address)
func (snapflowEscrow *SnapflowEscrow) TryPackDefaultAdmin() ([]byte, error) {
	return snapflowEscrow.abi.Pack("defaultAdmin")
}

// UnpackDefaultAdmin is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x84ef8ffc.
//
// Solidity: function defaultAdmin() view returns(address)
func (snapflowEscrow *SnapflowEscrow) UnpackDefaultAdmin(data []byte) (common.Address, error) {
	out, err := snapflowEscrow.abi.Unpack("defaultAdmin", data)
	if err != nil {
		return *new(common.Address), err
	}
	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)
	return out0, nil
}

// PackDefaultAdminDelay is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xcc8463c8.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function defaultAdminDelay() view returns(uint48)
func (snapflowEscrow *SnapflowEscrow) PackDefaultAdminDelay() []byte {
	enc, err := snapflowEscrow.abi.Pack("defaultAdminDelay")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackDefaultAdminDelay is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xcc8463c8.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function defaultAdminDelay() view returns(uint48)
func (snapflowEscrow *SnapflowEscrow) TryPackDefaultAdminDelay() ([]byte, error) {
	return snapflowEscrow.abi.Pack("defaultAdminDelay")
}

// UnpackDefaultAdminDelay is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xcc8463c8.
//
// Solidity: function defaultAdminDelay() view returns(uint48)
func (snapflowEscrow *SnapflowEscrow) UnpackDefaultAdminDelay(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("defaultAdminDelay", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackDefaultAdminDelayIncreaseWait is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x022d63fb.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function defaultAdminDelayIncreaseWait() view returns(uint48)
func (snapflowEscrow *SnapflowEscrow) PackDefaultAdminDelayIncreaseWait() []byte {
	enc, err := snapflowEscrow.abi.Pack("defaultAdminDelayIncreaseWait")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackDefaultAdminDelayIncreaseWait is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x022d63fb.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function defaultAdminDelayIncreaseWait() view returns(uint48)
func (snapflowEscrow *SnapflowEscrow) TryPackDefaultAdminDelayIncreaseWait() ([]byte, error) {
	return snapflowEscrow.abi.Pack("defaultAdminDelayIncreaseWait")
}

// UnpackDefaultAdminDelayIncreaseWait is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x022d63fb.
//
// Solidity: function defaultAdminDelayIncreaseWait() view returns(uint48)
func (snapflowEscrow *SnapflowEscrow) UnpackDefaultAdminDelayIncreaseWait(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("defaultAdminDelayIncreaseWait", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackDeposit is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xb6b55f25.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function deposit(uint256 amount) returns()
func (snapflowEscrow *SnapflowEscrow) PackDeposit(amount *big.Int) []byte {
	enc, err := snapflowEscrow.abi.Pack("deposit", amount)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackDeposit is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xb6b55f25.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function deposit(uint256 amount) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackDeposit(amount *big.Int) ([]byte, error) {
	return snapflowEscrow.abi.Pack("deposit", amount)
}

// PackDepositCaps is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x8cc65ee7.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function depositCaps() view returns((uint128,uint128))
func (snapflowEscrow *SnapflowEscrow) PackDepositCaps() []byte {
	enc, err := snapflowEscrow.abi.Pack("depositCaps")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackDepositCaps is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x8cc65ee7.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function depositCaps() view returns((uint128,uint128))
func (snapflowEscrow *SnapflowEscrow) TryPackDepositCaps() ([]byte, error) {
	return snapflowEscrow.abi.Pack("depositCaps")
}

// UnpackDepositCaps is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x8cc65ee7.
//
// Solidity: function depositCaps() view returns((uint128,uint128))
func (snapflowEscrow *SnapflowEscrow) UnpackDepositCaps(data []byte) (DepositCaps, error) {
	out, err := snapflowEscrow.abi.Unpack("depositCaps", data)
	if err != nil {
		return *new(DepositCaps), err
	}
	out0 := *abi.ConvertType(out[0], new(DepositCaps)).(*DepositCaps)
	return out0, nil
}

// PackDepositFor is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x2f4f21e2.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function depositFor(address customer, uint256 amount) returns()
func (snapflowEscrow *SnapflowEscrow) PackDepositFor(customer common.Address, amount *big.Int) []byte {
	enc, err := snapflowEscrow.abi.Pack("depositFor", customer, amount)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackDepositFor is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x2f4f21e2.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function depositFor(address customer, uint256 amount) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackDepositFor(customer common.Address, amount *big.Int) ([]byte, error) {
	return snapflowEscrow.abi.Pack("depositFor", customer, amount)
}

// PackDepositWithAuthorization is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x82c0696f.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function depositWithAuthorization(address payer, address customer, uint256 amount, uint256 relayFee, uint256 validAfter, uint256 validBefore, bytes32 salt, bytes signature) returns()
func (snapflowEscrow *SnapflowEscrow) PackDepositWithAuthorization(payer common.Address, customer common.Address, amount *big.Int, relayFee *big.Int, validAfter *big.Int, validBefore *big.Int, salt [32]byte, signature []byte) []byte {
	enc, err := snapflowEscrow.abi.Pack("depositWithAuthorization", payer, customer, amount, relayFee, validAfter, validBefore, salt, signature)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackDepositWithAuthorization is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x82c0696f.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function depositWithAuthorization(address payer, address customer, uint256 amount, uint256 relayFee, uint256 validAfter, uint256 validBefore, bytes32 salt, bytes signature) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackDepositWithAuthorization(payer common.Address, customer common.Address, amount *big.Int, relayFee *big.Int, validAfter *big.Int, validBefore *big.Int, salt [32]byte, signature []byte) ([]byte, error) {
	return snapflowEscrow.abi.Pack("depositWithAuthorization", payer, customer, amount, relayFee, validAfter, validBefore, salt, signature)
}

// PackDepositWithPermit is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x4a970be7.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) returns()
func (snapflowEscrow *SnapflowEscrow) PackDepositWithPermit(amount *big.Int, deadline *big.Int, v uint8, r [32]byte, s [32]byte) []byte {
	enc, err := snapflowEscrow.abi.Pack("depositWithPermit", amount, deadline, v, r, s)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackDepositWithPermit is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x4a970be7.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackDepositWithPermit(amount *big.Int, deadline *big.Int, v uint8, r [32]byte, s [32]byte) ([]byte, error) {
	return snapflowEscrow.abi.Pack("depositWithPermit", amount, deadline, v, r, s)
}

// PackDisableAutoTopUp is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xb5da77cc.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function disableAutoTopUp() returns()
func (snapflowEscrow *SnapflowEscrow) PackDisableAutoTopUp() []byte {
	enc, err := snapflowEscrow.abi.Pack("disableAutoTopUp")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackDisableAutoTopUp is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xb5da77cc.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function disableAutoTopUp() returns()
func (snapflowEscrow *SnapflowEscrow) TryPackDisableAutoTopUp() ([]byte, error) {
	return snapflowEscrow.abi.Pack("disableAutoTopUp")
}

// PackEip712Domain is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x84b0196e.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function eip712Domain() view returns(bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)
func (snapflowEscrow *SnapflowEscrow) PackEip712Domain() []byte {
	enc, err := snapflowEscrow.abi.Pack("eip712Domain")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackEip712Domain is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x84b0196e.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function eip712Domain() view returns(bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)
func (snapflowEscrow *SnapflowEscrow) TryPackEip712Domain() ([]byte, error) {
	return snapflowEscrow.abi.Pack("eip712Domain")
}

// Eip712DomainOutput serves as a container for the return parameters of contract
// method Eip712Domain.
type Eip712DomainOutput struct {
	Fields            [1]byte
	Name              string
	Version           string
	ChainId           *big.Int
	VerifyingContract common.Address
	Salt              [32]byte
	Extensions        []*big.Int
}

// UnpackEip712Domain is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x84b0196e.
//
// Solidity: function eip712Domain() view returns(bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)
func (snapflowEscrow *SnapflowEscrow) UnpackEip712Domain(data []byte) (Eip712DomainOutput, error) {
	out, err := snapflowEscrow.abi.Unpack("eip712Domain", data)
	outstruct := new(Eip712DomainOutput)
	if err != nil {
		return *outstruct, err
	}
	outstruct.Fields = *abi.ConvertType(out[0], new([1]byte)).(*[1]byte)
	outstruct.Name = *abi.ConvertType(out[1], new(string)).(*string)
	outstruct.Version = *abi.ConvertType(out[2], new(string)).(*string)
	outstruct.ChainId = abi.ConvertType(out[3], new(big.Int)).(*big.Int)
	outstruct.VerifyingContract = *abi.ConvertType(out[4], new(common.Address)).(*common.Address)
	outstruct.Salt = *abi.ConvertType(out[5], new([32]byte)).(*[32]byte)
	outstruct.Extensions = *abi.ConvertType(out[6], new([]*big.Int)).(*[]*big.Int)
	return *outstruct, nil
}

// PackFeesAccruedOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x2fe13a84.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function feesAccruedOf(address feeReceiver) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) PackFeesAccruedOf(feeReceiver common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("feesAccruedOf", feeReceiver)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackFeesAccruedOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x2fe13a84.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function feesAccruedOf(address feeReceiver) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) TryPackFeesAccruedOf(feeReceiver common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("feesAccruedOf", feeReceiver)
}

// UnpackFeesAccruedOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x2fe13a84.
//
// Solidity: function feesAccruedOf(address feeReceiver) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) UnpackFeesAccruedOf(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("feesAccruedOf", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackFreezeClaims is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x1be24d31.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function freezeClaims(uint64 duration) returns()
func (snapflowEscrow *SnapflowEscrow) PackFreezeClaims(duration uint64) []byte {
	enc, err := snapflowEscrow.abi.Pack("freezeClaims", duration)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackFreezeClaims is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x1be24d31.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function freezeClaims(uint64 duration) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackFreezeClaims(duration uint64) ([]byte, error) {
	return snapflowEscrow.abi.Pack("freezeClaims", duration)
}

// PackFrozenBalanceOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xbe91de53.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function frozenBalanceOf(address account) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) PackFrozenBalanceOf(account common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("frozenBalanceOf", account)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackFrozenBalanceOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xbe91de53.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function frozenBalanceOf(address account) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) TryPackFrozenBalanceOf(account common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("frozenBalanceOf", account)
}

// UnpackFrozenBalanceOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xbe91de53.
//
// Solidity: function frozenBalanceOf(address account) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) UnpackFrozenBalanceOf(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("frozenBalanceOf", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackGetRoleAdmin is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x248a9ca3.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function getRoleAdmin(bytes32 role) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) PackGetRoleAdmin(role [32]byte) []byte {
	enc, err := snapflowEscrow.abi.Pack("getRoleAdmin", role)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackGetRoleAdmin is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x248a9ca3.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function getRoleAdmin(bytes32 role) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) TryPackGetRoleAdmin(role [32]byte) ([]byte, error) {
	return snapflowEscrow.abi.Pack("getRoleAdmin", role)
}

// UnpackGetRoleAdmin is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x248a9ca3.
//
// Solidity: function getRoleAdmin(bytes32 role) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) UnpackGetRoleAdmin(data []byte) ([32]byte, error) {
	out, err := snapflowEscrow.abi.Unpack("getRoleAdmin", data)
	if err != nil {
		return *new([32]byte), err
	}
	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)
	return out0, nil
}

// PackGrantRole is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x2f2ff15d.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function grantRole(bytes32 role, address account) returns()
func (snapflowEscrow *SnapflowEscrow) PackGrantRole(role [32]byte, account common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("grantRole", role, account)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackGrantRole is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x2f2ff15d.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function grantRole(bytes32 role, address account) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackGrantRole(role [32]byte, account common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("grantRole", role, account)
}

// PackHasRole is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x91d14854.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function hasRole(bytes32 role, address account) view returns(bool)
func (snapflowEscrow *SnapflowEscrow) PackHasRole(role [32]byte, account common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("hasRole", role, account)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackHasRole is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x91d14854.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function hasRole(bytes32 role, address account) view returns(bool)
func (snapflowEscrow *SnapflowEscrow) TryPackHasRole(role [32]byte, account common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("hasRole", role, account)
}

// UnpackHasRole is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x91d14854.
//
// Solidity: function hasRole(bytes32 role, address account) view returns(bool)
func (snapflowEscrow *SnapflowEscrow) UnpackHasRole(data []byte) (bool, error) {
	out, err := snapflowEscrow.abi.Unpack("hasRole", data)
	if err != nil {
		return *new(bool), err
	}
	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)
	return out0, nil
}

// PackHostBalanceOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x7f143c59.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function hostBalanceOf(address host) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) PackHostBalanceOf(host common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("hostBalanceOf", host)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackHostBalanceOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x7f143c59.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function hostBalanceOf(address host) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) TryPackHostBalanceOf(host common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("hostBalanceOf", host)
}

// UnpackHostBalanceOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x7f143c59.
//
// Solidity: function hostBalanceOf(address host) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) UnpackHostBalanceOf(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("hostBalanceOf", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackHostWithdrawalDigest is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x7dd9c3ba.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function hostWithdrawalDigest(address host, address payout, address relayer, uint256 relayFee, uint256 nonce, uint256 deadline) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) PackHostWithdrawalDigest(host common.Address, payout common.Address, relayer common.Address, relayFee *big.Int, nonce *big.Int, deadline *big.Int) []byte {
	enc, err := snapflowEscrow.abi.Pack("hostWithdrawalDigest", host, payout, relayer, relayFee, nonce, deadline)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackHostWithdrawalDigest is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x7dd9c3ba.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function hostWithdrawalDigest(address host, address payout, address relayer, uint256 relayFee, uint256 nonce, uint256 deadline) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) TryPackHostWithdrawalDigest(host common.Address, payout common.Address, relayer common.Address, relayFee *big.Int, nonce *big.Int, deadline *big.Int) ([]byte, error) {
	return snapflowEscrow.abi.Pack("hostWithdrawalDigest", host, payout, relayer, relayFee, nonce, deadline)
}

// UnpackHostWithdrawalDigest is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x7dd9c3ba.
//
// Solidity: function hostWithdrawalDigest(address host, address payout, address relayer, uint256 relayFee, uint256 nonce, uint256 deadline) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) UnpackHostWithdrawalDigest(data []byte) ([32]byte, error) {
	out, err := snapflowEscrow.abi.Unpack("hostWithdrawalDigest", data)
	if err != nil {
		return *new([32]byte), err
	}
	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)
	return out0, nil
}

// PackHostWithdrawalNonceOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x9af5c72b.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function hostWithdrawalNonceOf(address host) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) PackHostWithdrawalNonceOf(host common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("hostWithdrawalNonceOf", host)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackHostWithdrawalNonceOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x9af5c72b.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function hostWithdrawalNonceOf(address host) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) TryPackHostWithdrawalNonceOf(host common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("hostWithdrawalNonceOf", host)
}

// UnpackHostWithdrawalNonceOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x9af5c72b.
//
// Solidity: function hostWithdrawalNonceOf(address host) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) UnpackHostWithdrawalNonceOf(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("hostWithdrawalNonceOf", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackLowerSignerLimit is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xa650e16c.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function lowerSignerLimit(address signer, uint96 hourlyCap) returns()
func (snapflowEscrow *SnapflowEscrow) PackLowerSignerLimit(signer common.Address, hourlyCap *big.Int) []byte {
	enc, err := snapflowEscrow.abi.Pack("lowerSignerLimit", signer, hourlyCap)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackLowerSignerLimit is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xa650e16c.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function lowerSignerLimit(address signer, uint96 hourlyCap) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackLowerSignerLimit(signer common.Address, hourlyCap *big.Int) ([]byte, error) {
	return snapflowEscrow.abi.Pack("lowerSignerLimit", signer, hourlyCap)
}

// PackMaxDepositOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xdbebfee3.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function maxDepositOf(address customer) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) PackMaxDepositOf(customer common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("maxDepositOf", customer)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackMaxDepositOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xdbebfee3.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function maxDepositOf(address customer) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) TryPackMaxDepositOf(customer common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("maxDepositOf", customer)
}

// UnpackMaxDepositOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xdbebfee3.
//
// Solidity: function maxDepositOf(address customer) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) UnpackMaxDepositOf(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("maxDepositOf", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackOwner is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x8da5cb5b.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function owner() view returns(address)
func (snapflowEscrow *SnapflowEscrow) PackOwner() []byte {
	enc, err := snapflowEscrow.abi.Pack("owner")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackOwner is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x8da5cb5b.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function owner() view returns(address)
func (snapflowEscrow *SnapflowEscrow) TryPackOwner() ([]byte, error) {
	return snapflowEscrow.abi.Pack("owner")
}

// UnpackOwner is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x8da5cb5b.
//
// Solidity: function owner() view returns(address)
func (snapflowEscrow *SnapflowEscrow) UnpackOwner(data []byte) (common.Address, error) {
	out, err := snapflowEscrow.abi.Unpack("owner", data)
	if err != nil {
		return *new(common.Address), err
	}
	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)
	return out0, nil
}

// PackPause is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x8456cb59.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function pause() returns()
func (snapflowEscrow *SnapflowEscrow) PackPause() []byte {
	enc, err := snapflowEscrow.abi.Pack("pause")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackPause is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x8456cb59.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function pause() returns()
func (snapflowEscrow *SnapflowEscrow) TryPackPause() ([]byte, error) {
	return snapflowEscrow.abi.Pack("pause")
}

// PackPaused is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x5c975abb.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function paused() view returns(bool)
func (snapflowEscrow *SnapflowEscrow) PackPaused() []byte {
	enc, err := snapflowEscrow.abi.Pack("paused")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackPaused is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x5c975abb.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function paused() view returns(bool)
func (snapflowEscrow *SnapflowEscrow) TryPackPaused() ([]byte, error) {
	return snapflowEscrow.abi.Pack("paused")
}

// UnpackPaused is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x5c975abb.
//
// Solidity: function paused() view returns(bool)
func (snapflowEscrow *SnapflowEscrow) UnpackPaused(data []byte) (bool, error) {
	out, err := snapflowEscrow.abi.Unpack("paused", data)
	if err != nil {
		return *new(bool), err
	}
	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)
	return out0, nil
}

// PackPayoutAddressDigest is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xf67360c1.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function payoutAddressDigest(address host, address payout, uint256 nonce, uint256 deadline) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) PackPayoutAddressDigest(host common.Address, payout common.Address, nonce *big.Int, deadline *big.Int) []byte {
	enc, err := snapflowEscrow.abi.Pack("payoutAddressDigest", host, payout, nonce, deadline)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackPayoutAddressDigest is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xf67360c1.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function payoutAddressDigest(address host, address payout, uint256 nonce, uint256 deadline) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) TryPackPayoutAddressDigest(host common.Address, payout common.Address, nonce *big.Int, deadline *big.Int) ([]byte, error) {
	return snapflowEscrow.abi.Pack("payoutAddressDigest", host, payout, nonce, deadline)
}

// UnpackPayoutAddressDigest is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xf67360c1.
//
// Solidity: function payoutAddressDigest(address host, address payout, uint256 nonce, uint256 deadline) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) UnpackPayoutAddressDigest(data []byte) ([32]byte, error) {
	out, err := snapflowEscrow.abi.Unpack("payoutAddressDigest", data)
	if err != nil {
		return *new([32]byte), err
	}
	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)
	return out0, nil
}

// PackPayoutAddressOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x9fcdede2.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function payoutAddressOf(address host) view returns(address)
func (snapflowEscrow *SnapflowEscrow) PackPayoutAddressOf(host common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("payoutAddressOf", host)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackPayoutAddressOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x9fcdede2.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function payoutAddressOf(address host) view returns(address)
func (snapflowEscrow *SnapflowEscrow) TryPackPayoutAddressOf(host common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("payoutAddressOf", host)
}

// UnpackPayoutAddressOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x9fcdede2.
//
// Solidity: function payoutAddressOf(address host) view returns(address)
func (snapflowEscrow *SnapflowEscrow) UnpackPayoutAddressOf(data []byte) (common.Address, error) {
	out, err := snapflowEscrow.abi.Unpack("payoutAddressOf", data)
	if err != nil {
		return *new(common.Address), err
	}
	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)
	return out0, nil
}

// PackPayoutNonceOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x4f0786d7.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function payoutNonceOf(address host) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) PackPayoutNonceOf(host common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("payoutNonceOf", host)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackPayoutNonceOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x4f0786d7.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function payoutNonceOf(address host) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) TryPackPayoutNonceOf(host common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("payoutNonceOf", host)
}

// UnpackPayoutNonceOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x4f0786d7.
//
// Solidity: function payoutNonceOf(address host) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) UnpackPayoutNonceOf(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("payoutNonceOf", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackPendingDefaultAdmin is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xcf6eefb7.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function pendingDefaultAdmin() view returns(address newAdmin, uint48 schedule)
func (snapflowEscrow *SnapflowEscrow) PackPendingDefaultAdmin() []byte {
	enc, err := snapflowEscrow.abi.Pack("pendingDefaultAdmin")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackPendingDefaultAdmin is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xcf6eefb7.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function pendingDefaultAdmin() view returns(address newAdmin, uint48 schedule)
func (snapflowEscrow *SnapflowEscrow) TryPackPendingDefaultAdmin() ([]byte, error) {
	return snapflowEscrow.abi.Pack("pendingDefaultAdmin")
}

// PendingDefaultAdminOutput serves as a container for the return parameters of contract
// method PendingDefaultAdmin.
type PendingDefaultAdminOutput struct {
	NewAdmin common.Address
	Schedule *big.Int
}

// UnpackPendingDefaultAdmin is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xcf6eefb7.
//
// Solidity: function pendingDefaultAdmin() view returns(address newAdmin, uint48 schedule)
func (snapflowEscrow *SnapflowEscrow) UnpackPendingDefaultAdmin(data []byte) (PendingDefaultAdminOutput, error) {
	out, err := snapflowEscrow.abi.Unpack("pendingDefaultAdmin", data)
	outstruct := new(PendingDefaultAdminOutput)
	if err != nil {
		return *outstruct, err
	}
	outstruct.NewAdmin = *abi.ConvertType(out[0], new(common.Address)).(*common.Address)
	outstruct.Schedule = abi.ConvertType(out[1], new(big.Int)).(*big.Int)
	return *outstruct, nil
}

// PackPendingDefaultAdminDelay is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xa1eda53c.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function pendingDefaultAdminDelay() view returns(uint48 newDelay, uint48 schedule)
func (snapflowEscrow *SnapflowEscrow) PackPendingDefaultAdminDelay() []byte {
	enc, err := snapflowEscrow.abi.Pack("pendingDefaultAdminDelay")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackPendingDefaultAdminDelay is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xa1eda53c.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function pendingDefaultAdminDelay() view returns(uint48 newDelay, uint48 schedule)
func (snapflowEscrow *SnapflowEscrow) TryPackPendingDefaultAdminDelay() ([]byte, error) {
	return snapflowEscrow.abi.Pack("pendingDefaultAdminDelay")
}

// PendingDefaultAdminDelayOutput serves as a container for the return parameters of contract
// method PendingDefaultAdminDelay.
type PendingDefaultAdminDelayOutput struct {
	NewDelay *big.Int
	Schedule *big.Int
}

// UnpackPendingDefaultAdminDelay is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xa1eda53c.
//
// Solidity: function pendingDefaultAdminDelay() view returns(uint48 newDelay, uint48 schedule)
func (snapflowEscrow *SnapflowEscrow) UnpackPendingDefaultAdminDelay(data []byte) (PendingDefaultAdminDelayOutput, error) {
	out, err := snapflowEscrow.abi.Unpack("pendingDefaultAdminDelay", data)
	outstruct := new(PendingDefaultAdminDelayOutput)
	if err != nil {
		return *outstruct, err
	}
	outstruct.NewDelay = abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	outstruct.Schedule = abi.ConvertType(out[1], new(big.Int)).(*big.Int)
	return *outstruct, nil
}

// PackRaiseSignerLimit is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xb226d029.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function raiseSignerLimit(address signer, uint96 hourlyCap, uint64 expiry) returns()
func (snapflowEscrow *SnapflowEscrow) PackRaiseSignerLimit(signer common.Address, hourlyCap *big.Int, expiry uint64) []byte {
	enc, err := snapflowEscrow.abi.Pack("raiseSignerLimit", signer, hourlyCap, expiry)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackRaiseSignerLimit is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xb226d029.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function raiseSignerLimit(address signer, uint96 hourlyCap, uint64 expiry) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackRaiseSignerLimit(signer common.Address, hourlyCap *big.Int, expiry uint64) ([]byte, error) {
	return snapflowEscrow.abi.Pack("raiseSignerLimit", signer, hourlyCap, expiry)
}

// PackRearmClaimsFreeze is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x9e40ee58.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function rearmClaimsFreeze() returns()
func (snapflowEscrow *SnapflowEscrow) PackRearmClaimsFreeze() []byte {
	enc, err := snapflowEscrow.abi.Pack("rearmClaimsFreeze")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackRearmClaimsFreeze is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x9e40ee58.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function rearmClaimsFreeze() returns()
func (snapflowEscrow *SnapflowEscrow) TryPackRearmClaimsFreeze() ([]byte, error) {
	return snapflowEscrow.abi.Pack("rearmClaimsFreeze")
}

// PackRecoverSurplus is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xce382d01.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function recoverSurplus(address to) returns()
func (snapflowEscrow *SnapflowEscrow) PackRecoverSurplus(to common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("recoverSurplus", to)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackRecoverSurplus is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xce382d01.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function recoverSurplus(address to) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackRecoverSurplus(to common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("recoverSurplus", to)
}

// PackReleaseFrozen is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x721d068a.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function releaseFrozen(address account) returns()
func (snapflowEscrow *SnapflowEscrow) PackReleaseFrozen(account common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("releaseFrozen", account)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackReleaseFrozen is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x721d068a.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function releaseFrozen(address account) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackReleaseFrozen(account common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("releaseFrozen", account)
}

// PackRenounceRole is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x36568abe.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function renounceRole(bytes32 role, address account) returns()
func (snapflowEscrow *SnapflowEscrow) PackRenounceRole(role [32]byte, account common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("renounceRole", role, account)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackRenounceRole is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x36568abe.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function renounceRole(bytes32 role, address account) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackRenounceRole(role [32]byte, account common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("renounceRole", role, account)
}

// PackRequestWithdrawal is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x9ee679e8.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function requestWithdrawal(uint256 amount) returns()
func (snapflowEscrow *SnapflowEscrow) PackRequestWithdrawal(amount *big.Int) []byte {
	enc, err := snapflowEscrow.abi.Pack("requestWithdrawal", amount)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackRequestWithdrawal is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x9ee679e8.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function requestWithdrawal(uint256 amount) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackRequestWithdrawal(amount *big.Int) ([]byte, error) {
	return snapflowEscrow.abi.Pack("requestWithdrawal", amount)
}

// PackRevokeRole is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xd547741f.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function revokeRole(bytes32 role, address account) returns()
func (snapflowEscrow *SnapflowEscrow) PackRevokeRole(role [32]byte, account common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("revokeRole", role, account)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackRevokeRole is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xd547741f.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function revokeRole(bytes32 role, address account) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackRevokeRole(role [32]byte, account common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("revokeRole", role, account)
}

// PackRevokeSigner is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xc34b44a0.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function revokeSigner(address signer) returns()
func (snapflowEscrow *SnapflowEscrow) PackRevokeSigner(signer common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("revokeSigner", signer)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackRevokeSigner is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xc34b44a0.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function revokeSigner(address signer) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackRevokeSigner(signer common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("revokeSigner", signer)
}

// PackRollbackDefaultAdminDelay is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x0aa6220b.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function rollbackDefaultAdminDelay() returns()
func (snapflowEscrow *SnapflowEscrow) PackRollbackDefaultAdminDelay() []byte {
	enc, err := snapflowEscrow.abi.Pack("rollbackDefaultAdminDelay")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackRollbackDefaultAdminDelay is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x0aa6220b.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function rollbackDefaultAdminDelay() returns()
func (snapflowEscrow *SnapflowEscrow) TryPackRollbackDefaultAdminDelay() ([]byte, error) {
	return snapflowEscrow.abi.Pack("rollbackDefaultAdminDelay")
}

// PackSetAutoTopUp is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xe247a1e0.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function setAutoTopUp(address relayer, uint128 amount, uint128 threshold, uint128 maxRelayFee, uint32 minInterval) returns()
func (snapflowEscrow *SnapflowEscrow) PackSetAutoTopUp(relayer common.Address, amount *big.Int, threshold *big.Int, maxRelayFee *big.Int, minInterval uint32) []byte {
	enc, err := snapflowEscrow.abi.Pack("setAutoTopUp", relayer, amount, threshold, maxRelayFee, minInterval)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackSetAutoTopUp is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xe247a1e0.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function setAutoTopUp(address relayer, uint128 amount, uint128 threshold, uint128 maxRelayFee, uint32 minInterval) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackSetAutoTopUp(relayer common.Address, amount *big.Int, threshold *big.Int, maxRelayFee *big.Int, minInterval uint32) ([]byte, error) {
	return snapflowEscrow.abi.Pack("setAutoTopUp", relayer, amount, threshold, maxRelayFee, minInterval)
}

// PackSetDepositCaps is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x9e9cf949.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function setDepositCaps((uint128,uint128) caps) returns()
func (snapflowEscrow *SnapflowEscrow) PackSetDepositCaps(caps DepositCaps) []byte {
	enc, err := snapflowEscrow.abi.Pack("setDepositCaps", caps)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackSetDepositCaps is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x9e9cf949.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function setDepositCaps((uint128,uint128) caps) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackSetDepositCaps(caps DepositCaps) ([]byte, error) {
	return snapflowEscrow.abi.Pack("setDepositCaps", caps)
}

// PackSetPayoutAddress is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x33ea51a8.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function setPayoutAddress(address payout) returns()
func (snapflowEscrow *SnapflowEscrow) PackSetPayoutAddress(payout common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("setPayoutAddress", payout)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackSetPayoutAddress is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x33ea51a8.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function setPayoutAddress(address payout) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackSetPayoutAddress(payout common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("setPayoutAddress", payout)
}

// PackSetPayoutAddressWithSig is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x984bec5f.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function setPayoutAddressWithSig(address host, address payout, uint256 deadline, bytes signature) returns()
func (snapflowEscrow *SnapflowEscrow) PackSetPayoutAddressWithSig(host common.Address, payout common.Address, deadline *big.Int, signature []byte) []byte {
	enc, err := snapflowEscrow.abi.Pack("setPayoutAddressWithSig", host, payout, deadline, signature)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackSetPayoutAddressWithSig is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x984bec5f.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function setPayoutAddressWithSig(address host, address payout, uint256 deadline, bytes signature) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackSetPayoutAddressWithSig(host common.Address, payout common.Address, deadline *big.Int, signature []byte) ([]byte, error) {
	return snapflowEscrow.abi.Pack("setPayoutAddressWithSig", host, payout, deadline, signature)
}

// PackSignerOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x5b5175d5.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function signerOf(address signer) view returns((address,uint64,bool,uint16,uint96,uint96,uint64,uint128,uint64,uint64,uint64,uint16,address))
func (snapflowEscrow *SnapflowEscrow) PackSignerOf(signer common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("signerOf", signer)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackSignerOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x5b5175d5.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function signerOf(address signer) view returns((address,uint64,bool,uint16,uint96,uint96,uint64,uint128,uint64,uint64,uint64,uint16,address))
func (snapflowEscrow *SnapflowEscrow) TryPackSignerOf(signer common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("signerOf", signer)
}

// UnpackSignerOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x5b5175d5.
//
// Solidity: function signerOf(address signer) view returns((address,uint64,bool,uint16,uint96,uint96,uint64,uint128,uint64,uint64,uint64,uint16,address))
func (snapflowEscrow *SnapflowEscrow) UnpackSignerOf(data []byte) (SignerGrant, error) {
	out, err := snapflowEscrow.abi.Unpack("signerOf", data)
	if err != nil {
		return *new(SignerGrant), err
	}
	out0 := *abi.ConvertType(out[0], new(SignerGrant)).(*SignerGrant)
	return out0, nil
}

// PackSignerThawPeriod is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x15d73a9e.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function signerThawPeriod() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) PackSignerThawPeriod() []byte {
	enc, err := snapflowEscrow.abi.Pack("signerThawPeriod")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackSignerThawPeriod is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x15d73a9e.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function signerThawPeriod() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) TryPackSignerThawPeriod() ([]byte, error) {
	return snapflowEscrow.abi.Pack("signerThawPeriod")
}

// UnpackSignerThawPeriod is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x15d73a9e.
//
// Solidity: function signerThawPeriod() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerThawPeriod(data []byte) (uint64, error) {
	out, err := snapflowEscrow.abi.Unpack("signerThawPeriod", data)
	if err != nil {
		return *new(uint64), err
	}
	out0 := *abi.ConvertType(out[0], new(uint64)).(*uint64)
	return out0, nil
}

// PackSupportsInterface is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x01ffc9a7.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function supportsInterface(bytes4 interfaceId) view returns(bool)
func (snapflowEscrow *SnapflowEscrow) PackSupportsInterface(interfaceId [4]byte) []byte {
	enc, err := snapflowEscrow.abi.Pack("supportsInterface", interfaceId)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackSupportsInterface is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x01ffc9a7.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function supportsInterface(bytes4 interfaceId) view returns(bool)
func (snapflowEscrow *SnapflowEscrow) TryPackSupportsInterface(interfaceId [4]byte) ([]byte, error) {
	return snapflowEscrow.abi.Pack("supportsInterface", interfaceId)
}

// UnpackSupportsInterface is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x01ffc9a7.
//
// Solidity: function supportsInterface(bytes4 interfaceId) view returns(bool)
func (snapflowEscrow *SnapflowEscrow) UnpackSupportsInterface(data []byte) (bool, error) {
	out, err := snapflowEscrow.abi.Unpack("supportsInterface", data)
	if err != nil {
		return *new(bool), err
	}
	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)
	return out0, nil
}

// PackSweepFees is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x8d4b5cd2.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function sweepFees(address feeReceiver) returns()
func (snapflowEscrow *SnapflowEscrow) PackSweepFees(feeReceiver common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("sweepFees", feeReceiver)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackSweepFees is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x8d4b5cd2.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function sweepFees(address feeReceiver) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackSweepFees(feeReceiver common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("sweepFees", feeReceiver)
}

// PackThawSigner is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x1354f019.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function thawSigner(address signer) returns()
func (snapflowEscrow *SnapflowEscrow) PackThawSigner(signer common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("thawSigner", signer)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackThawSigner is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x1354f019.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function thawSigner(address signer) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackThawSigner(signer common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("thawSigner", signer)
}

// PackToken is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xfc0c546a.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function token() view returns(address)
func (snapflowEscrow *SnapflowEscrow) PackToken() []byte {
	enc, err := snapflowEscrow.abi.Pack("token")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackToken is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xfc0c546a.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function token() view returns(address)
func (snapflowEscrow *SnapflowEscrow) TryPackToken() ([]byte, error) {
	return snapflowEscrow.abi.Pack("token")
}

// UnpackToken is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xfc0c546a.
//
// Solidity: function token() view returns(address)
func (snapflowEscrow *SnapflowEscrow) UnpackToken(data []byte) (common.Address, error) {
	out, err := snapflowEscrow.abi.Unpack("token", data)
	if err != nil {
		return *new(common.Address), err
	}
	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)
	return out0, nil
}

// PackTotalHeld is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xf43cc773.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function totalHeld() view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) PackTotalHeld() []byte {
	enc, err := snapflowEscrow.abi.Pack("totalHeld")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackTotalHeld is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xf43cc773.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function totalHeld() view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) TryPackTotalHeld() ([]byte, error) {
	return snapflowEscrow.abi.Pack("totalHeld")
}

// UnpackTotalHeld is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xf43cc773.
//
// Solidity: function totalHeld() view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) UnpackTotalHeld(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("totalHeld", data)
	if err != nil {
		return new(big.Int), err
	}
	out0 := abi.ConvertType(out[0], new(big.Int)).(*big.Int)
	return out0, nil
}

// PackUnblockAccount is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x4d78fdc6.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function unblockAccount(address account) returns()
func (snapflowEscrow *SnapflowEscrow) PackUnblockAccount(account common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("unblockAccount", account)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackUnblockAccount is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x4d78fdc6.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function unblockAccount(address account) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackUnblockAccount(account common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("unblockAccount", account)
}

// PackUnfrozenTime is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x2e0f5485.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function unfrozenTime() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) PackUnfrozenTime() []byte {
	enc, err := snapflowEscrow.abi.Pack("unfrozenTime")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackUnfrozenTime is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x2e0f5485.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function unfrozenTime() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) TryPackUnfrozenTime() ([]byte, error) {
	return snapflowEscrow.abi.Pack("unfrozenTime")
}

// UnpackUnfrozenTime is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x2e0f5485.
//
// Solidity: function unfrozenTime() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) UnpackUnfrozenTime(data []byte) (uint64, error) {
	out, err := snapflowEscrow.abi.Unpack("unfrozenTime", data)
	if err != nil {
		return *new(uint64), err
	}
	out0 := *abi.ConvertType(out[0], new(uint64)).(*uint64)
	return out0, nil
}

// PackUnpause is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x3f4ba83a.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function unpause() returns()
func (snapflowEscrow *SnapflowEscrow) PackUnpause() []byte {
	enc, err := snapflowEscrow.abi.Pack("unpause")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackUnpause is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x3f4ba83a.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function unpause() returns()
func (snapflowEscrow *SnapflowEscrow) TryPackUnpause() ([]byte, error) {
	return snapflowEscrow.abi.Pack("unpause")
}

// PackVoucherDigest is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x0fd3e087.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function voucherDigest((address,address,address,uint16,bytes32,uint128,uint64,bytes32) voucher) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) PackVoucherDigest(voucher Voucher) []byte {
	enc, err := snapflowEscrow.abi.Pack("voucherDigest", voucher)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackVoucherDigest is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x0fd3e087.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function voucherDigest((address,address,address,uint16,bytes32,uint128,uint64,bytes32) voucher) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) TryPackVoucherDigest(voucher Voucher) ([]byte, error) {
	return snapflowEscrow.abi.Pack("voucherDigest", voucher)
}

// UnpackVoucherDigest is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x0fd3e087.
//
// Solidity: function voucherDigest((address,address,address,uint16,bytes32,uint128,uint64,bytes32) voucher) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) UnpackVoucherDigest(data []byte) ([32]byte, error) {
	out, err := snapflowEscrow.abi.Unpack("voucherDigest", data)
	if err != nil {
		return *new([32]byte), err
	}
	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)
	return out0, nil
}

// PackWithdrawHost is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x10f614f9.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function withdrawHost(address host) returns()
func (snapflowEscrow *SnapflowEscrow) PackWithdrawHost(host common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("withdrawHost", host)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackWithdrawHost is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x10f614f9.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function withdrawHost(address host) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackWithdrawHost(host common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("withdrawHost", host)
}

// PackWithdrawHostWithSig is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xbce9f03a.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function withdrawHostWithSig(address host, address payout, uint256 relayFee, uint256 deadline, bytes signature) returns()
func (snapflowEscrow *SnapflowEscrow) PackWithdrawHostWithSig(host common.Address, payout common.Address, relayFee *big.Int, deadline *big.Int, signature []byte) []byte {
	enc, err := snapflowEscrow.abi.Pack("withdrawHostWithSig", host, payout, relayFee, deadline, signature)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackWithdrawHostWithSig is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xbce9f03a.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function withdrawHostWithSig(address host, address payout, uint256 relayFee, uint256 deadline, bytes signature) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackWithdrawHostWithSig(host common.Address, payout common.Address, relayFee *big.Int, deadline *big.Int, signature []byte) ([]byte, error) {
	return snapflowEscrow.abi.Pack("withdrawHostWithSig", host, payout, relayFee, deadline, signature)
}

// PackWithdrawalDelay is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xa7ab6961.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function withdrawalDelay() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) PackWithdrawalDelay() []byte {
	enc, err := snapflowEscrow.abi.Pack("withdrawalDelay")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackWithdrawalDelay is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xa7ab6961.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function withdrawalDelay() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) TryPackWithdrawalDelay() ([]byte, error) {
	return snapflowEscrow.abi.Pack("withdrawalDelay")
}

// UnpackWithdrawalDelay is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xa7ab6961.
//
// Solidity: function withdrawalDelay() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) UnpackWithdrawalDelay(data []byte) (uint64, error) {
	out, err := snapflowEscrow.abi.Unpack("withdrawalDelay", data)
	if err != nil {
		return *new(uint64), err
	}
	out0 := *abi.ConvertType(out[0], new(uint64)).(*uint64)
	return out0, nil
}

// SnapflowEscrowAccountBlocked represents a AccountBlocked event raised by the SnapflowEscrow contract.
type SnapflowEscrowAccountBlocked struct {
	Account   common.Address
	Reason    uint8
	BlockedAt uint64
	Until     uint64
	Raw       *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowAccountBlockedEventName = "AccountBlocked"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowAccountBlocked) ContractEventName() string {
	return SnapflowEscrowAccountBlockedEventName
}

// UnpackAccountBlockedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event AccountBlocked(address indexed account, uint8 reason, uint64 blockedAt, uint64 until)
func (snapflowEscrow *SnapflowEscrow) UnpackAccountBlockedEvent(log *types.Log) (*SnapflowEscrowAccountBlocked, error) {
	event := "AccountBlocked"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowAccountBlocked)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowAccountUnblocked represents a AccountUnblocked event raised by the SnapflowEscrow contract.
type SnapflowEscrowAccountUnblocked struct {
	Account common.Address
	Raw     *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowAccountUnblockedEventName = "AccountUnblocked"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowAccountUnblocked) ContractEventName() string {
	return SnapflowEscrowAccountUnblockedEventName
}

// UnpackAccountUnblockedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event AccountUnblocked(address indexed account)
func (snapflowEscrow *SnapflowEscrow) UnpackAccountUnblockedEvent(log *types.Log) (*SnapflowEscrowAccountUnblocked, error) {
	event := "AccountUnblocked"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowAccountUnblocked)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowAutoTopUpDisabled represents a AutoTopUpDisabled event raised by the SnapflowEscrow contract.
type SnapflowEscrowAutoTopUpDisabled struct {
	Customer common.Address
	Raw      *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowAutoTopUpDisabledEventName = "AutoTopUpDisabled"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowAutoTopUpDisabled) ContractEventName() string {
	return SnapflowEscrowAutoTopUpDisabledEventName
}

// UnpackAutoTopUpDisabledEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event AutoTopUpDisabled(address indexed customer)
func (snapflowEscrow *SnapflowEscrow) UnpackAutoTopUpDisabledEvent(log *types.Log) (*SnapflowEscrowAutoTopUpDisabled, error) {
	event := "AutoTopUpDisabled"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowAutoTopUpDisabled)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowAutoTopUpExecuted represents a AutoTopUpExecuted event raised by the SnapflowEscrow contract.
type SnapflowEscrowAutoTopUpExecuted struct {
	Customer common.Address
	Relayer  common.Address
	Amount   *big.Int
	RelayFee *big.Int
	Raw      *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowAutoTopUpExecutedEventName = "AutoTopUpExecuted"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowAutoTopUpExecuted) ContractEventName() string {
	return SnapflowEscrowAutoTopUpExecutedEventName
}

// UnpackAutoTopUpExecutedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event AutoTopUpExecuted(address indexed customer, address indexed relayer, uint256 amount, uint256 relayFee)
func (snapflowEscrow *SnapflowEscrow) UnpackAutoTopUpExecutedEvent(log *types.Log) (*SnapflowEscrowAutoTopUpExecuted, error) {
	event := "AutoTopUpExecuted"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowAutoTopUpExecuted)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowAutoTopUpSet represents a AutoTopUpSet event raised by the SnapflowEscrow contract.
type SnapflowEscrowAutoTopUpSet struct {
	Customer    common.Address
	Relayer     common.Address
	Amount      *big.Int
	Threshold   *big.Int
	MaxRelayFee *big.Int
	MinInterval uint32
	Raw         *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowAutoTopUpSetEventName = "AutoTopUpSet"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowAutoTopUpSet) ContractEventName() string {
	return SnapflowEscrowAutoTopUpSetEventName
}

// UnpackAutoTopUpSetEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event AutoTopUpSet(address indexed customer, address indexed relayer, uint128 amount, uint128 threshold, uint128 maxRelayFee, uint32 minInterval)
func (snapflowEscrow *SnapflowEscrow) UnpackAutoTopUpSetEvent(log *types.Log) (*SnapflowEscrowAutoTopUpSet, error) {
	event := "AutoTopUpSet"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowAutoTopUpSet)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowClaimResult represents a ClaimResult event raised by the SnapflowEscrow contract.
type SnapflowEscrowClaimResult struct {
	ChannelId [32]byte
	Paid      *big.Int
	Reason    uint8
	Raw       *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowClaimResultEventName = "ClaimResult"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowClaimResult) ContractEventName() string {
	return SnapflowEscrowClaimResultEventName
}

// UnpackClaimResultEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event ClaimResult(bytes32 indexed channelId, uint128 paid, uint8 reason)
func (snapflowEscrow *SnapflowEscrow) UnpackClaimResultEvent(log *types.Log) (*SnapflowEscrowClaimResult, error) {
	event := "ClaimResult"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowClaimResult)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowClaimed represents a Claimed event raised by the SnapflowEscrow contract.
type SnapflowEscrowClaimed struct {
	ChannelId   [32]byte
	Customer    common.Address
	Host        common.Address
	Signer      common.Address
	FeeReceiver common.Address
	Paid        *big.Int
	Fee         *big.Int
	Claimed     *big.Int
	Raw         *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowClaimedEventName = "Claimed"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowClaimed) ContractEventName() string {
	return SnapflowEscrowClaimedEventName
}

// UnpackClaimedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event Claimed(bytes32 indexed channelId, address indexed customer, address indexed host, address signer, address feeReceiver, uint128 paid, uint128 fee, uint128 claimed)
func (snapflowEscrow *SnapflowEscrow) UnpackClaimedEvent(log *types.Log) (*SnapflowEscrowClaimed, error) {
	event := "Claimed"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowClaimed)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowClaimsFreezeRearmed represents a ClaimsFreezeRearmed event raised by the SnapflowEscrow contract.
type SnapflowEscrowClaimsFreezeRearmed struct {
	Raw *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowClaimsFreezeRearmedEventName = "ClaimsFreezeRearmed"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowClaimsFreezeRearmed) ContractEventName() string {
	return SnapflowEscrowClaimsFreezeRearmedEventName
}

// UnpackClaimsFreezeRearmedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event ClaimsFreezeRearmed()
func (snapflowEscrow *SnapflowEscrow) UnpackClaimsFreezeRearmedEvent(log *types.Log) (*SnapflowEscrowClaimsFreezeRearmed, error) {
	event := "ClaimsFreezeRearmed"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowClaimsFreezeRearmed)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowClaimsFrozen represents a ClaimsFrozen event raised by the SnapflowEscrow contract.
type SnapflowEscrowClaimsFrozen struct {
	By    common.Address
	Until uint64
	Raw   *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowClaimsFrozenEventName = "ClaimsFrozen"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowClaimsFrozen) ContractEventName() string {
	return SnapflowEscrowClaimsFrozenEventName
}

// UnpackClaimsFrozenEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event ClaimsFrozen(address indexed by, uint64 until)
func (snapflowEscrow *SnapflowEscrow) UnpackClaimsFrozenEvent(log *types.Log) (*SnapflowEscrowClaimsFrozen, error) {
	event := "ClaimsFrozen"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowClaimsFrozen)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowDefaultAdminDelayChangeCanceled represents a DefaultAdminDelayChangeCanceled event raised by the SnapflowEscrow contract.
type SnapflowEscrowDefaultAdminDelayChangeCanceled struct {
	Raw *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowDefaultAdminDelayChangeCanceledEventName = "DefaultAdminDelayChangeCanceled"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowDefaultAdminDelayChangeCanceled) ContractEventName() string {
	return SnapflowEscrowDefaultAdminDelayChangeCanceledEventName
}

// UnpackDefaultAdminDelayChangeCanceledEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event DefaultAdminDelayChangeCanceled()
func (snapflowEscrow *SnapflowEscrow) UnpackDefaultAdminDelayChangeCanceledEvent(log *types.Log) (*SnapflowEscrowDefaultAdminDelayChangeCanceled, error) {
	event := "DefaultAdminDelayChangeCanceled"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowDefaultAdminDelayChangeCanceled)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowDefaultAdminDelayChangeScheduled represents a DefaultAdminDelayChangeScheduled event raised by the SnapflowEscrow contract.
type SnapflowEscrowDefaultAdminDelayChangeScheduled struct {
	NewDelay       *big.Int
	EffectSchedule *big.Int
	Raw            *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowDefaultAdminDelayChangeScheduledEventName = "DefaultAdminDelayChangeScheduled"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowDefaultAdminDelayChangeScheduled) ContractEventName() string {
	return SnapflowEscrowDefaultAdminDelayChangeScheduledEventName
}

// UnpackDefaultAdminDelayChangeScheduledEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event DefaultAdminDelayChangeScheduled(uint48 newDelay, uint48 effectSchedule)
func (snapflowEscrow *SnapflowEscrow) UnpackDefaultAdminDelayChangeScheduledEvent(log *types.Log) (*SnapflowEscrowDefaultAdminDelayChangeScheduled, error) {
	event := "DefaultAdminDelayChangeScheduled"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowDefaultAdminDelayChangeScheduled)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowDefaultAdminTransferCanceled represents a DefaultAdminTransferCanceled event raised by the SnapflowEscrow contract.
type SnapflowEscrowDefaultAdminTransferCanceled struct {
	Raw *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowDefaultAdminTransferCanceledEventName = "DefaultAdminTransferCanceled"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowDefaultAdminTransferCanceled) ContractEventName() string {
	return SnapflowEscrowDefaultAdminTransferCanceledEventName
}

// UnpackDefaultAdminTransferCanceledEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event DefaultAdminTransferCanceled()
func (snapflowEscrow *SnapflowEscrow) UnpackDefaultAdminTransferCanceledEvent(log *types.Log) (*SnapflowEscrowDefaultAdminTransferCanceled, error) {
	event := "DefaultAdminTransferCanceled"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowDefaultAdminTransferCanceled)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowDefaultAdminTransferScheduled represents a DefaultAdminTransferScheduled event raised by the SnapflowEscrow contract.
type SnapflowEscrowDefaultAdminTransferScheduled struct {
	NewAdmin       common.Address
	AcceptSchedule *big.Int
	Raw            *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowDefaultAdminTransferScheduledEventName = "DefaultAdminTransferScheduled"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowDefaultAdminTransferScheduled) ContractEventName() string {
	return SnapflowEscrowDefaultAdminTransferScheduledEventName
}

// UnpackDefaultAdminTransferScheduledEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event DefaultAdminTransferScheduled(address indexed newAdmin, uint48 acceptSchedule)
func (snapflowEscrow *SnapflowEscrow) UnpackDefaultAdminTransferScheduledEvent(log *types.Log) (*SnapflowEscrowDefaultAdminTransferScheduled, error) {
	event := "DefaultAdminTransferScheduled"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowDefaultAdminTransferScheduled)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowDepositCapsSet represents a DepositCapsSet event raised by the SnapflowEscrow contract.
type SnapflowEscrowDepositCapsSet struct {
	Total      *big.Int
	PerAccount *big.Int
	Raw        *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowDepositCapsSetEventName = "DepositCapsSet"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowDepositCapsSet) ContractEventName() string {
	return SnapflowEscrowDepositCapsSetEventName
}

// UnpackDepositCapsSetEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event DepositCapsSet(uint128 total, uint128 perAccount)
func (snapflowEscrow *SnapflowEscrow) UnpackDepositCapsSetEvent(log *types.Log) (*SnapflowEscrowDepositCapsSet, error) {
	event := "DepositCapsSet"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowDepositCapsSet)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowDeposited represents a Deposited event raised by the SnapflowEscrow contract.
type SnapflowEscrowDeposited struct {
	Customer common.Address
	Payer    common.Address
	Amount   *big.Int
	Raw      *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowDepositedEventName = "Deposited"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowDeposited) ContractEventName() string {
	return SnapflowEscrowDepositedEventName
}

// UnpackDepositedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event Deposited(address indexed customer, address indexed payer, uint256 amount)
func (snapflowEscrow *SnapflowEscrow) UnpackDepositedEvent(log *types.Log) (*SnapflowEscrowDeposited, error) {
	event := "Deposited"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowDeposited)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowEIP712DomainChanged represents a EIP712DomainChanged event raised by the SnapflowEscrow contract.
type SnapflowEscrowEIP712DomainChanged struct {
	Raw *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowEIP712DomainChangedEventName = "EIP712DomainChanged"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowEIP712DomainChanged) ContractEventName() string {
	return SnapflowEscrowEIP712DomainChangedEventName
}

// UnpackEIP712DomainChangedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event EIP712DomainChanged()
func (snapflowEscrow *SnapflowEscrow) UnpackEIP712DomainChangedEvent(log *types.Log) (*SnapflowEscrowEIP712DomainChanged, error) {
	event := "EIP712DomainChanged"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowEIP712DomainChanged)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowFeesSwept represents a FeesSwept event raised by the SnapflowEscrow contract.
type SnapflowEscrowFeesSwept struct {
	FeeReceiver common.Address
	Amount      *big.Int
	Raw         *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowFeesSweptEventName = "FeesSwept"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowFeesSwept) ContractEventName() string {
	return SnapflowEscrowFeesSweptEventName
}

// UnpackFeesSweptEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event FeesSwept(address indexed feeReceiver, uint256 amount)
func (snapflowEscrow *SnapflowEscrow) UnpackFeesSweptEvent(log *types.Log) (*SnapflowEscrowFeesSwept, error) {
	event := "FeesSwept"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowFeesSwept)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowFrozen represents a Frozen event raised by the SnapflowEscrow contract.
type SnapflowEscrowFrozen struct {
	Account common.Address
	Amount  *big.Int
	Raw     *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowFrozenEventName = "Frozen"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowFrozen) ContractEventName() string {
	return SnapflowEscrowFrozenEventName
}

// UnpackFrozenEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event Frozen(address indexed account, uint256 amount)
func (snapflowEscrow *SnapflowEscrow) UnpackFrozenEvent(log *types.Log) (*SnapflowEscrowFrozen, error) {
	event := "Frozen"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowFrozen)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowFrozenReleased represents a FrozenReleased event raised by the SnapflowEscrow contract.
type SnapflowEscrowFrozenReleased struct {
	Account common.Address
	Amount  *big.Int
	Raw     *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowFrozenReleasedEventName = "FrozenReleased"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowFrozenReleased) ContractEventName() string {
	return SnapflowEscrowFrozenReleasedEventName
}

// UnpackFrozenReleasedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event FrozenReleased(address indexed account, uint256 amount)
func (snapflowEscrow *SnapflowEscrow) UnpackFrozenReleasedEvent(log *types.Log) (*SnapflowEscrowFrozenReleased, error) {
	event := "FrozenReleased"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowFrozenReleased)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowHostWithdrawn represents a HostWithdrawn event raised by the SnapflowEscrow contract.
type SnapflowEscrowHostWithdrawn struct {
	Host   common.Address
	Payout common.Address
	Amount *big.Int
	Raw    *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowHostWithdrawnEventName = "HostWithdrawn"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowHostWithdrawn) ContractEventName() string {
	return SnapflowEscrowHostWithdrawnEventName
}

// UnpackHostWithdrawnEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event HostWithdrawn(address indexed host, address indexed payout, uint256 amount)
func (snapflowEscrow *SnapflowEscrow) UnpackHostWithdrawnEvent(log *types.Log) (*SnapflowEscrowHostWithdrawn, error) {
	event := "HostWithdrawn"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowHostWithdrawn)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowPaused represents a Paused event raised by the SnapflowEscrow contract.
type SnapflowEscrowPaused struct {
	Account common.Address
	Raw     *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowPausedEventName = "Paused"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowPaused) ContractEventName() string {
	return SnapflowEscrowPausedEventName
}

// UnpackPausedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event Paused(address account)
func (snapflowEscrow *SnapflowEscrow) UnpackPausedEvent(log *types.Log) (*SnapflowEscrowPaused, error) {
	event := "Paused"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowPaused)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowPayoutAddressSet represents a PayoutAddressSet event raised by the SnapflowEscrow contract.
type SnapflowEscrowPayoutAddressSet struct {
	Host   common.Address
	Payout common.Address
	Raw    *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowPayoutAddressSetEventName = "PayoutAddressSet"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowPayoutAddressSet) ContractEventName() string {
	return SnapflowEscrowPayoutAddressSetEventName
}

// UnpackPayoutAddressSetEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event PayoutAddressSet(address indexed host, address indexed payout)
func (snapflowEscrow *SnapflowEscrow) UnpackPayoutAddressSetEvent(log *types.Log) (*SnapflowEscrowPayoutAddressSet, error) {
	event := "PayoutAddressSet"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowPayoutAddressSet)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowRelayFeePaid represents a RelayFeePaid event raised by the SnapflowEscrow contract.
type SnapflowEscrowRelayFeePaid struct {
	Relayer common.Address
	Payer   common.Address
	Amount  *big.Int
	Raw     *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowRelayFeePaidEventName = "RelayFeePaid"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowRelayFeePaid) ContractEventName() string {
	return SnapflowEscrowRelayFeePaidEventName
}

// UnpackRelayFeePaidEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event RelayFeePaid(address indexed relayer, address indexed payer, uint256 amount)
func (snapflowEscrow *SnapflowEscrow) UnpackRelayFeePaidEvent(log *types.Log) (*SnapflowEscrowRelayFeePaid, error) {
	event := "RelayFeePaid"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowRelayFeePaid)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowRoleAdminChanged represents a RoleAdminChanged event raised by the SnapflowEscrow contract.
type SnapflowEscrowRoleAdminChanged struct {
	Role              [32]byte
	PreviousAdminRole [32]byte
	NewAdminRole      [32]byte
	Raw               *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowRoleAdminChangedEventName = "RoleAdminChanged"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowRoleAdminChanged) ContractEventName() string {
	return SnapflowEscrowRoleAdminChangedEventName
}

// UnpackRoleAdminChangedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)
func (snapflowEscrow *SnapflowEscrow) UnpackRoleAdminChangedEvent(log *types.Log) (*SnapflowEscrowRoleAdminChanged, error) {
	event := "RoleAdminChanged"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowRoleAdminChanged)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowRoleGranted represents a RoleGranted event raised by the SnapflowEscrow contract.
type SnapflowEscrowRoleGranted struct {
	Role    [32]byte
	Account common.Address
	Sender  common.Address
	Raw     *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowRoleGrantedEventName = "RoleGranted"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowRoleGranted) ContractEventName() string {
	return SnapflowEscrowRoleGrantedEventName
}

// UnpackRoleGrantedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
func (snapflowEscrow *SnapflowEscrow) UnpackRoleGrantedEvent(log *types.Log) (*SnapflowEscrowRoleGranted, error) {
	event := "RoleGranted"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowRoleGranted)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowRoleRevoked represents a RoleRevoked event raised by the SnapflowEscrow contract.
type SnapflowEscrowRoleRevoked struct {
	Role    [32]byte
	Account common.Address
	Sender  common.Address
	Raw     *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowRoleRevokedEventName = "RoleRevoked"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowRoleRevoked) ContractEventName() string {
	return SnapflowEscrowRoleRevokedEventName
}

// UnpackRoleRevokedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
func (snapflowEscrow *SnapflowEscrow) UnpackRoleRevokedEvent(log *types.Log) (*SnapflowEscrowRoleRevoked, error) {
	event := "RoleRevoked"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowRoleRevoked)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowSignerAuthorized represents a SignerAuthorized event raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerAuthorized struct {
	Customer  common.Address
	Signer    common.Address
	HourlyCap *big.Int
	Expiry    uint64
	MaxFeeBps uint16
	Host      common.Address
	Raw       *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowSignerAuthorizedEventName = "SignerAuthorized"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowSignerAuthorized) ContractEventName() string {
	return SnapflowEscrowSignerAuthorizedEventName
}

// UnpackSignerAuthorizedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event SignerAuthorized(address indexed customer, address indexed signer, uint96 hourlyCap, uint64 expiry, uint16 maxFeeBps, address host)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerAuthorizedEvent(log *types.Log) (*SnapflowEscrowSignerAuthorized, error) {
	event := "SignerAuthorized"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowSignerAuthorized)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowSignerLimitLowerScheduled represents a SignerLimitLowerScheduled event raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerLimitLowerScheduled struct {
	Customer    common.Address
	Signer      common.Address
	HourlyCap   *big.Int
	EffectiveAt uint64
	Raw         *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowSignerLimitLowerScheduledEventName = "SignerLimitLowerScheduled"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowSignerLimitLowerScheduled) ContractEventName() string {
	return SnapflowEscrowSignerLimitLowerScheduledEventName
}

// UnpackSignerLimitLowerScheduledEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event SignerLimitLowerScheduled(address indexed customer, address indexed signer, uint96 hourlyCap, uint64 effectiveAt)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerLimitLowerScheduledEvent(log *types.Log) (*SnapflowEscrowSignerLimitLowerScheduled, error) {
	event := "SignerLimitLowerScheduled"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowSignerLimitLowerScheduled)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowSignerLimitRaised represents a SignerLimitRaised event raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerLimitRaised struct {
	Customer  common.Address
	Signer    common.Address
	HourlyCap *big.Int
	Expiry    uint64
	Raw       *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowSignerLimitRaisedEventName = "SignerLimitRaised"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowSignerLimitRaised) ContractEventName() string {
	return SnapflowEscrowSignerLimitRaisedEventName
}

// UnpackSignerLimitRaisedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event SignerLimitRaised(address indexed customer, address indexed signer, uint96 hourlyCap, uint64 expiry)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerLimitRaisedEvent(log *types.Log) (*SnapflowEscrowSignerLimitRaised, error) {
	event := "SignerLimitRaised"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowSignerLimitRaised)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowSignerRevoked represents a SignerRevoked event raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerRevoked struct {
	Customer common.Address
	Signer   common.Address
	Raw      *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowSignerRevokedEventName = "SignerRevoked"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowSignerRevoked) ContractEventName() string {
	return SnapflowEscrowSignerRevokedEventName
}

// UnpackSignerRevokedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event SignerRevoked(address indexed customer, address indexed signer)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerRevokedEvent(log *types.Log) (*SnapflowEscrowSignerRevoked, error) {
	event := "SignerRevoked"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowSignerRevoked)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowSignerThawed represents a SignerThawed event raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerThawed struct {
	Customer common.Address
	Signer   common.Address
	ThawEnd  uint64
	Raw      *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowSignerThawedEventName = "SignerThawed"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowSignerThawed) ContractEventName() string {
	return SnapflowEscrowSignerThawedEventName
}

// UnpackSignerThawedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event SignerThawed(address indexed customer, address indexed signer, uint64 thawEnd)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerThawedEvent(log *types.Log) (*SnapflowEscrowSignerThawed, error) {
	event := "SignerThawed"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowSignerThawed)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowSurplusRecovered represents a SurplusRecovered event raised by the SnapflowEscrow contract.
type SnapflowEscrowSurplusRecovered struct {
	To     common.Address
	Amount *big.Int
	Raw    *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowSurplusRecoveredEventName = "SurplusRecovered"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowSurplusRecovered) ContractEventName() string {
	return SnapflowEscrowSurplusRecoveredEventName
}

// UnpackSurplusRecoveredEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event SurplusRecovered(address indexed to, uint256 amount)
func (snapflowEscrow *SnapflowEscrow) UnpackSurplusRecoveredEvent(log *types.Log) (*SnapflowEscrowSurplusRecovered, error) {
	event := "SurplusRecovered"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowSurplusRecovered)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowUnpaused represents a Unpaused event raised by the SnapflowEscrow contract.
type SnapflowEscrowUnpaused struct {
	Account common.Address
	Raw     *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowUnpausedEventName = "Unpaused"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowUnpaused) ContractEventName() string {
	return SnapflowEscrowUnpausedEventName
}

// UnpackUnpausedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event Unpaused(address account)
func (snapflowEscrow *SnapflowEscrow) UnpackUnpausedEvent(log *types.Log) (*SnapflowEscrowUnpaused, error) {
	event := "Unpaused"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowUnpaused)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowWithdrawalCancelled represents a WithdrawalCancelled event raised by the SnapflowEscrow contract.
type SnapflowEscrowWithdrawalCancelled struct {
	Account common.Address
	Amount  *big.Int
	Raw     *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowWithdrawalCancelledEventName = "WithdrawalCancelled"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowWithdrawalCancelled) ContractEventName() string {
	return SnapflowEscrowWithdrawalCancelledEventName
}

// UnpackWithdrawalCancelledEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event WithdrawalCancelled(address indexed account, uint128 amount)
func (snapflowEscrow *SnapflowEscrow) UnpackWithdrawalCancelledEvent(log *types.Log) (*SnapflowEscrowWithdrawalCancelled, error) {
	event := "WithdrawalCancelled"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowWithdrawalCancelled)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowWithdrawalRequested represents a WithdrawalRequested event raised by the SnapflowEscrow contract.
type SnapflowEscrowWithdrawalRequested struct {
	Account  common.Address
	Amount   *big.Int
	Pending  *big.Int
	UnlockAt uint64
	Raw      *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowWithdrawalRequestedEventName = "WithdrawalRequested"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowWithdrawalRequested) ContractEventName() string {
	return SnapflowEscrowWithdrawalRequestedEventName
}

// UnpackWithdrawalRequestedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event WithdrawalRequested(address indexed account, uint256 amount, uint128 pending, uint64 unlockAt)
func (snapflowEscrow *SnapflowEscrow) UnpackWithdrawalRequestedEvent(log *types.Log) (*SnapflowEscrowWithdrawalRequested, error) {
	event := "WithdrawalRequested"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowWithdrawalRequested)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// SnapflowEscrowWithdrawn represents a Withdrawn event raised by the SnapflowEscrow contract.
type SnapflowEscrowWithdrawn struct {
	Account common.Address
	Amount  *big.Int
	Raw     *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowWithdrawnEventName = "Withdrawn"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowWithdrawn) ContractEventName() string {
	return SnapflowEscrowWithdrawnEventName
}

// UnpackWithdrawnEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event Withdrawn(address indexed account, uint256 amount)
func (snapflowEscrow *SnapflowEscrow) UnpackWithdrawnEvent(log *types.Log) (*SnapflowEscrowWithdrawn, error) {
	event := "Withdrawn"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowWithdrawn)
	if len(log.Data) > 0 {
		if err := snapflowEscrow.abi.UnpackIntoInterface(out, event, log.Data); err != nil {
			return nil, err
		}
	}
	var indexed abi.Arguments
	for _, arg := range snapflowEscrow.abi.Events[event].Inputs {
		if arg.Indexed {
			indexed = append(indexed, arg)
		}
	}
	if err := abi.ParseTopics(out, indexed, log.Topics[1:]); err != nil {
		return nil, err
	}
	out.Raw = log
	return out, nil
}

// UnpackError attempts to decode the provided error data using user-defined
// error definitions.
func (snapflowEscrow *SnapflowEscrow) UnpackError(raw []byte) (any, error) {
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AccessControlBadConfirmation"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAccessControlBadConfirmationError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AccessControlEnforcedDefaultAdminDelay"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAccessControlEnforcedDefaultAdminDelayError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AccessControlEnforcedDefaultAdminRules"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAccessControlEnforcedDefaultAdminRulesError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AccessControlInvalidDefaultAdmin"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAccessControlInvalidDefaultAdminError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AccessControlUnauthorizedAccount"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAccessControlUnauthorizedAccountError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AccountDepositCapExceeded"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAccountDepositCapExceededError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AccountNotBlocked"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAccountNotBlockedError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AdminDelayTooShort"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAdminDelayTooShortError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AutoTopUpIntervalTooShort"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAutoTopUpIntervalTooShortError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AutoTopUpNotEnabled"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAutoTopUpNotEnabledError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AutoTopUpNotNeeded"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAutoTopUpNotNeededError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AutoTopUpTooSoon"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAutoTopUpTooSoonError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["BatchTooLarge"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackBatchTooLargeError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["BlockDurationOutOfRange"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackBlockDurationOutOfRangeError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["Blocked"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackBlockedError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["ClaimWindowOutOfRange"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackClaimWindowOutOfRangeError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["ClaimsAreFrozen"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackClaimsAreFrozenError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["ClaimsFreezeArmed"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackClaimsFreezeArmedError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["ClaimsFreezeCoolingDown"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackClaimsFreezeCoolingDownError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["ClaimsFreezeTooLong"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackClaimsFreezeTooLongError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["ClaimsFreezeUnavailable"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackClaimsFreezeUnavailableError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["CustomerBlockedForVoucher"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackCustomerBlockedForVoucherError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["EmptyBatch"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackEmptyBatchError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["EnforcedPause"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackEnforcedPauseError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["ExpectedPause"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackExpectedPauseError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["FeeAboveSignerLimit"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackFeeAboveSignerLimitError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["HostWithdrawalSignatureExpired"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackHostWithdrawalSignatureExpiredError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InsufficientBalance"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInsufficientBalanceError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InsufficientFreeBalance"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInsufficientFreeBalanceError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InvalidAutoTopUpRelayer"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInvalidAutoTopUpRelayerError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InvalidHostWithdrawalSignature"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInvalidHostWithdrawalSignatureError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InvalidPayoutSignature"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInvalidPayoutSignatureError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InvalidShortString"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInvalidShortStringError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InvalidSignature"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInvalidSignatureError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InvalidSigner"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInvalidSignerError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InvalidSignerProof"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInvalidSignerProofError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InvalidSignerScope"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInvalidSignerScopeError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InvalidVoucherTerms"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInvalidVoucherTermsError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["NoSurplus"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackNoSurplusError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["NoWithdrawalPending"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackNoWithdrawalPendingError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["NotAuthorized"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackNotAuthorizedError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["NothingToClaim"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackNothingToClaimError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["NothingToWithdraw"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackNothingToWithdrawError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["PayoutSignatureExpired"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackPayoutSignatureExpiredError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["ReentrancyGuardReentrantCall"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackReentrancyGuardReentrantCallError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["RelayFeeTooHigh"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackRelayFeeTooHighError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SafeCastOverflowedUintDowncast"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSafeCastOverflowedUintDowncastError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SafeERC20FailedOperation"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSafeERC20FailedOperationError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SignerAlreadyBound"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSignerAlreadyBoundError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SignerAlreadyThawing"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSignerAlreadyThawingError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SignerCapReached"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSignerCapReachedError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SignerExpired"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSignerExpiredError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SignerHostMismatch"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSignerHostMismatchError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SignerNotAuthorized"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSignerNotAuthorizedError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SignerNotThawing"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSignerNotThawingError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SignerProofExpired"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSignerProofExpiredError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SignerStillThawing"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSignerStillThawingError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SignerThawPeriodOutOfRange"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSignerThawPeriodOutOfRangeError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["StringTooLong"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackStringTooLongError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["TotalDepositCapExceeded"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackTotalDepositCapExceededError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["VoucherFromFuture"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackVoucherFromFutureError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["WithdrawalDelayOutOfRange"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackWithdrawalDelayOutOfRangeError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["WithdrawalLocked"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackWithdrawalLockedError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["ZeroAddress"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackZeroAddressError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["ZeroAmount"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackZeroAmountError(raw[4:])
	}
	return nil, errors.New("Unknown error")
}

// SnapflowEscrowAccessControlBadConfirmation represents a AccessControlBadConfirmation error raised by the SnapflowEscrow contract.
type SnapflowEscrowAccessControlBadConfirmation struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AccessControlBadConfirmation()
func SnapflowEscrowAccessControlBadConfirmationErrorID() common.Hash {
	return common.HexToHash("0x6697b23232a647058342c0724fe7c415cab25915b54e5dbc03f233173d37b41c")
}

// UnpackAccessControlBadConfirmationError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AccessControlBadConfirmation()
func (snapflowEscrow *SnapflowEscrow) UnpackAccessControlBadConfirmationError(raw []byte) (*SnapflowEscrowAccessControlBadConfirmation, error) {
	out := new(SnapflowEscrowAccessControlBadConfirmation)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AccessControlBadConfirmation", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowAccessControlEnforcedDefaultAdminDelay represents a AccessControlEnforcedDefaultAdminDelay error raised by the SnapflowEscrow contract.
type SnapflowEscrowAccessControlEnforcedDefaultAdminDelay struct {
	Schedule *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AccessControlEnforcedDefaultAdminDelay(uint48 schedule)
func SnapflowEscrowAccessControlEnforcedDefaultAdminDelayErrorID() common.Hash {
	return common.HexToHash("0x19ca5ebb8fb33f00e502c9392eddab1501674629178bf69b853cf037aaf4bb5d")
}

// UnpackAccessControlEnforcedDefaultAdminDelayError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AccessControlEnforcedDefaultAdminDelay(uint48 schedule)
func (snapflowEscrow *SnapflowEscrow) UnpackAccessControlEnforcedDefaultAdminDelayError(raw []byte) (*SnapflowEscrowAccessControlEnforcedDefaultAdminDelay, error) {
	out := new(SnapflowEscrowAccessControlEnforcedDefaultAdminDelay)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AccessControlEnforcedDefaultAdminDelay", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowAccessControlEnforcedDefaultAdminRules represents a AccessControlEnforcedDefaultAdminRules error raised by the SnapflowEscrow contract.
type SnapflowEscrowAccessControlEnforcedDefaultAdminRules struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AccessControlEnforcedDefaultAdminRules()
func SnapflowEscrowAccessControlEnforcedDefaultAdminRulesErrorID() common.Hash {
	return common.HexToHash("0x3fc3c27ae3db78c81b8f6e685172134623efa268ee8cd8d54be38ad2a74fc13b")
}

// UnpackAccessControlEnforcedDefaultAdminRulesError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AccessControlEnforcedDefaultAdminRules()
func (snapflowEscrow *SnapflowEscrow) UnpackAccessControlEnforcedDefaultAdminRulesError(raw []byte) (*SnapflowEscrowAccessControlEnforcedDefaultAdminRules, error) {
	out := new(SnapflowEscrowAccessControlEnforcedDefaultAdminRules)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AccessControlEnforcedDefaultAdminRules", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowAccessControlInvalidDefaultAdmin represents a AccessControlInvalidDefaultAdmin error raised by the SnapflowEscrow contract.
type SnapflowEscrowAccessControlInvalidDefaultAdmin struct {
	DefaultAdmin common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AccessControlInvalidDefaultAdmin(address defaultAdmin)
func SnapflowEscrowAccessControlInvalidDefaultAdminErrorID() common.Hash {
	return common.HexToHash("0xc22c8022f2a840d6b6a9f113407715f5bbd4e88c1b0dd9434dc00700ba609ed4")
}

// UnpackAccessControlInvalidDefaultAdminError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AccessControlInvalidDefaultAdmin(address defaultAdmin)
func (snapflowEscrow *SnapflowEscrow) UnpackAccessControlInvalidDefaultAdminError(raw []byte) (*SnapflowEscrowAccessControlInvalidDefaultAdmin, error) {
	out := new(SnapflowEscrowAccessControlInvalidDefaultAdmin)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AccessControlInvalidDefaultAdmin", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowAccessControlUnauthorizedAccount represents a AccessControlUnauthorizedAccount error raised by the SnapflowEscrow contract.
type SnapflowEscrowAccessControlUnauthorizedAccount struct {
	Account    common.Address
	NeededRole [32]byte
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)
func SnapflowEscrowAccessControlUnauthorizedAccountErrorID() common.Hash {
	return common.HexToHash("0xe2517d3fbfae6f8515ef5ff1ccedc3933ab0cbbda0b492c06eb54ad10ef03b3e")
}

// UnpackAccessControlUnauthorizedAccountError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)
func (snapflowEscrow *SnapflowEscrow) UnpackAccessControlUnauthorizedAccountError(raw []byte) (*SnapflowEscrowAccessControlUnauthorizedAccount, error) {
	out := new(SnapflowEscrowAccessControlUnauthorizedAccount)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AccessControlUnauthorizedAccount", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowAccountDepositCapExceeded represents a AccountDepositCapExceeded error raised by the SnapflowEscrow contract.
type SnapflowEscrowAccountDepositCapExceeded struct {
	Account common.Address
	Amount  *big.Int
	Room    *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AccountDepositCapExceeded(address account, uint256 amount, uint256 room)
func SnapflowEscrowAccountDepositCapExceededErrorID() common.Hash {
	return common.HexToHash("0x033acb34d6bbfba851cc241e411d2a8fb1cb5410c89d6f0c194592565d2a7a71")
}

// UnpackAccountDepositCapExceededError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AccountDepositCapExceeded(address account, uint256 amount, uint256 room)
func (snapflowEscrow *SnapflowEscrow) UnpackAccountDepositCapExceededError(raw []byte) (*SnapflowEscrowAccountDepositCapExceeded, error) {
	out := new(SnapflowEscrowAccountDepositCapExceeded)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AccountDepositCapExceeded", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowAccountNotBlocked represents a AccountNotBlocked error raised by the SnapflowEscrow contract.
type SnapflowEscrowAccountNotBlocked struct {
	Account common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AccountNotBlocked(address account)
func SnapflowEscrowAccountNotBlockedErrorID() common.Hash {
	return common.HexToHash("0x64a5cb4618519a0f6f8f9756b90b9c7e8b719bb3c89d075ab457079baf961702")
}

// UnpackAccountNotBlockedError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AccountNotBlocked(address account)
func (snapflowEscrow *SnapflowEscrow) UnpackAccountNotBlockedError(raw []byte) (*SnapflowEscrowAccountNotBlocked, error) {
	out := new(SnapflowEscrowAccountNotBlocked)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AccountNotBlocked", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowAdminDelayTooShort represents a AdminDelayTooShort error raised by the SnapflowEscrow contract.
type SnapflowEscrowAdminDelayTooShort struct {
	Delay    *big.Int
	MinDelay *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AdminDelayTooShort(uint48 delay, uint48 minDelay)
func SnapflowEscrowAdminDelayTooShortErrorID() common.Hash {
	return common.HexToHash("0x856ca1db85b7a75bcbfce54b699aa287b1f6bab1acd39147b65a9c715ddb13e9")
}

// UnpackAdminDelayTooShortError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AdminDelayTooShort(uint48 delay, uint48 minDelay)
func (snapflowEscrow *SnapflowEscrow) UnpackAdminDelayTooShortError(raw []byte) (*SnapflowEscrowAdminDelayTooShort, error) {
	out := new(SnapflowEscrowAdminDelayTooShort)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AdminDelayTooShort", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowAutoTopUpIntervalTooShort represents a AutoTopUpIntervalTooShort error raised by the SnapflowEscrow contract.
type SnapflowEscrowAutoTopUpIntervalTooShort struct {
	Interval    uint32
	MinInterval uint32
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AutoTopUpIntervalTooShort(uint32 interval, uint32 minInterval)
func SnapflowEscrowAutoTopUpIntervalTooShortErrorID() common.Hash {
	return common.HexToHash("0x91b3c8a8452c821aeb695e5a233fa8fadb5c146e35519cdaae09e5710baa930c")
}

// UnpackAutoTopUpIntervalTooShortError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AutoTopUpIntervalTooShort(uint32 interval, uint32 minInterval)
func (snapflowEscrow *SnapflowEscrow) UnpackAutoTopUpIntervalTooShortError(raw []byte) (*SnapflowEscrowAutoTopUpIntervalTooShort, error) {
	out := new(SnapflowEscrowAutoTopUpIntervalTooShort)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AutoTopUpIntervalTooShort", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowAutoTopUpNotEnabled represents a AutoTopUpNotEnabled error raised by the SnapflowEscrow contract.
type SnapflowEscrowAutoTopUpNotEnabled struct {
	Customer common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AutoTopUpNotEnabled(address customer)
func SnapflowEscrowAutoTopUpNotEnabledErrorID() common.Hash {
	return common.HexToHash("0x55449dd74549fa0544dd069eb799772293866a008cfaec61251aa21f36aa7fd8")
}

// UnpackAutoTopUpNotEnabledError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AutoTopUpNotEnabled(address customer)
func (snapflowEscrow *SnapflowEscrow) UnpackAutoTopUpNotEnabledError(raw []byte) (*SnapflowEscrowAutoTopUpNotEnabled, error) {
	out := new(SnapflowEscrowAutoTopUpNotEnabled)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AutoTopUpNotEnabled", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowAutoTopUpNotNeeded represents a AutoTopUpNotNeeded error raised by the SnapflowEscrow contract.
type SnapflowEscrowAutoTopUpNotNeeded struct {
	Customer  common.Address
	Available *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AutoTopUpNotNeeded(address customer, uint256 available)
func SnapflowEscrowAutoTopUpNotNeededErrorID() common.Hash {
	return common.HexToHash("0xbb043c129a09d5e485ddc91deafaac71e2a13f71f8afe6ed381d11836208dd41")
}

// UnpackAutoTopUpNotNeededError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AutoTopUpNotNeeded(address customer, uint256 available)
func (snapflowEscrow *SnapflowEscrow) UnpackAutoTopUpNotNeededError(raw []byte) (*SnapflowEscrowAutoTopUpNotNeeded, error) {
	out := new(SnapflowEscrowAutoTopUpNotNeeded)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AutoTopUpNotNeeded", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowAutoTopUpTooSoon represents a AutoTopUpTooSoon error raised by the SnapflowEscrow contract.
type SnapflowEscrowAutoTopUpTooSoon struct {
	Customer common.Address
	NextAt   uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AutoTopUpTooSoon(address customer, uint64 nextAt)
func SnapflowEscrowAutoTopUpTooSoonErrorID() common.Hash {
	return common.HexToHash("0x447f02c1c9f37861d776940c343d61e814c2a2a5fbf77bfd6c00797d0a56a7d0")
}

// UnpackAutoTopUpTooSoonError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AutoTopUpTooSoon(address customer, uint64 nextAt)
func (snapflowEscrow *SnapflowEscrow) UnpackAutoTopUpTooSoonError(raw []byte) (*SnapflowEscrowAutoTopUpTooSoon, error) {
	out := new(SnapflowEscrowAutoTopUpTooSoon)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AutoTopUpTooSoon", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowBatchTooLarge represents a BatchTooLarge error raised by the SnapflowEscrow contract.
type SnapflowEscrowBatchTooLarge struct {
	Size    *big.Int
	MaxSize *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error BatchTooLarge(uint256 size, uint256 maxSize)
func SnapflowEscrowBatchTooLargeErrorID() common.Hash {
	return common.HexToHash("0xbb1cb70bcc2ddbaabd8d251943ebb6b48ae10b9f78ce35a6f00b43eac7ae64f1")
}

// UnpackBatchTooLargeError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error BatchTooLarge(uint256 size, uint256 maxSize)
func (snapflowEscrow *SnapflowEscrow) UnpackBatchTooLargeError(raw []byte) (*SnapflowEscrowBatchTooLarge, error) {
	out := new(SnapflowEscrowBatchTooLarge)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "BatchTooLarge", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowBlockDurationOutOfRange represents a BlockDurationOutOfRange error raised by the SnapflowEscrow contract.
type SnapflowEscrowBlockDurationOutOfRange struct {
	Duration    uint64
	MaxDuration uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error BlockDurationOutOfRange(uint64 duration, uint64 maxDuration)
func SnapflowEscrowBlockDurationOutOfRangeErrorID() common.Hash {
	return common.HexToHash("0x23121bc5d7d40b99aa22c0b22bdc44d753b0168691c777b7b4df7bba77845072")
}

// UnpackBlockDurationOutOfRangeError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error BlockDurationOutOfRange(uint64 duration, uint64 maxDuration)
func (snapflowEscrow *SnapflowEscrow) UnpackBlockDurationOutOfRangeError(raw []byte) (*SnapflowEscrowBlockDurationOutOfRange, error) {
	out := new(SnapflowEscrowBlockDurationOutOfRange)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "BlockDurationOutOfRange", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowBlocked represents a Blocked error raised by the SnapflowEscrow contract.
type SnapflowEscrowBlocked struct {
	Account common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error Blocked(address account)
func SnapflowEscrowBlockedErrorID() common.Hash {
	return common.HexToHash("0x75e91ce73c1d3352d8dd3610443539cd33dfe13b1de8f8caae54ec26dd0dc9cb")
}

// UnpackBlockedError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error Blocked(address account)
func (snapflowEscrow *SnapflowEscrow) UnpackBlockedError(raw []byte) (*SnapflowEscrowBlocked, error) {
	out := new(SnapflowEscrowBlocked)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "Blocked", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowClaimWindowOutOfRange represents a ClaimWindowOutOfRange error raised by the SnapflowEscrow contract.
type SnapflowEscrowClaimWindowOutOfRange struct {
	Window uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error ClaimWindowOutOfRange(uint64 window)
func SnapflowEscrowClaimWindowOutOfRangeErrorID() common.Hash {
	return common.HexToHash("0x6210d3ffb4f36bb4588319345dd4ba74b22d77cb44d9dbd21c205a9f75231223")
}

// UnpackClaimWindowOutOfRangeError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error ClaimWindowOutOfRange(uint64 window)
func (snapflowEscrow *SnapflowEscrow) UnpackClaimWindowOutOfRangeError(raw []byte) (*SnapflowEscrowClaimWindowOutOfRange, error) {
	out := new(SnapflowEscrowClaimWindowOutOfRange)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "ClaimWindowOutOfRange", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowClaimsAreFrozen represents a ClaimsAreFrozen error raised by the SnapflowEscrow contract.
type SnapflowEscrowClaimsAreFrozen struct {
	Until uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error ClaimsAreFrozen(uint64 until)
func SnapflowEscrowClaimsAreFrozenErrorID() common.Hash {
	return common.HexToHash("0x9d56481efa1b71763bae0f55dea9eada2142933e01f92c105ac975604b8b8e26")
}

// UnpackClaimsAreFrozenError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error ClaimsAreFrozen(uint64 until)
func (snapflowEscrow *SnapflowEscrow) UnpackClaimsAreFrozenError(raw []byte) (*SnapflowEscrowClaimsAreFrozen, error) {
	out := new(SnapflowEscrowClaimsAreFrozen)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "ClaimsAreFrozen", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowClaimsFreezeArmed represents a ClaimsFreezeArmed error raised by the SnapflowEscrow contract.
type SnapflowEscrowClaimsFreezeArmed struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error ClaimsFreezeArmed()
func SnapflowEscrowClaimsFreezeArmedErrorID() common.Hash {
	return common.HexToHash("0x10874b2ea50bdef8c693f99cb0a02fff1e3cad83292f2ad8d50293a91b629ca1")
}

// UnpackClaimsFreezeArmedError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error ClaimsFreezeArmed()
func (snapflowEscrow *SnapflowEscrow) UnpackClaimsFreezeArmedError(raw []byte) (*SnapflowEscrowClaimsFreezeArmed, error) {
	out := new(SnapflowEscrowClaimsFreezeArmed)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "ClaimsFreezeArmed", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowClaimsFreezeCoolingDown represents a ClaimsFreezeCoolingDown error raised by the SnapflowEscrow contract.
type SnapflowEscrowClaimsFreezeCoolingDown struct {
	RearmAt uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error ClaimsFreezeCoolingDown(uint64 rearmAt)
func SnapflowEscrowClaimsFreezeCoolingDownErrorID() common.Hash {
	return common.HexToHash("0xa85d6da520f4f754acde1d06edd7b96b6ae3e492a886435dc00dacf88e1182bb")
}

// UnpackClaimsFreezeCoolingDownError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error ClaimsFreezeCoolingDown(uint64 rearmAt)
func (snapflowEscrow *SnapflowEscrow) UnpackClaimsFreezeCoolingDownError(raw []byte) (*SnapflowEscrowClaimsFreezeCoolingDown, error) {
	out := new(SnapflowEscrowClaimsFreezeCoolingDown)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "ClaimsFreezeCoolingDown", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowClaimsFreezeTooLong represents a ClaimsFreezeTooLong error raised by the SnapflowEscrow contract.
type SnapflowEscrowClaimsFreezeTooLong struct {
	Duration    uint64
	MaxDuration uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error ClaimsFreezeTooLong(uint64 duration, uint64 maxDuration)
func SnapflowEscrowClaimsFreezeTooLongErrorID() common.Hash {
	return common.HexToHash("0xc2137dfccbb2359bcefabe3429a3aad769a0b5ca1f44a05b6de8d7b9cff4b27b")
}

// UnpackClaimsFreezeTooLongError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error ClaimsFreezeTooLong(uint64 duration, uint64 maxDuration)
func (snapflowEscrow *SnapflowEscrow) UnpackClaimsFreezeTooLongError(raw []byte) (*SnapflowEscrowClaimsFreezeTooLong, error) {
	out := new(SnapflowEscrowClaimsFreezeTooLong)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "ClaimsFreezeTooLong", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowClaimsFreezeUnavailable represents a ClaimsFreezeUnavailable error raised by the SnapflowEscrow contract.
type SnapflowEscrowClaimsFreezeUnavailable struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error ClaimsFreezeUnavailable()
func SnapflowEscrowClaimsFreezeUnavailableErrorID() common.Hash {
	return common.HexToHash("0x808ad73f840beb74844857cb1b77987817fe7437cdd8194eb102b5ea4d34430f")
}

// UnpackClaimsFreezeUnavailableError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error ClaimsFreezeUnavailable()
func (snapflowEscrow *SnapflowEscrow) UnpackClaimsFreezeUnavailableError(raw []byte) (*SnapflowEscrowClaimsFreezeUnavailable, error) {
	out := new(SnapflowEscrowClaimsFreezeUnavailable)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "ClaimsFreezeUnavailable", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowCustomerBlockedForVoucher represents a CustomerBlockedForVoucher error raised by the SnapflowEscrow contract.
type SnapflowEscrowCustomerBlockedForVoucher struct {
	Customer  common.Address
	BlockedAt uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error CustomerBlockedForVoucher(address customer, uint64 blockedAt)
func SnapflowEscrowCustomerBlockedForVoucherErrorID() common.Hash {
	return common.HexToHash("0x882a3c85ac2ad19d148a3bfc8064a222eb08f0bcd796aa4ff2eca5b3108fd77d")
}

// UnpackCustomerBlockedForVoucherError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error CustomerBlockedForVoucher(address customer, uint64 blockedAt)
func (snapflowEscrow *SnapflowEscrow) UnpackCustomerBlockedForVoucherError(raw []byte) (*SnapflowEscrowCustomerBlockedForVoucher, error) {
	out := new(SnapflowEscrowCustomerBlockedForVoucher)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "CustomerBlockedForVoucher", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowEmptyBatch represents a EmptyBatch error raised by the SnapflowEscrow contract.
type SnapflowEscrowEmptyBatch struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error EmptyBatch()
func SnapflowEscrowEmptyBatchErrorID() common.Hash {
	return common.HexToHash("0xc2e5347df6cf8d1bf68f8a9651642312bd381b900d857d97cd665976180d6ae0")
}

// UnpackEmptyBatchError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error EmptyBatch()
func (snapflowEscrow *SnapflowEscrow) UnpackEmptyBatchError(raw []byte) (*SnapflowEscrowEmptyBatch, error) {
	out := new(SnapflowEscrowEmptyBatch)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "EmptyBatch", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowEnforcedPause represents a EnforcedPause error raised by the SnapflowEscrow contract.
type SnapflowEscrowEnforcedPause struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error EnforcedPause()
func SnapflowEscrowEnforcedPauseErrorID() common.Hash {
	return common.HexToHash("0xd93c0665d6c96d04a8f174024fc4ddd66c250604aff22bbec808de86dd3637e3")
}

// UnpackEnforcedPauseError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error EnforcedPause()
func (snapflowEscrow *SnapflowEscrow) UnpackEnforcedPauseError(raw []byte) (*SnapflowEscrowEnforcedPause, error) {
	out := new(SnapflowEscrowEnforcedPause)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "EnforcedPause", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowExpectedPause represents a ExpectedPause error raised by the SnapflowEscrow contract.
type SnapflowEscrowExpectedPause struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error ExpectedPause()
func SnapflowEscrowExpectedPauseErrorID() common.Hash {
	return common.HexToHash("0x8dfc202bcfe9a735b559bee70674422512bc5c30f687046ae8778315fb81da44")
}

// UnpackExpectedPauseError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error ExpectedPause()
func (snapflowEscrow *SnapflowEscrow) UnpackExpectedPauseError(raw []byte) (*SnapflowEscrowExpectedPause, error) {
	out := new(SnapflowEscrowExpectedPause)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "ExpectedPause", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowFeeAboveSignerLimit represents a FeeAboveSignerLimit error raised by the SnapflowEscrow contract.
type SnapflowEscrowFeeAboveSignerLimit struct {
	FeeBps    uint16
	MaxFeeBps uint16
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error FeeAboveSignerLimit(uint16 feeBps, uint16 maxFeeBps)
func SnapflowEscrowFeeAboveSignerLimitErrorID() common.Hash {
	return common.HexToHash("0x8d555f748b1c21809dffa6d93e6af4342c6470d9256ba8f063d2e22a43781b88")
}

// UnpackFeeAboveSignerLimitError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error FeeAboveSignerLimit(uint16 feeBps, uint16 maxFeeBps)
func (snapflowEscrow *SnapflowEscrow) UnpackFeeAboveSignerLimitError(raw []byte) (*SnapflowEscrowFeeAboveSignerLimit, error) {
	out := new(SnapflowEscrowFeeAboveSignerLimit)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "FeeAboveSignerLimit", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowHostWithdrawalSignatureExpired represents a HostWithdrawalSignatureExpired error raised by the SnapflowEscrow contract.
type SnapflowEscrowHostWithdrawalSignatureExpired struct {
	Deadline *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error HostWithdrawalSignatureExpired(uint256 deadline)
func SnapflowEscrowHostWithdrawalSignatureExpiredErrorID() common.Hash {
	return common.HexToHash("0x289187a21f2192f5c9273aae9a460a48b5c23510cbcdb98bd15eba4caf13d212")
}

// UnpackHostWithdrawalSignatureExpiredError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error HostWithdrawalSignatureExpired(uint256 deadline)
func (snapflowEscrow *SnapflowEscrow) UnpackHostWithdrawalSignatureExpiredError(raw []byte) (*SnapflowEscrowHostWithdrawalSignatureExpired, error) {
	out := new(SnapflowEscrowHostWithdrawalSignatureExpired)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "HostWithdrawalSignatureExpired", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInsufficientBalance represents a InsufficientBalance error raised by the SnapflowEscrow contract.
type SnapflowEscrowInsufficientBalance struct {
	Customer common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InsufficientBalance(address customer)
func SnapflowEscrowInsufficientBalanceErrorID() common.Hash {
	return common.HexToHash("0x897f6c58f7b09a7a695bc1b4477556860208a3df666f44a955021ce19789a5f6")
}

// UnpackInsufficientBalanceError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InsufficientBalance(address customer)
func (snapflowEscrow *SnapflowEscrow) UnpackInsufficientBalanceError(raw []byte) (*SnapflowEscrowInsufficientBalance, error) {
	out := new(SnapflowEscrowInsufficientBalance)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InsufficientBalance", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInsufficientFreeBalance represents a InsufficientFreeBalance error raised by the SnapflowEscrow contract.
type SnapflowEscrowInsufficientFreeBalance struct {
	Account   common.Address
	Requested *big.Int
	Available *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InsufficientFreeBalance(address account, uint256 requested, uint256 available)
func SnapflowEscrowInsufficientFreeBalanceErrorID() common.Hash {
	return common.HexToHash("0x650ad570b0411532ff1735d6ffba99e6fcf303cdb7e9ad182eaac8bb05ae03b1")
}

// UnpackInsufficientFreeBalanceError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InsufficientFreeBalance(address account, uint256 requested, uint256 available)
func (snapflowEscrow *SnapflowEscrow) UnpackInsufficientFreeBalanceError(raw []byte) (*SnapflowEscrowInsufficientFreeBalance, error) {
	out := new(SnapflowEscrowInsufficientFreeBalance)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InsufficientFreeBalance", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInvalidAutoTopUpRelayer represents a InvalidAutoTopUpRelayer error raised by the SnapflowEscrow contract.
type SnapflowEscrowInvalidAutoTopUpRelayer struct {
	Relayer common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InvalidAutoTopUpRelayer(address relayer)
func SnapflowEscrowInvalidAutoTopUpRelayerErrorID() common.Hash {
	return common.HexToHash("0xfca19d75af54981106f1312fed3ff8447d8f0bcb66ea962e6e1572b46a800a7c")
}

// UnpackInvalidAutoTopUpRelayerError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InvalidAutoTopUpRelayer(address relayer)
func (snapflowEscrow *SnapflowEscrow) UnpackInvalidAutoTopUpRelayerError(raw []byte) (*SnapflowEscrowInvalidAutoTopUpRelayer, error) {
	out := new(SnapflowEscrowInvalidAutoTopUpRelayer)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InvalidAutoTopUpRelayer", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInvalidHostWithdrawalSignature represents a InvalidHostWithdrawalSignature error raised by the SnapflowEscrow contract.
type SnapflowEscrowInvalidHostWithdrawalSignature struct {
	Host common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InvalidHostWithdrawalSignature(address host)
func SnapflowEscrowInvalidHostWithdrawalSignatureErrorID() common.Hash {
	return common.HexToHash("0x29458235b25aa6ce6e27ebd610a74ae49498d6a83fd16c2655bc0308dbbaa402")
}

// UnpackInvalidHostWithdrawalSignatureError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InvalidHostWithdrawalSignature(address host)
func (snapflowEscrow *SnapflowEscrow) UnpackInvalidHostWithdrawalSignatureError(raw []byte) (*SnapflowEscrowInvalidHostWithdrawalSignature, error) {
	out := new(SnapflowEscrowInvalidHostWithdrawalSignature)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InvalidHostWithdrawalSignature", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInvalidPayoutSignature represents a InvalidPayoutSignature error raised by the SnapflowEscrow contract.
type SnapflowEscrowInvalidPayoutSignature struct {
	Host common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InvalidPayoutSignature(address host)
func SnapflowEscrowInvalidPayoutSignatureErrorID() common.Hash {
	return common.HexToHash("0xbb86b54e2c45117b6a454e04925d42117e941fb5a929a1c4cd17623456a59881")
}

// UnpackInvalidPayoutSignatureError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InvalidPayoutSignature(address host)
func (snapflowEscrow *SnapflowEscrow) UnpackInvalidPayoutSignatureError(raw []byte) (*SnapflowEscrowInvalidPayoutSignature, error) {
	out := new(SnapflowEscrowInvalidPayoutSignature)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InvalidPayoutSignature", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInvalidShortString represents a InvalidShortString error raised by the SnapflowEscrow contract.
type SnapflowEscrowInvalidShortString struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InvalidShortString()
func SnapflowEscrowInvalidShortStringErrorID() common.Hash {
	return common.HexToHash("0xb3512b0c6163e5f0bafab72bb631b9d58cd7a731b082f910338aa21c83d5c274")
}

// UnpackInvalidShortStringError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InvalidShortString()
func (snapflowEscrow *SnapflowEscrow) UnpackInvalidShortStringError(raw []byte) (*SnapflowEscrowInvalidShortString, error) {
	out := new(SnapflowEscrowInvalidShortString)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InvalidShortString", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInvalidSignature represents a InvalidSignature error raised by the SnapflowEscrow contract.
type SnapflowEscrowInvalidSignature struct {
	Signer common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InvalidSignature(address signer)
func SnapflowEscrowInvalidSignatureErrorID() common.Hash {
	return common.HexToHash("0xd855c4f4d7a9aef9d1b6f49c25339cf5cd471e30830c8071f7b5024985e5abcd")
}

// UnpackInvalidSignatureError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InvalidSignature(address signer)
func (snapflowEscrow *SnapflowEscrow) UnpackInvalidSignatureError(raw []byte) (*SnapflowEscrowInvalidSignature, error) {
	out := new(SnapflowEscrowInvalidSignature)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InvalidSignature", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInvalidSigner represents a InvalidSigner error raised by the SnapflowEscrow contract.
type SnapflowEscrowInvalidSigner struct {
	Signer common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InvalidSigner(address signer)
func SnapflowEscrowInvalidSignerErrorID() common.Hash {
	return common.HexToHash("0xbf18af4376e76b3bc6eff3f06259e7333a989b275646b90af2c119b5bf92ae45")
}

// UnpackInvalidSignerError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InvalidSigner(address signer)
func (snapflowEscrow *SnapflowEscrow) UnpackInvalidSignerError(raw []byte) (*SnapflowEscrowInvalidSigner, error) {
	out := new(SnapflowEscrowInvalidSigner)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InvalidSigner", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInvalidSignerProof represents a InvalidSignerProof error raised by the SnapflowEscrow contract.
type SnapflowEscrowInvalidSignerProof struct {
	Signer common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InvalidSignerProof(address signer)
func SnapflowEscrowInvalidSignerProofErrorID() common.Hash {
	return common.HexToHash("0x2d406a7722cca66f0c3379ec84934ceeece2004b2d3cf925a1d7460ea1028be9")
}

// UnpackInvalidSignerProofError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InvalidSignerProof(address signer)
func (snapflowEscrow *SnapflowEscrow) UnpackInvalidSignerProofError(raw []byte) (*SnapflowEscrowInvalidSignerProof, error) {
	out := new(SnapflowEscrowInvalidSignerProof)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InvalidSignerProof", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInvalidSignerScope represents a InvalidSignerScope error raised by the SnapflowEscrow contract.
type SnapflowEscrowInvalidSignerScope struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InvalidSignerScope()
func SnapflowEscrowInvalidSignerScopeErrorID() common.Hash {
	return common.HexToHash("0x0ab9c94aac51072940e2a6acaa9526c8cb5d663e93d795b725b3881bd090549e")
}

// UnpackInvalidSignerScopeError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InvalidSignerScope()
func (snapflowEscrow *SnapflowEscrow) UnpackInvalidSignerScopeError(raw []byte) (*SnapflowEscrowInvalidSignerScope, error) {
	out := new(SnapflowEscrowInvalidSignerScope)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InvalidSignerScope", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInvalidVoucherTerms represents a InvalidVoucherTerms error raised by the SnapflowEscrow contract.
type SnapflowEscrowInvalidVoucherTerms struct {
	ChannelId [32]byte
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InvalidVoucherTerms(bytes32 channelId)
func SnapflowEscrowInvalidVoucherTermsErrorID() common.Hash {
	return common.HexToHash("0xc9f2eb75aac2ed2fe4f8afb0b261b35d8356514cdf1807a90d7db5ca40622aea")
}

// UnpackInvalidVoucherTermsError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InvalidVoucherTerms(bytes32 channelId)
func (snapflowEscrow *SnapflowEscrow) UnpackInvalidVoucherTermsError(raw []byte) (*SnapflowEscrowInvalidVoucherTerms, error) {
	out := new(SnapflowEscrowInvalidVoucherTerms)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InvalidVoucherTerms", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowNoSurplus represents a NoSurplus error raised by the SnapflowEscrow contract.
type SnapflowEscrowNoSurplus struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error NoSurplus()
func SnapflowEscrowNoSurplusErrorID() common.Hash {
	return common.HexToHash("0xc0ef17d362e5b2844aee259a94e17e9b77017bd75c83b4932129dfc5bdf1c312")
}

// UnpackNoSurplusError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error NoSurplus()
func (snapflowEscrow *SnapflowEscrow) UnpackNoSurplusError(raw []byte) (*SnapflowEscrowNoSurplus, error) {
	out := new(SnapflowEscrowNoSurplus)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "NoSurplus", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowNoWithdrawalPending represents a NoWithdrawalPending error raised by the SnapflowEscrow contract.
type SnapflowEscrowNoWithdrawalPending struct {
	Account common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error NoWithdrawalPending(address account)
func SnapflowEscrowNoWithdrawalPendingErrorID() common.Hash {
	return common.HexToHash("0xc27d42db1c2871cf43e5c0bc6b342ab8579426152f79302bc22f60498f09c238")
}

// UnpackNoWithdrawalPendingError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error NoWithdrawalPending(address account)
func (snapflowEscrow *SnapflowEscrow) UnpackNoWithdrawalPendingError(raw []byte) (*SnapflowEscrowNoWithdrawalPending, error) {
	out := new(SnapflowEscrowNoWithdrawalPending)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "NoWithdrawalPending", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowNotAuthorized represents a NotAuthorized error raised by the SnapflowEscrow contract.
type SnapflowEscrowNotAuthorized struct {
	Caller common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error NotAuthorized(address caller)
func SnapflowEscrowNotAuthorizedErrorID() common.Hash {
	return common.HexToHash("0x4a0bfec1fa3ea832f47a765e92fe13fe78ddadee056368ea6e89037b3cf70498")
}

// UnpackNotAuthorizedError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error NotAuthorized(address caller)
func (snapflowEscrow *SnapflowEscrow) UnpackNotAuthorizedError(raw []byte) (*SnapflowEscrowNotAuthorized, error) {
	out := new(SnapflowEscrowNotAuthorized)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "NotAuthorized", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowNothingToClaim represents a NothingToClaim error raised by the SnapflowEscrow contract.
type SnapflowEscrowNothingToClaim struct {
	ChannelId [32]byte
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error NothingToClaim(bytes32 channelId)
func SnapflowEscrowNothingToClaimErrorID() common.Hash {
	return common.HexToHash("0xb9eec102e7214fd8c2f304a3e53cf09864b0a6b0699d2dc187662fd9699f1ef2")
}

// UnpackNothingToClaimError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error NothingToClaim(bytes32 channelId)
func (snapflowEscrow *SnapflowEscrow) UnpackNothingToClaimError(raw []byte) (*SnapflowEscrowNothingToClaim, error) {
	out := new(SnapflowEscrowNothingToClaim)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "NothingToClaim", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowNothingToWithdraw represents a NothingToWithdraw error raised by the SnapflowEscrow contract.
type SnapflowEscrowNothingToWithdraw struct {
	Account common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error NothingToWithdraw(address account)
func SnapflowEscrowNothingToWithdrawErrorID() common.Hash {
	return common.HexToHash("0xdc69dc16e4a8405b44139edda9a06ee66b303337358b6f4633533d65de15b7f4")
}

// UnpackNothingToWithdrawError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error NothingToWithdraw(address account)
func (snapflowEscrow *SnapflowEscrow) UnpackNothingToWithdrawError(raw []byte) (*SnapflowEscrowNothingToWithdraw, error) {
	out := new(SnapflowEscrowNothingToWithdraw)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "NothingToWithdraw", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowPayoutSignatureExpired represents a PayoutSignatureExpired error raised by the SnapflowEscrow contract.
type SnapflowEscrowPayoutSignatureExpired struct {
	Deadline *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error PayoutSignatureExpired(uint256 deadline)
func SnapflowEscrowPayoutSignatureExpiredErrorID() common.Hash {
	return common.HexToHash("0x5455052858cba91f3f895c65a3360c7a55465b7f822902ae9b446959dab95f6a")
}

// UnpackPayoutSignatureExpiredError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error PayoutSignatureExpired(uint256 deadline)
func (snapflowEscrow *SnapflowEscrow) UnpackPayoutSignatureExpiredError(raw []byte) (*SnapflowEscrowPayoutSignatureExpired, error) {
	out := new(SnapflowEscrowPayoutSignatureExpired)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "PayoutSignatureExpired", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowReentrancyGuardReentrantCall represents a ReentrancyGuardReentrantCall error raised by the SnapflowEscrow contract.
type SnapflowEscrowReentrancyGuardReentrantCall struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error ReentrancyGuardReentrantCall()
func SnapflowEscrowReentrancyGuardReentrantCallErrorID() common.Hash {
	return common.HexToHash("0x3ee5aeb571de7fc460830b4d0017439a1ca56fb0bc39062227ade4fe4a24c1ca")
}

// UnpackReentrancyGuardReentrantCallError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error ReentrancyGuardReentrantCall()
func (snapflowEscrow *SnapflowEscrow) UnpackReentrancyGuardReentrantCallError(raw []byte) (*SnapflowEscrowReentrancyGuardReentrantCall, error) {
	out := new(SnapflowEscrowReentrancyGuardReentrantCall)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "ReentrancyGuardReentrantCall", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowRelayFeeTooHigh represents a RelayFeeTooHigh error raised by the SnapflowEscrow contract.
type SnapflowEscrowRelayFeeTooHigh struct {
	RelayFee    *big.Int
	MaxRelayFee *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error RelayFeeTooHigh(uint256 relayFee, uint256 maxRelayFee)
func SnapflowEscrowRelayFeeTooHighErrorID() common.Hash {
	return common.HexToHash("0x06442d3f16b83b0ecc20bf5f761e8335ca7b4b2d2998f385252680b2d26f07ef")
}

// UnpackRelayFeeTooHighError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error RelayFeeTooHigh(uint256 relayFee, uint256 maxRelayFee)
func (snapflowEscrow *SnapflowEscrow) UnpackRelayFeeTooHighError(raw []byte) (*SnapflowEscrowRelayFeeTooHigh, error) {
	out := new(SnapflowEscrowRelayFeeTooHigh)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "RelayFeeTooHigh", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSafeCastOverflowedUintDowncast represents a SafeCastOverflowedUintDowncast error raised by the SnapflowEscrow contract.
type SnapflowEscrowSafeCastOverflowedUintDowncast struct {
	Bits  uint8
	Value *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value)
func SnapflowEscrowSafeCastOverflowedUintDowncastErrorID() common.Hash {
	return common.HexToHash("0x6dfcc6503a32754ce7a89698e18201fc5294fd4aad43edefee786f88423b1a12")
}

// UnpackSafeCastOverflowedUintDowncastError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value)
func (snapflowEscrow *SnapflowEscrow) UnpackSafeCastOverflowedUintDowncastError(raw []byte) (*SnapflowEscrowSafeCastOverflowedUintDowncast, error) {
	out := new(SnapflowEscrowSafeCastOverflowedUintDowncast)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SafeCastOverflowedUintDowncast", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSafeERC20FailedOperation represents a SafeERC20FailedOperation error raised by the SnapflowEscrow contract.
type SnapflowEscrowSafeERC20FailedOperation struct {
	Token common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SafeERC20FailedOperation(address token)
func SnapflowEscrowSafeERC20FailedOperationErrorID() common.Hash {
	return common.HexToHash("0x5274afe73c98b4749fc91ffae6b7b574e7842cb2144a159e9377a5f20b32edf9")
}

// UnpackSafeERC20FailedOperationError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SafeERC20FailedOperation(address token)
func (snapflowEscrow *SnapflowEscrow) UnpackSafeERC20FailedOperationError(raw []byte) (*SnapflowEscrowSafeERC20FailedOperation, error) {
	out := new(SnapflowEscrowSafeERC20FailedOperation)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SafeERC20FailedOperation", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSignerAlreadyBound represents a SignerAlreadyBound error raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerAlreadyBound struct {
	Signer   common.Address
	Customer common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SignerAlreadyBound(address signer, address customer)
func SnapflowEscrowSignerAlreadyBoundErrorID() common.Hash {
	return common.HexToHash("0x08e05edfe403782a63ca03cfd47f362164574beb219010fff02ebcea9cf959a3")
}

// UnpackSignerAlreadyBoundError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SignerAlreadyBound(address signer, address customer)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerAlreadyBoundError(raw []byte) (*SnapflowEscrowSignerAlreadyBound, error) {
	out := new(SnapflowEscrowSignerAlreadyBound)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SignerAlreadyBound", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSignerAlreadyThawing represents a SignerAlreadyThawing error raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerAlreadyThawing struct {
	Signer  common.Address
	ThawEnd uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SignerAlreadyThawing(address signer, uint64 thawEnd)
func SnapflowEscrowSignerAlreadyThawingErrorID() common.Hash {
	return common.HexToHash("0xe8748df57cbfde671278286d73e1bd76bbe1d685bab712c0143cda918df67a45")
}

// UnpackSignerAlreadyThawingError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SignerAlreadyThawing(address signer, uint64 thawEnd)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerAlreadyThawingError(raw []byte) (*SnapflowEscrowSignerAlreadyThawing, error) {
	out := new(SnapflowEscrowSignerAlreadyThawing)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SignerAlreadyThawing", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSignerCapReached represents a SignerCapReached error raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerCapReached struct {
	Signer common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SignerCapReached(address signer)
func SnapflowEscrowSignerCapReachedErrorID() common.Hash {
	return common.HexToHash("0xb185041abfc668f2264f23968387dcc8d1b96f243dc93c9b7e4ce7dcb4d15912")
}

// UnpackSignerCapReachedError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SignerCapReached(address signer)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerCapReachedError(raw []byte) (*SnapflowEscrowSignerCapReached, error) {
	out := new(SnapflowEscrowSignerCapReached)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SignerCapReached", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSignerExpired represents a SignerExpired error raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerExpired struct {
	Signer common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SignerExpired(address signer)
func SnapflowEscrowSignerExpiredErrorID() common.Hash {
	return common.HexToHash("0x5b0a5543e6526763425656d88eefe5909b10de768de9a51d0b8048c97a20403d")
}

// UnpackSignerExpiredError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SignerExpired(address signer)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerExpiredError(raw []byte) (*SnapflowEscrowSignerExpired, error) {
	out := new(SnapflowEscrowSignerExpired)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SignerExpired", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSignerHostMismatch represents a SignerHostMismatch error raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerHostMismatch struct {
	Signer common.Address
	Host   common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SignerHostMismatch(address signer, address host)
func SnapflowEscrowSignerHostMismatchErrorID() common.Hash {
	return common.HexToHash("0x0fdf2aa7e5718e82091a31662b1886bd30f5e27e517b2666d6558a543dcc77e1")
}

// UnpackSignerHostMismatchError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SignerHostMismatch(address signer, address host)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerHostMismatchError(raw []byte) (*SnapflowEscrowSignerHostMismatch, error) {
	out := new(SnapflowEscrowSignerHostMismatch)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SignerHostMismatch", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSignerNotAuthorized represents a SignerNotAuthorized error raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerNotAuthorized struct {
	Signer common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SignerNotAuthorized(address signer)
func SnapflowEscrowSignerNotAuthorizedErrorID() common.Hash {
	return common.HexToHash("0x3b94fe24012ed0b1249f63dff93900daf5eb30566661494c6a96af7269efdfd1")
}

// UnpackSignerNotAuthorizedError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SignerNotAuthorized(address signer)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerNotAuthorizedError(raw []byte) (*SnapflowEscrowSignerNotAuthorized, error) {
	out := new(SnapflowEscrowSignerNotAuthorized)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SignerNotAuthorized", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSignerNotThawing represents a SignerNotThawing error raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerNotThawing struct {
	Signer common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SignerNotThawing(address signer)
func SnapflowEscrowSignerNotThawingErrorID() common.Hash {
	return common.HexToHash("0x93b5adf1c1e10a48fbe3cbf15013552e8dc8cea56ea6334bfd30ccb7d9bd7a8d")
}

// UnpackSignerNotThawingError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SignerNotThawing(address signer)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerNotThawingError(raw []byte) (*SnapflowEscrowSignerNotThawing, error) {
	out := new(SnapflowEscrowSignerNotThawing)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SignerNotThawing", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSignerProofExpired represents a SignerProofExpired error raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerProofExpired struct {
	Deadline *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SignerProofExpired(uint256 deadline)
func SnapflowEscrowSignerProofExpiredErrorID() common.Hash {
	return common.HexToHash("0x9c0e9dbb388a6372585b503eb56bb6f0aa0db7c29e0fb5bc6397f0897c64da52")
}

// UnpackSignerProofExpiredError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SignerProofExpired(uint256 deadline)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerProofExpiredError(raw []byte) (*SnapflowEscrowSignerProofExpired, error) {
	out := new(SnapflowEscrowSignerProofExpired)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SignerProofExpired", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSignerStillThawing represents a SignerStillThawing error raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerStillThawing struct {
	Signer  common.Address
	ThawEnd uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SignerStillThawing(address signer, uint64 thawEnd)
func SnapflowEscrowSignerStillThawingErrorID() common.Hash {
	return common.HexToHash("0x1906a2134b0b19197bfcc4f0761971407807b2af156f7e33102c8d9fceaabc09")
}

// UnpackSignerStillThawingError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SignerStillThawing(address signer, uint64 thawEnd)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerStillThawingError(raw []byte) (*SnapflowEscrowSignerStillThawing, error) {
	out := new(SnapflowEscrowSignerStillThawing)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SignerStillThawing", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSignerThawPeriodOutOfRange represents a SignerThawPeriodOutOfRange error raised by the SnapflowEscrow contract.
type SnapflowEscrowSignerThawPeriodOutOfRange struct {
	Period uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SignerThawPeriodOutOfRange(uint64 period)
func SnapflowEscrowSignerThawPeriodOutOfRangeErrorID() common.Hash {
	return common.HexToHash("0x99615d4c81574558488b847ed5a25984cf4c43b8bee42313a5994267d0abd0a4")
}

// UnpackSignerThawPeriodOutOfRangeError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SignerThawPeriodOutOfRange(uint64 period)
func (snapflowEscrow *SnapflowEscrow) UnpackSignerThawPeriodOutOfRangeError(raw []byte) (*SnapflowEscrowSignerThawPeriodOutOfRange, error) {
	out := new(SnapflowEscrowSignerThawPeriodOutOfRange)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SignerThawPeriodOutOfRange", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowStringTooLong represents a StringTooLong error raised by the SnapflowEscrow contract.
type SnapflowEscrowStringTooLong struct {
	Str string
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error StringTooLong(string str)
func SnapflowEscrowStringTooLongErrorID() common.Hash {
	return common.HexToHash("0x305a27a93f8e33b7392df0a0f91d6fc63847395853c45991eec52dbf24d72381")
}

// UnpackStringTooLongError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error StringTooLong(string str)
func (snapflowEscrow *SnapflowEscrow) UnpackStringTooLongError(raw []byte) (*SnapflowEscrowStringTooLong, error) {
	out := new(SnapflowEscrowStringTooLong)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "StringTooLong", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowTotalDepositCapExceeded represents a TotalDepositCapExceeded error raised by the SnapflowEscrow contract.
type SnapflowEscrowTotalDepositCapExceeded struct {
	Amount *big.Int
	Room   *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error TotalDepositCapExceeded(uint256 amount, uint256 room)
func SnapflowEscrowTotalDepositCapExceededErrorID() common.Hash {
	return common.HexToHash("0xf6784e02b786eb27e658ade86e9e54d3a7c828c284d7f980adcfbb95c159066c")
}

// UnpackTotalDepositCapExceededError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error TotalDepositCapExceeded(uint256 amount, uint256 room)
func (snapflowEscrow *SnapflowEscrow) UnpackTotalDepositCapExceededError(raw []byte) (*SnapflowEscrowTotalDepositCapExceeded, error) {
	out := new(SnapflowEscrowTotalDepositCapExceeded)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "TotalDepositCapExceeded", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowVoucherFromFuture represents a VoucherFromFuture error raised by the SnapflowEscrow contract.
type SnapflowEscrowVoucherFromFuture struct {
	Timestamp uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error VoucherFromFuture(uint64 timestamp)
func SnapflowEscrowVoucherFromFutureErrorID() common.Hash {
	return common.HexToHash("0x94758e436644e759dcc70c185f5ef3639c8c8636c8c37a9be12a2ff167c3fe35")
}

// UnpackVoucherFromFutureError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error VoucherFromFuture(uint64 timestamp)
func (snapflowEscrow *SnapflowEscrow) UnpackVoucherFromFutureError(raw []byte) (*SnapflowEscrowVoucherFromFuture, error) {
	out := new(SnapflowEscrowVoucherFromFuture)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "VoucherFromFuture", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowWithdrawalDelayOutOfRange represents a WithdrawalDelayOutOfRange error raised by the SnapflowEscrow contract.
type SnapflowEscrowWithdrawalDelayOutOfRange struct {
	Delay uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error WithdrawalDelayOutOfRange(uint64 delay)
func SnapflowEscrowWithdrawalDelayOutOfRangeErrorID() common.Hash {
	return common.HexToHash("0x96ff9f53268f68e33249a8784096ad0564ad25b52880c9cfb2bf3befa14d6306")
}

// UnpackWithdrawalDelayOutOfRangeError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error WithdrawalDelayOutOfRange(uint64 delay)
func (snapflowEscrow *SnapflowEscrow) UnpackWithdrawalDelayOutOfRangeError(raw []byte) (*SnapflowEscrowWithdrawalDelayOutOfRange, error) {
	out := new(SnapflowEscrowWithdrawalDelayOutOfRange)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "WithdrawalDelayOutOfRange", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowWithdrawalLocked represents a WithdrawalLocked error raised by the SnapflowEscrow contract.
type SnapflowEscrowWithdrawalLocked struct {
	Account  common.Address
	UnlockAt uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error WithdrawalLocked(address account, uint64 unlockAt)
func SnapflowEscrowWithdrawalLockedErrorID() common.Hash {
	return common.HexToHash("0x8255b342e51934e8963f89c5150b1f51c58264360446e2b7ba15b2e3431032ba")
}

// UnpackWithdrawalLockedError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error WithdrawalLocked(address account, uint64 unlockAt)
func (snapflowEscrow *SnapflowEscrow) UnpackWithdrawalLockedError(raw []byte) (*SnapflowEscrowWithdrawalLocked, error) {
	out := new(SnapflowEscrowWithdrawalLocked)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "WithdrawalLocked", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowZeroAddress represents a ZeroAddress error raised by the SnapflowEscrow contract.
type SnapflowEscrowZeroAddress struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error ZeroAddress()
func SnapflowEscrowZeroAddressErrorID() common.Hash {
	return common.HexToHash("0xd92e233df2717d4a40030e20904abd27b68fcbeede117eaaccbbdac9618c8c73")
}

// UnpackZeroAddressError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error ZeroAddress()
func (snapflowEscrow *SnapflowEscrow) UnpackZeroAddressError(raw []byte) (*SnapflowEscrowZeroAddress, error) {
	out := new(SnapflowEscrowZeroAddress)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "ZeroAddress", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowZeroAmount represents a ZeroAmount error raised by the SnapflowEscrow contract.
type SnapflowEscrowZeroAmount struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error ZeroAmount()
func SnapflowEscrowZeroAmountErrorID() common.Hash {
	return common.HexToHash("0x1f2a2005cb66a8e145327e8814e243a0996aec9bfe1e15a495778b1236dbd485")
}

// UnpackZeroAmountError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error ZeroAmount()
func (snapflowEscrow *SnapflowEscrow) UnpackZeroAmountError(raw []byte) (*SnapflowEscrowZeroAmount, error) {
	out := new(SnapflowEscrowZeroAmount)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "ZeroAmount", raw); err != nil {
		return nil, err
	}
	return out, nil
}
