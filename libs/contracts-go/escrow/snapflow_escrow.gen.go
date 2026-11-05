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

// Channel is an auto generated low-level Go binding around an user-defined struct.
type Channel struct {
	Customer       common.Address
	Host           common.Address
	Sequence       uint64
	HostClaimed    *big.Int
	FeeClaimed     *big.Int
	ServiceClaimed *big.Int
}

// FeeCapChange is an auto generated low-level Go binding around an user-defined struct.
type FeeCapChange struct {
	Bps         uint16
	EffectiveAt uint64
}

// SessionKey is an auto generated low-level Go binding around an user-defined struct.
type SessionKey struct {
	SpendCap    *big.Int
	Spent       *big.Int
	HourlyCap   *big.Int
	ActivatedAt uint64
	Expiry      uint64
}

// SignedVoucher is an auto generated low-level Go binding around an user-defined struct.
type SignedVoucher struct {
	Voucher   Voucher
	Signer    common.Address
	Signature []byte
}

// Voucher is an auto generated low-level Go binding around an user-defined struct.
type Voucher struct {
	ChannelId     [32]byte
	Customer      common.Address
	Host          common.Address
	HostAmount    *big.Int
	FeeAmount     *big.Int
	ServiceAmount *big.Int
	Sequence      uint64
	Expiry        uint64
}

// WithdrawalRequest is an auto generated low-level Go binding around an user-defined struct.
type WithdrawalRequest struct {
	Amount  *big.Int
	ReadyAt uint64
}

// SnapflowEscrowMetaData contains all meta data concerning the SnapflowEscrow contract.
var SnapflowEscrowMetaData = bind.MetaData{
	ABI: "[{\"type\":\"constructor\",\"inputs\":[{\"name\":\"token_\",\"type\":\"address\",\"internalType\":\"contractIERC20\"},{\"name\":\"admin\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"initialFeeRecipient\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"initialFeeCapBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"disputeWindow_\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"COMPLIANCE_ROLE\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"DEFAULT_ADMIN_ROLE\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"PAUSER_ROLE\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"acceptDefaultAdminTransfer\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"applyFeeCap\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"balanceOf\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"beginDefaultAdminTransfer\",\"inputs\":[{\"name\":\"newAdmin\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"blockAccount\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"cancelDefaultAdminTransfer\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"cancelFeeCapSchedule\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"cancelWithdrawal\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"changeDefaultAdminDelay\",\"inputs\":[{\"name\":\"newDelay\",\"type\":\"uint48\",\"internalType\":\"uint48\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"channelOf\",\"inputs\":[{\"name\":\"channelId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structChannel\",\"components\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"sequence\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"hostClaimed\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"feeClaimed\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"serviceClaimed\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"claim\",\"inputs\":[{\"name\":\"signed\",\"type\":\"tuple\",\"internalType\":\"structSignedVoucher\",\"components\":[{\"name\":\"voucher\",\"type\":\"tuple\",\"internalType\":\"structVoucher\",\"components\":[{\"name\":\"channelId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"hostAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"feeAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"serviceAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"sequence\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"expiry\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"signature\",\"type\":\"bytes\",\"internalType\":\"bytes\"}]}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"claimBatch\",\"inputs\":[{\"name\":\"signed\",\"type\":\"tuple[]\",\"internalType\":\"structSignedVoucher[]\",\"components\":[{\"name\":\"voucher\",\"type\":\"tuple\",\"internalType\":\"structVoucher\",\"components\":[{\"name\":\"channelId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"hostAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"feeAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"serviceAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"sequence\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"expiry\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"signature\",\"type\":\"bytes\",\"internalType\":\"bytes\"}]}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"defaultAdmin\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"defaultAdminDelay\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint48\",\"internalType\":\"uint48\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"defaultAdminDelayIncreaseWait\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint48\",\"internalType\":\"uint48\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"deposit\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"depositFor\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"depositWithPermit\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"v\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"r\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"s\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"disputeWindow\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"eip712Domain\",\"inputs\":[],\"outputs\":[{\"name\":\"fields\",\"type\":\"bytes1\",\"internalType\":\"bytes1\"},{\"name\":\"name\",\"type\":\"string\",\"internalType\":\"string\"},{\"name\":\"version\",\"type\":\"string\",\"internalType\":\"string\"},{\"name\":\"chainId\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"verifyingContract\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"salt\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"extensions\",\"type\":\"uint256[]\",\"internalType\":\"uint256[]\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"feeCapBps\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint16\",\"internalType\":\"uint16\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"feeRecipient\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getRoleAdmin\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"grantRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"hasRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"isBlocked\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"owner\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"pause\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"paused\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"pendingDefaultAdmin\",\"inputs\":[],\"outputs\":[{\"name\":\"newAdmin\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"schedule\",\"type\":\"uint48\",\"internalType\":\"uint48\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"pendingDefaultAdminDelay\",\"inputs\":[],\"outputs\":[{\"name\":\"newDelay\",\"type\":\"uint48\",\"internalType\":\"uint48\"},{\"name\":\"schedule\",\"type\":\"uint48\",\"internalType\":\"uint48\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"pendingFeeCap\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structFeeCapChange\",\"components\":[{\"name\":\"bps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"effectiveAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"renounceRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"requestWithdrawal\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"revokeRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"revokeSessionKey\",\"inputs\":[{\"name\":\"key\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"rollbackDefaultAdminDelay\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"scheduleFeeCap\",\"inputs\":[{\"name\":\"bps\",\"type\":\"uint16\",\"internalType\":\"uint16\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"sessionKeyOf\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"key\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structSessionKey\",\"components\":[{\"name\":\"spendCap\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"spent\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"hourlyCap\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"activatedAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"expiry\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"setFeeRecipient\",\"inputs\":[{\"name\":\"recipient\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setSessionKey\",\"inputs\":[{\"name\":\"key\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"spendCap\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"hourlyCap\",\"type\":\"uint128\",\"internalType\":\"uint128\"},{\"name\":\"expiry\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"supportsInterface\",\"inputs\":[{\"name\":\"interfaceId\",\"type\":\"bytes4\",\"internalType\":\"bytes4\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"token\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"contractIERC20\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"unblockAccount\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"unpause\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"voucherDigest\",\"inputs\":[{\"name\":\"voucher\",\"type\":\"tuple\",\"internalType\":\"structVoucher\",\"components\":[{\"name\":\"channelId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"host\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"hostAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"feeAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"serviceAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"sequence\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"expiry\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]}],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"withdraw\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"withdrawalOf\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structWithdrawalRequest\",\"components\":[{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"readyAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]}],\"stateMutability\":\"view\"},{\"type\":\"event\",\"name\":\"AddressBlocked\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"AddressUnblocked\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Claimed\",\"inputs\":[{\"name\":\"channelId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"host\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"hostPaid\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"feePaid\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"servicePaid\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"sequence\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"DefaultAdminDelayChangeCanceled\",\"inputs\":[],\"anonymous\":false},{\"type\":\"event\",\"name\":\"DefaultAdminDelayChangeScheduled\",\"inputs\":[{\"name\":\"newDelay\",\"type\":\"uint48\",\"indexed\":false,\"internalType\":\"uint48\"},{\"name\":\"effectSchedule\",\"type\":\"uint48\",\"indexed\":false,\"internalType\":\"uint48\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"DefaultAdminTransferCanceled\",\"inputs\":[],\"anonymous\":false},{\"type\":\"event\",\"name\":\"DefaultAdminTransferScheduled\",\"inputs\":[{\"name\":\"newAdmin\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"acceptSchedule\",\"type\":\"uint48\",\"indexed\":false,\"internalType\":\"uint48\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Deposited\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"payer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"EIP712DomainChanged\",\"inputs\":[],\"anonymous\":false},{\"type\":\"event\",\"name\":\"FeeCapScheduleCancelled\",\"inputs\":[],\"anonymous\":false},{\"type\":\"event\",\"name\":\"FeeCapScheduled\",\"inputs\":[{\"name\":\"bps\",\"type\":\"uint16\",\"indexed\":false,\"internalType\":\"uint16\"},{\"name\":\"effectiveAt\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"FeeCapUpdated\",\"inputs\":[{\"name\":\"previousBps\",\"type\":\"uint16\",\"indexed\":false,\"internalType\":\"uint16\"},{\"name\":\"bps\",\"type\":\"uint16\",\"indexed\":false,\"internalType\":\"uint16\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"FeeRecipientUpdated\",\"inputs\":[{\"name\":\"previousRecipient\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"recipient\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Paused\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RoleAdminChanged\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"previousAdminRole\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"newAdminRole\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RoleGranted\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"sender\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RoleRevoked\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"sender\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"SessionKeyRevoked\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"key\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"SessionKeySet\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"key\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"spendCap\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"},{\"name\":\"hourlyCap\",\"type\":\"uint128\",\"indexed\":false,\"internalType\":\"uint128\"},{\"name\":\"expiry\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Unpaused\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"WithdrawalCancelled\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"WithdrawalRequested\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"readyAt\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Withdrawn\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"error\",\"name\":\"AccessControlBadConfirmation\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"AccessControlEnforcedDefaultAdminDelay\",\"inputs\":[{\"name\":\"schedule\",\"type\":\"uint48\",\"internalType\":\"uint48\"}]},{\"type\":\"error\",\"name\":\"AccessControlEnforcedDefaultAdminRules\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"AccessControlInvalidDefaultAdmin\",\"inputs\":[{\"name\":\"defaultAdmin\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"AccessControlUnauthorizedAccount\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"neededRole\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"AccountBlocked\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"AmountDecreased\",\"inputs\":[{\"name\":\"channelId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"ChannelMismatch\",\"inputs\":[{\"name\":\"channelId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"DisputeWindowOutOfRange\",\"inputs\":[{\"name\":\"window\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"EmptyBatch\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"EnforcedPause\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ExpectedPause\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"FeeAboveCap\",\"inputs\":[{\"name\":\"feeDelta\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"allowed\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"FeeCapNotReady\",\"inputs\":[{\"name\":\"effectiveAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"FeeCapTooHigh\",\"inputs\":[{\"name\":\"bps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"maxBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"}]},{\"type\":\"error\",\"name\":\"InsufficientBalance\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"requested\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"available\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"InvalidSessionKey\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidShortString\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidSignature\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"NoFeeCapScheduled\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"NoWithdrawalRequested\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"ReentrancyGuardReentrantCall\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"SafeCastOverflowedUintDowncast\",\"inputs\":[{\"name\":\"bits\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"value\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"SafeERC20FailedOperation\",\"inputs\":[{\"name\":\"token\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"SessionHourlyCapExceeded\",\"inputs\":[{\"name\":\"key\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"requested\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"remaining\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"SessionKeyInactive\",\"inputs\":[{\"name\":\"customer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"key\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"SessionSpendCapExceeded\",\"inputs\":[{\"name\":\"key\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"requested\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"remaining\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"StaleVoucher\",\"inputs\":[{\"name\":\"sequence\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"lastSequence\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"StringTooLong\",\"inputs\":[{\"name\":\"str\",\"type\":\"string\",\"internalType\":\"string\"}]},{\"type\":\"error\",\"name\":\"VoucherExpired\",\"inputs\":[{\"name\":\"expiry\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"WithdrawalNotReady\",\"inputs\":[{\"name\":\"readyAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]},{\"type\":\"error\",\"name\":\"ZeroAddress\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ZeroAmount\",\"inputs\":[]}]",
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
// Solidity: constructor(address token_, address admin, address initialFeeRecipient, uint16 initialFeeCapBps, uint64 disputeWindow_) returns()
func (snapflowEscrow *SnapflowEscrow) PackConstructor(token_ common.Address, admin common.Address, initialFeeRecipient common.Address, initialFeeCapBps uint16, disputeWindow_ uint64) []byte {
	enc, err := snapflowEscrow.abi.Pack("", token_, admin, initialFeeRecipient, initialFeeCapBps, disputeWindow_)
	if err != nil {
		panic(err)
	}
	return enc
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

// PackApplyFeeCap is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x23530261.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function applyFeeCap() returns()
func (snapflowEscrow *SnapflowEscrow) PackApplyFeeCap() []byte {
	enc, err := snapflowEscrow.abi.Pack("applyFeeCap")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackApplyFeeCap is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x23530261.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function applyFeeCap() returns()
func (snapflowEscrow *SnapflowEscrow) TryPackApplyFeeCap() ([]byte, error) {
	return snapflowEscrow.abi.Pack("applyFeeCap")
}

// PackBalanceOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x70a08231.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function balanceOf(address customer) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) PackBalanceOf(customer common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("balanceOf", customer)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackBalanceOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x70a08231.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function balanceOf(address customer) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) TryPackBalanceOf(customer common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("balanceOf", customer)
}

// UnpackBalanceOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x70a08231.
//
// Solidity: function balanceOf(address customer) view returns(uint256)
func (snapflowEscrow *SnapflowEscrow) UnpackBalanceOf(data []byte) (*big.Int, error) {
	out, err := snapflowEscrow.abi.Unpack("balanceOf", data)
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
// the contract method with ID 0x7c0a893d.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function blockAccount(address account) returns()
func (snapflowEscrow *SnapflowEscrow) PackBlockAccount(account common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("blockAccount", account)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackBlockAccount is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x7c0a893d.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function blockAccount(address account) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackBlockAccount(account common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("blockAccount", account)
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

// PackCancelFeeCapSchedule is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x3ffe8652.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function cancelFeeCapSchedule() returns()
func (snapflowEscrow *SnapflowEscrow) PackCancelFeeCapSchedule() []byte {
	enc, err := snapflowEscrow.abi.Pack("cancelFeeCapSchedule")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackCancelFeeCapSchedule is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x3ffe8652.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function cancelFeeCapSchedule() returns()
func (snapflowEscrow *SnapflowEscrow) TryPackCancelFeeCapSchedule() ([]byte, error) {
	return snapflowEscrow.abi.Pack("cancelFeeCapSchedule")
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

// PackChannelOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x171a2a7d.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function channelOf(bytes32 channelId) view returns((address,address,uint64,uint256,uint256,uint256))
func (snapflowEscrow *SnapflowEscrow) PackChannelOf(channelId [32]byte) []byte {
	enc, err := snapflowEscrow.abi.Pack("channelOf", channelId)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackChannelOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x171a2a7d.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function channelOf(bytes32 channelId) view returns((address,address,uint64,uint256,uint256,uint256))
func (snapflowEscrow *SnapflowEscrow) TryPackChannelOf(channelId [32]byte) ([]byte, error) {
	return snapflowEscrow.abi.Pack("channelOf", channelId)
}

// UnpackChannelOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x171a2a7d.
//
// Solidity: function channelOf(bytes32 channelId) view returns((address,address,uint64,uint256,uint256,uint256))
func (snapflowEscrow *SnapflowEscrow) UnpackChannelOf(data []byte) (Channel, error) {
	out, err := snapflowEscrow.abi.Unpack("channelOf", data)
	if err != nil {
		return *new(Channel), err
	}
	out0 := *abi.ConvertType(out[0], new(Channel)).(*Channel)
	return out0, nil
}

// PackClaim is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xd9f2e5af.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function claim(((bytes32,address,address,uint256,uint256,uint256,uint64,uint64),address,bytes) signed) returns()
func (snapflowEscrow *SnapflowEscrow) PackClaim(signed SignedVoucher) []byte {
	enc, err := snapflowEscrow.abi.Pack("claim", signed)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackClaim is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xd9f2e5af.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function claim(((bytes32,address,address,uint256,uint256,uint256,uint64,uint64),address,bytes) signed) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackClaim(signed SignedVoucher) ([]byte, error) {
	return snapflowEscrow.abi.Pack("claim", signed)
}

// PackClaimBatch is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x9e336bd0.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function claimBatch(((bytes32,address,address,uint256,uint256,uint256,uint64,uint64),address,bytes)[] signed) returns()
func (snapflowEscrow *SnapflowEscrow) PackClaimBatch(signed []SignedVoucher) []byte {
	enc, err := snapflowEscrow.abi.Pack("claimBatch", signed)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackClaimBatch is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x9e336bd0.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function claimBatch(((bytes32,address,address,uint256,uint256,uint256,uint64,uint64),address,bytes)[] signed) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackClaimBatch(signed []SignedVoucher) ([]byte, error) {
	return snapflowEscrow.abi.Pack("claimBatch", signed)
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

// PackDisputeWindow is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x117f5f92.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function disputeWindow() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) PackDisputeWindow() []byte {
	enc, err := snapflowEscrow.abi.Pack("disputeWindow")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackDisputeWindow is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x117f5f92.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function disputeWindow() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) TryPackDisputeWindow() ([]byte, error) {
	return snapflowEscrow.abi.Pack("disputeWindow")
}

// UnpackDisputeWindow is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x117f5f92.
//
// Solidity: function disputeWindow() view returns(uint64)
func (snapflowEscrow *SnapflowEscrow) UnpackDisputeWindow(data []byte) (uint64, error) {
	out, err := snapflowEscrow.abi.Unpack("disputeWindow", data)
	if err != nil {
		return *new(uint64), err
	}
	out0 := *abi.ConvertType(out[0], new(uint64)).(*uint64)
	return out0, nil
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

// PackFeeCapBps is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x88e81583.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function feeCapBps() view returns(uint16)
func (snapflowEscrow *SnapflowEscrow) PackFeeCapBps() []byte {
	enc, err := snapflowEscrow.abi.Pack("feeCapBps")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackFeeCapBps is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x88e81583.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function feeCapBps() view returns(uint16)
func (snapflowEscrow *SnapflowEscrow) TryPackFeeCapBps() ([]byte, error) {
	return snapflowEscrow.abi.Pack("feeCapBps")
}

// UnpackFeeCapBps is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x88e81583.
//
// Solidity: function feeCapBps() view returns(uint16)
func (snapflowEscrow *SnapflowEscrow) UnpackFeeCapBps(data []byte) (uint16, error) {
	out, err := snapflowEscrow.abi.Unpack("feeCapBps", data)
	if err != nil {
		return *new(uint16), err
	}
	out0 := *abi.ConvertType(out[0], new(uint16)).(*uint16)
	return out0, nil
}

// PackFeeRecipient is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x46904840.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function feeRecipient() view returns(address)
func (snapflowEscrow *SnapflowEscrow) PackFeeRecipient() []byte {
	enc, err := snapflowEscrow.abi.Pack("feeRecipient")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackFeeRecipient is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x46904840.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function feeRecipient() view returns(address)
func (snapflowEscrow *SnapflowEscrow) TryPackFeeRecipient() ([]byte, error) {
	return snapflowEscrow.abi.Pack("feeRecipient")
}

// UnpackFeeRecipient is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x46904840.
//
// Solidity: function feeRecipient() view returns(address)
func (snapflowEscrow *SnapflowEscrow) UnpackFeeRecipient(data []byte) (common.Address, error) {
	out, err := snapflowEscrow.abi.Unpack("feeRecipient", data)
	if err != nil {
		return *new(common.Address), err
	}
	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)
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

// PackIsBlocked is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xfbac3951.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function isBlocked(address account) view returns(bool)
func (snapflowEscrow *SnapflowEscrow) PackIsBlocked(account common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("isBlocked", account)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackIsBlocked is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xfbac3951.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function isBlocked(address account) view returns(bool)
func (snapflowEscrow *SnapflowEscrow) TryPackIsBlocked(account common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("isBlocked", account)
}

// UnpackIsBlocked is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xfbac3951.
//
// Solidity: function isBlocked(address account) view returns(bool)
func (snapflowEscrow *SnapflowEscrow) UnpackIsBlocked(data []byte) (bool, error) {
	out, err := snapflowEscrow.abi.Unpack("isBlocked", data)
	if err != nil {
		return *new(bool), err
	}
	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)
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

// PackPendingFeeCap is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x0acac955.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function pendingFeeCap() view returns((uint16,uint64))
func (snapflowEscrow *SnapflowEscrow) PackPendingFeeCap() []byte {
	enc, err := snapflowEscrow.abi.Pack("pendingFeeCap")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackPendingFeeCap is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x0acac955.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function pendingFeeCap() view returns((uint16,uint64))
func (snapflowEscrow *SnapflowEscrow) TryPackPendingFeeCap() ([]byte, error) {
	return snapflowEscrow.abi.Pack("pendingFeeCap")
}

// UnpackPendingFeeCap is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x0acac955.
//
// Solidity: function pendingFeeCap() view returns((uint16,uint64))
func (snapflowEscrow *SnapflowEscrow) UnpackPendingFeeCap(data []byte) (FeeCapChange, error) {
	out, err := snapflowEscrow.abi.Unpack("pendingFeeCap", data)
	if err != nil {
		return *new(FeeCapChange), err
	}
	out0 := *abi.ConvertType(out[0], new(FeeCapChange)).(*FeeCapChange)
	return out0, nil
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

// PackRevokeSessionKey is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x84f4fc6a.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function revokeSessionKey(address key) returns()
func (snapflowEscrow *SnapflowEscrow) PackRevokeSessionKey(key common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("revokeSessionKey", key)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackRevokeSessionKey is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x84f4fc6a.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function revokeSessionKey(address key) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackRevokeSessionKey(key common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("revokeSessionKey", key)
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

// PackScheduleFeeCap is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xb25c1d5b.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function scheduleFeeCap(uint16 bps) returns()
func (snapflowEscrow *SnapflowEscrow) PackScheduleFeeCap(bps uint16) []byte {
	enc, err := snapflowEscrow.abi.Pack("scheduleFeeCap", bps)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackScheduleFeeCap is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xb25c1d5b.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function scheduleFeeCap(uint16 bps) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackScheduleFeeCap(bps uint16) ([]byte, error) {
	return snapflowEscrow.abi.Pack("scheduleFeeCap", bps)
}

// PackSessionKeyOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x1cb13a76.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function sessionKeyOf(address customer, address key) view returns((uint128,uint128,uint128,uint64,uint64))
func (snapflowEscrow *SnapflowEscrow) PackSessionKeyOf(customer common.Address, key common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("sessionKeyOf", customer, key)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackSessionKeyOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x1cb13a76.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function sessionKeyOf(address customer, address key) view returns((uint128,uint128,uint128,uint64,uint64))
func (snapflowEscrow *SnapflowEscrow) TryPackSessionKeyOf(customer common.Address, key common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("sessionKeyOf", customer, key)
}

// UnpackSessionKeyOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x1cb13a76.
//
// Solidity: function sessionKeyOf(address customer, address key) view returns((uint128,uint128,uint128,uint64,uint64))
func (snapflowEscrow *SnapflowEscrow) UnpackSessionKeyOf(data []byte) (SessionKey, error) {
	out, err := snapflowEscrow.abi.Unpack("sessionKeyOf", data)
	if err != nil {
		return *new(SessionKey), err
	}
	out0 := *abi.ConvertType(out[0], new(SessionKey)).(*SessionKey)
	return out0, nil
}

// PackSetFeeRecipient is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xe74b981b.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function setFeeRecipient(address recipient) returns()
func (snapflowEscrow *SnapflowEscrow) PackSetFeeRecipient(recipient common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("setFeeRecipient", recipient)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackSetFeeRecipient is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xe74b981b.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function setFeeRecipient(address recipient) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackSetFeeRecipient(recipient common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("setFeeRecipient", recipient)
}

// PackSetSessionKey is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xc9a7ae1a.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function setSessionKey(address key, uint128 spendCap, uint128 hourlyCap, uint64 expiry) returns()
func (snapflowEscrow *SnapflowEscrow) PackSetSessionKey(key common.Address, spendCap *big.Int, hourlyCap *big.Int, expiry uint64) []byte {
	enc, err := snapflowEscrow.abi.Pack("setSessionKey", key, spendCap, hourlyCap, expiry)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackSetSessionKey is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xc9a7ae1a.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function setSessionKey(address key, uint128 spendCap, uint128 hourlyCap, uint64 expiry) returns()
func (snapflowEscrow *SnapflowEscrow) TryPackSetSessionKey(key common.Address, spendCap *big.Int, hourlyCap *big.Int, expiry uint64) ([]byte, error) {
	return snapflowEscrow.abi.Pack("setSessionKey", key, spendCap, hourlyCap, expiry)
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
// the contract method with ID 0xe094f291.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function voucherDigest((bytes32,address,address,uint256,uint256,uint256,uint64,uint64) voucher) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) PackVoucherDigest(voucher Voucher) []byte {
	enc, err := snapflowEscrow.abi.Pack("voucherDigest", voucher)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackVoucherDigest is the Go binding used to pack the parameters required for calling
// the contract method with ID 0xe094f291.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function voucherDigest((bytes32,address,address,uint256,uint256,uint256,uint64,uint64) voucher) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) TryPackVoucherDigest(voucher Voucher) ([]byte, error) {
	return snapflowEscrow.abi.Pack("voucherDigest", voucher)
}

// UnpackVoucherDigest is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0xe094f291.
//
// Solidity: function voucherDigest((bytes32,address,address,uint256,uint256,uint256,uint64,uint64) voucher) view returns(bytes32)
func (snapflowEscrow *SnapflowEscrow) UnpackVoucherDigest(data []byte) ([32]byte, error) {
	out, err := snapflowEscrow.abi.Unpack("voucherDigest", data)
	if err != nil {
		return *new([32]byte), err
	}
	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)
	return out0, nil
}

// PackWithdraw is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x3ccfd60b.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function withdraw() returns()
func (snapflowEscrow *SnapflowEscrow) PackWithdraw() []byte {
	enc, err := snapflowEscrow.abi.Pack("withdraw")
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackWithdraw is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x3ccfd60b.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function withdraw() returns()
func (snapflowEscrow *SnapflowEscrow) TryPackWithdraw() ([]byte, error) {
	return snapflowEscrow.abi.Pack("withdraw")
}

// PackWithdrawalOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x14bf9d2b.  This method will panic if any
// invalid/nil inputs are passed.
//
// Solidity: function withdrawalOf(address customer) view returns((uint256,uint64))
func (snapflowEscrow *SnapflowEscrow) PackWithdrawalOf(customer common.Address) []byte {
	enc, err := snapflowEscrow.abi.Pack("withdrawalOf", customer)
	if err != nil {
		panic(err)
	}
	return enc
}

// TryPackWithdrawalOf is the Go binding used to pack the parameters required for calling
// the contract method with ID 0x14bf9d2b.  This method will return an error
// if any inputs are invalid/nil.
//
// Solidity: function withdrawalOf(address customer) view returns((uint256,uint64))
func (snapflowEscrow *SnapflowEscrow) TryPackWithdrawalOf(customer common.Address) ([]byte, error) {
	return snapflowEscrow.abi.Pack("withdrawalOf", customer)
}

// UnpackWithdrawalOf is the Go binding that unpacks the parameters returned
// from invoking the contract method with ID 0x14bf9d2b.
//
// Solidity: function withdrawalOf(address customer) view returns((uint256,uint64))
func (snapflowEscrow *SnapflowEscrow) UnpackWithdrawalOf(data []byte) (WithdrawalRequest, error) {
	out, err := snapflowEscrow.abi.Unpack("withdrawalOf", data)
	if err != nil {
		return *new(WithdrawalRequest), err
	}
	out0 := *abi.ConvertType(out[0], new(WithdrawalRequest)).(*WithdrawalRequest)
	return out0, nil
}

// SnapflowEscrowAddressBlocked represents a AddressBlocked event raised by the SnapflowEscrow contract.
type SnapflowEscrowAddressBlocked struct {
	Account common.Address
	Raw     *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowAddressBlockedEventName = "AddressBlocked"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowAddressBlocked) ContractEventName() string {
	return SnapflowEscrowAddressBlockedEventName
}

// UnpackAddressBlockedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event AddressBlocked(address indexed account)
func (snapflowEscrow *SnapflowEscrow) UnpackAddressBlockedEvent(log *types.Log) (*SnapflowEscrowAddressBlocked, error) {
	event := "AddressBlocked"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowAddressBlocked)
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

// SnapflowEscrowAddressUnblocked represents a AddressUnblocked event raised by the SnapflowEscrow contract.
type SnapflowEscrowAddressUnblocked struct {
	Account common.Address
	Raw     *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowAddressUnblockedEventName = "AddressUnblocked"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowAddressUnblocked) ContractEventName() string {
	return SnapflowEscrowAddressUnblockedEventName
}

// UnpackAddressUnblockedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event AddressUnblocked(address indexed account)
func (snapflowEscrow *SnapflowEscrow) UnpackAddressUnblockedEvent(log *types.Log) (*SnapflowEscrowAddressUnblocked, error) {
	event := "AddressUnblocked"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowAddressUnblocked)
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
	HostPaid    *big.Int
	FeePaid     *big.Int
	ServicePaid *big.Int
	Sequence    uint64
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
// Solidity: event Claimed(bytes32 indexed channelId, address indexed customer, address indexed host, uint256 hostPaid, uint256 feePaid, uint256 servicePaid, uint64 sequence)
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

// SnapflowEscrowFeeCapScheduleCancelled represents a FeeCapScheduleCancelled event raised by the SnapflowEscrow contract.
type SnapflowEscrowFeeCapScheduleCancelled struct {
	Raw *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowFeeCapScheduleCancelledEventName = "FeeCapScheduleCancelled"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowFeeCapScheduleCancelled) ContractEventName() string {
	return SnapflowEscrowFeeCapScheduleCancelledEventName
}

// UnpackFeeCapScheduleCancelledEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event FeeCapScheduleCancelled()
func (snapflowEscrow *SnapflowEscrow) UnpackFeeCapScheduleCancelledEvent(log *types.Log) (*SnapflowEscrowFeeCapScheduleCancelled, error) {
	event := "FeeCapScheduleCancelled"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowFeeCapScheduleCancelled)
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

// SnapflowEscrowFeeCapScheduled represents a FeeCapScheduled event raised by the SnapflowEscrow contract.
type SnapflowEscrowFeeCapScheduled struct {
	Bps         uint16
	EffectiveAt uint64
	Raw         *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowFeeCapScheduledEventName = "FeeCapScheduled"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowFeeCapScheduled) ContractEventName() string {
	return SnapflowEscrowFeeCapScheduledEventName
}

// UnpackFeeCapScheduledEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event FeeCapScheduled(uint16 bps, uint64 effectiveAt)
func (snapflowEscrow *SnapflowEscrow) UnpackFeeCapScheduledEvent(log *types.Log) (*SnapflowEscrowFeeCapScheduled, error) {
	event := "FeeCapScheduled"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowFeeCapScheduled)
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

// SnapflowEscrowFeeCapUpdated represents a FeeCapUpdated event raised by the SnapflowEscrow contract.
type SnapflowEscrowFeeCapUpdated struct {
	PreviousBps uint16
	Bps         uint16
	Raw         *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowFeeCapUpdatedEventName = "FeeCapUpdated"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowFeeCapUpdated) ContractEventName() string {
	return SnapflowEscrowFeeCapUpdatedEventName
}

// UnpackFeeCapUpdatedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event FeeCapUpdated(uint16 previousBps, uint16 bps)
func (snapflowEscrow *SnapflowEscrow) UnpackFeeCapUpdatedEvent(log *types.Log) (*SnapflowEscrowFeeCapUpdated, error) {
	event := "FeeCapUpdated"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowFeeCapUpdated)
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

// SnapflowEscrowFeeRecipientUpdated represents a FeeRecipientUpdated event raised by the SnapflowEscrow contract.
type SnapflowEscrowFeeRecipientUpdated struct {
	PreviousRecipient common.Address
	Recipient         common.Address
	Raw               *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowFeeRecipientUpdatedEventName = "FeeRecipientUpdated"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowFeeRecipientUpdated) ContractEventName() string {
	return SnapflowEscrowFeeRecipientUpdatedEventName
}

// UnpackFeeRecipientUpdatedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event FeeRecipientUpdated(address indexed previousRecipient, address indexed recipient)
func (snapflowEscrow *SnapflowEscrow) UnpackFeeRecipientUpdatedEvent(log *types.Log) (*SnapflowEscrowFeeRecipientUpdated, error) {
	event := "FeeRecipientUpdated"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowFeeRecipientUpdated)
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

// SnapflowEscrowSessionKeyRevoked represents a SessionKeyRevoked event raised by the SnapflowEscrow contract.
type SnapflowEscrowSessionKeyRevoked struct {
	Customer common.Address
	Key      common.Address
	Raw      *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowSessionKeyRevokedEventName = "SessionKeyRevoked"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowSessionKeyRevoked) ContractEventName() string {
	return SnapflowEscrowSessionKeyRevokedEventName
}

// UnpackSessionKeyRevokedEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event SessionKeyRevoked(address indexed customer, address indexed key)
func (snapflowEscrow *SnapflowEscrow) UnpackSessionKeyRevokedEvent(log *types.Log) (*SnapflowEscrowSessionKeyRevoked, error) {
	event := "SessionKeyRevoked"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowSessionKeyRevoked)
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

// SnapflowEscrowSessionKeySet represents a SessionKeySet event raised by the SnapflowEscrow contract.
type SnapflowEscrowSessionKeySet struct {
	Customer  common.Address
	Key       common.Address
	SpendCap  *big.Int
	HourlyCap *big.Int
	Expiry    uint64
	Raw       *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowSessionKeySetEventName = "SessionKeySet"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowSessionKeySet) ContractEventName() string {
	return SnapflowEscrowSessionKeySetEventName
}

// UnpackSessionKeySetEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event SessionKeySet(address indexed customer, address indexed key, uint128 spendCap, uint128 hourlyCap, uint64 expiry)
func (snapflowEscrow *SnapflowEscrow) UnpackSessionKeySetEvent(log *types.Log) (*SnapflowEscrowSessionKeySet, error) {
	event := "SessionKeySet"
	if len(log.Topics) == 0 {
		return nil, bind.ErrNoEventSignature
	}
	if log.Topics[0] != snapflowEscrow.abi.Events[event].ID {
		return nil, bind.ErrEventSignatureMismatch
	}
	out := new(SnapflowEscrowSessionKeySet)
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
	Customer common.Address
	Raw      *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowWithdrawalCancelledEventName = "WithdrawalCancelled"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowWithdrawalCancelled) ContractEventName() string {
	return SnapflowEscrowWithdrawalCancelledEventName
}

// UnpackWithdrawalCancelledEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event WithdrawalCancelled(address indexed customer)
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
	Customer common.Address
	Amount   *big.Int
	ReadyAt  uint64
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
// Solidity: event WithdrawalRequested(address indexed customer, uint256 amount, uint64 readyAt)
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
	Customer common.Address
	Amount   *big.Int
	Raw      *types.Log // Blockchain specific contextual infos
}

const SnapflowEscrowWithdrawnEventName = "Withdrawn"

// ContractEventName returns the user-defined event name.
func (SnapflowEscrowWithdrawn) ContractEventName() string {
	return SnapflowEscrowWithdrawnEventName
}

// UnpackWithdrawnEvent is the Go binding that unpacks the event data emitted
// by contract.
//
// Solidity: event Withdrawn(address indexed customer, uint256 amount)
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
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AccountBlocked"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAccountBlockedError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["AmountDecreased"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackAmountDecreasedError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["ChannelMismatch"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackChannelMismatchError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["DisputeWindowOutOfRange"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackDisputeWindowOutOfRangeError(raw[4:])
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
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["FeeAboveCap"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackFeeAboveCapError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["FeeCapNotReady"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackFeeCapNotReadyError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["FeeCapTooHigh"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackFeeCapTooHighError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InsufficientBalance"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInsufficientBalanceError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InvalidSessionKey"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInvalidSessionKeyError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InvalidShortString"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInvalidShortStringError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["InvalidSignature"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackInvalidSignatureError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["NoFeeCapScheduled"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackNoFeeCapScheduledError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["NoWithdrawalRequested"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackNoWithdrawalRequestedError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["ReentrancyGuardReentrantCall"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackReentrancyGuardReentrantCallError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SafeCastOverflowedUintDowncast"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSafeCastOverflowedUintDowncastError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SafeERC20FailedOperation"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSafeERC20FailedOperationError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SessionHourlyCapExceeded"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSessionHourlyCapExceededError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SessionKeyInactive"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSessionKeyInactiveError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["SessionSpendCapExceeded"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackSessionSpendCapExceededError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["StaleVoucher"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackStaleVoucherError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["StringTooLong"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackStringTooLongError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["VoucherExpired"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackVoucherExpiredError(raw[4:])
	}
	if bytes.Equal(raw[:4], snapflowEscrow.abi.Errors["WithdrawalNotReady"].ID.Bytes()[:4]) {
		return snapflowEscrow.UnpackWithdrawalNotReadyError(raw[4:])
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

// SnapflowEscrowAccountBlocked represents a AccountBlocked error raised by the SnapflowEscrow contract.
type SnapflowEscrowAccountBlocked struct {
	Account common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AccountBlocked(address account)
func SnapflowEscrowAccountBlockedErrorID() common.Hash {
	return common.HexToHash("0x28e9b38569d728986e5868b0e113d9a49ee4c47dfc6db29a673e25b3515a56a8")
}

// UnpackAccountBlockedError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AccountBlocked(address account)
func (snapflowEscrow *SnapflowEscrow) UnpackAccountBlockedError(raw []byte) (*SnapflowEscrowAccountBlocked, error) {
	out := new(SnapflowEscrowAccountBlocked)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AccountBlocked", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowAmountDecreased represents a AmountDecreased error raised by the SnapflowEscrow contract.
type SnapflowEscrowAmountDecreased struct {
	ChannelId [32]byte
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error AmountDecreased(bytes32 channelId)
func SnapflowEscrowAmountDecreasedErrorID() common.Hash {
	return common.HexToHash("0x9c0a31ba123b46b0afc736b60ac2a15e8d57f474439822df53a676f040080518")
}

// UnpackAmountDecreasedError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error AmountDecreased(bytes32 channelId)
func (snapflowEscrow *SnapflowEscrow) UnpackAmountDecreasedError(raw []byte) (*SnapflowEscrowAmountDecreased, error) {
	out := new(SnapflowEscrowAmountDecreased)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "AmountDecreased", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowChannelMismatch represents a ChannelMismatch error raised by the SnapflowEscrow contract.
type SnapflowEscrowChannelMismatch struct {
	ChannelId [32]byte
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error ChannelMismatch(bytes32 channelId)
func SnapflowEscrowChannelMismatchErrorID() common.Hash {
	return common.HexToHash("0x93c90812376999d144f79ec1edf57b69f4dd2d5be3488fa162cec377db93b42b")
}

// UnpackChannelMismatchError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error ChannelMismatch(bytes32 channelId)
func (snapflowEscrow *SnapflowEscrow) UnpackChannelMismatchError(raw []byte) (*SnapflowEscrowChannelMismatch, error) {
	out := new(SnapflowEscrowChannelMismatch)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "ChannelMismatch", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowDisputeWindowOutOfRange represents a DisputeWindowOutOfRange error raised by the SnapflowEscrow contract.
type SnapflowEscrowDisputeWindowOutOfRange struct {
	Window uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error DisputeWindowOutOfRange(uint64 window)
func SnapflowEscrowDisputeWindowOutOfRangeErrorID() common.Hash {
	return common.HexToHash("0xa570af33aec6ddb9d0d752d4826e37f6dc5d7c6c821c12056612233e9a0f5c55")
}

// UnpackDisputeWindowOutOfRangeError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error DisputeWindowOutOfRange(uint64 window)
func (snapflowEscrow *SnapflowEscrow) UnpackDisputeWindowOutOfRangeError(raw []byte) (*SnapflowEscrowDisputeWindowOutOfRange, error) {
	out := new(SnapflowEscrowDisputeWindowOutOfRange)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "DisputeWindowOutOfRange", raw); err != nil {
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

// SnapflowEscrowFeeAboveCap represents a FeeAboveCap error raised by the SnapflowEscrow contract.
type SnapflowEscrowFeeAboveCap struct {
	FeeDelta *big.Int
	Allowed  *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error FeeAboveCap(uint256 feeDelta, uint256 allowed)
func SnapflowEscrowFeeAboveCapErrorID() common.Hash {
	return common.HexToHash("0x7159abd8f9701c781951309a8f165bbb5a233e2df15b3a8ef190554984cb7f05")
}

// UnpackFeeAboveCapError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error FeeAboveCap(uint256 feeDelta, uint256 allowed)
func (snapflowEscrow *SnapflowEscrow) UnpackFeeAboveCapError(raw []byte) (*SnapflowEscrowFeeAboveCap, error) {
	out := new(SnapflowEscrowFeeAboveCap)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "FeeAboveCap", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowFeeCapNotReady represents a FeeCapNotReady error raised by the SnapflowEscrow contract.
type SnapflowEscrowFeeCapNotReady struct {
	EffectiveAt uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error FeeCapNotReady(uint64 effectiveAt)
func SnapflowEscrowFeeCapNotReadyErrorID() common.Hash {
	return common.HexToHash("0x49b81e979e0703768d3b922a9874466af4885b34143e1c4ca41a969be5997465")
}

// UnpackFeeCapNotReadyError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error FeeCapNotReady(uint64 effectiveAt)
func (snapflowEscrow *SnapflowEscrow) UnpackFeeCapNotReadyError(raw []byte) (*SnapflowEscrowFeeCapNotReady, error) {
	out := new(SnapflowEscrowFeeCapNotReady)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "FeeCapNotReady", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowFeeCapTooHigh represents a FeeCapTooHigh error raised by the SnapflowEscrow contract.
type SnapflowEscrowFeeCapTooHigh struct {
	Bps    uint16
	MaxBps uint16
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error FeeCapTooHigh(uint16 bps, uint16 maxBps)
func SnapflowEscrowFeeCapTooHighErrorID() common.Hash {
	return common.HexToHash("0x3a44746cf92ce921768f647c716329cf4bb4012e2b51939cf664fadf43af07cd")
}

// UnpackFeeCapTooHighError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error FeeCapTooHigh(uint16 bps, uint16 maxBps)
func (snapflowEscrow *SnapflowEscrow) UnpackFeeCapTooHighError(raw []byte) (*SnapflowEscrowFeeCapTooHigh, error) {
	out := new(SnapflowEscrowFeeCapTooHigh)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "FeeCapTooHigh", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInsufficientBalance represents a InsufficientBalance error raised by the SnapflowEscrow contract.
type SnapflowEscrowInsufficientBalance struct {
	Customer  common.Address
	Requested *big.Int
	Available *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InsufficientBalance(address customer, uint256 requested, uint256 available)
func SnapflowEscrowInsufficientBalanceErrorID() common.Hash {
	return common.HexToHash("0xdb42144d928cd19733b9dfeead8bc02ed403845c274e06a6eee0944fb25ca5c4")
}

// UnpackInsufficientBalanceError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InsufficientBalance(address customer, uint256 requested, uint256 available)
func (snapflowEscrow *SnapflowEscrow) UnpackInsufficientBalanceError(raw []byte) (*SnapflowEscrowInsufficientBalance, error) {
	out := new(SnapflowEscrowInsufficientBalance)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InsufficientBalance", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowInvalidSessionKey represents a InvalidSessionKey error raised by the SnapflowEscrow contract.
type SnapflowEscrowInvalidSessionKey struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error InvalidSessionKey()
func SnapflowEscrowInvalidSessionKeyErrorID() common.Hash {
	return common.HexToHash("0xbf10e9ba57cba7ca2d64e76db8dd78b2e60f38cc93ffbe3081081c36ebb72ef9")
}

// UnpackInvalidSessionKeyError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error InvalidSessionKey()
func (snapflowEscrow *SnapflowEscrow) UnpackInvalidSessionKeyError(raw []byte) (*SnapflowEscrowInvalidSessionKey, error) {
	out := new(SnapflowEscrowInvalidSessionKey)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "InvalidSessionKey", raw); err != nil {
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

// SnapflowEscrowNoFeeCapScheduled represents a NoFeeCapScheduled error raised by the SnapflowEscrow contract.
type SnapflowEscrowNoFeeCapScheduled struct {
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error NoFeeCapScheduled()
func SnapflowEscrowNoFeeCapScheduledErrorID() common.Hash {
	return common.HexToHash("0x8bdad3abec2422573954e57465e9cfd44a31632956573c6a6f2ad87f7bba00fe")
}

// UnpackNoFeeCapScheduledError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error NoFeeCapScheduled()
func (snapflowEscrow *SnapflowEscrow) UnpackNoFeeCapScheduledError(raw []byte) (*SnapflowEscrowNoFeeCapScheduled, error) {
	out := new(SnapflowEscrowNoFeeCapScheduled)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "NoFeeCapScheduled", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowNoWithdrawalRequested represents a NoWithdrawalRequested error raised by the SnapflowEscrow contract.
type SnapflowEscrowNoWithdrawalRequested struct {
	Customer common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error NoWithdrawalRequested(address customer)
func SnapflowEscrowNoWithdrawalRequestedErrorID() common.Hash {
	return common.HexToHash("0x6756774e72ff1da41f91d57c9d6906fd8139a445b1eaa518f85803b1906c112e")
}

// UnpackNoWithdrawalRequestedError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error NoWithdrawalRequested(address customer)
func (snapflowEscrow *SnapflowEscrow) UnpackNoWithdrawalRequestedError(raw []byte) (*SnapflowEscrowNoWithdrawalRequested, error) {
	out := new(SnapflowEscrowNoWithdrawalRequested)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "NoWithdrawalRequested", raw); err != nil {
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

// SnapflowEscrowSessionHourlyCapExceeded represents a SessionHourlyCapExceeded error raised by the SnapflowEscrow contract.
type SnapflowEscrowSessionHourlyCapExceeded struct {
	Key       common.Address
	Requested *big.Int
	Remaining *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SessionHourlyCapExceeded(address key, uint256 requested, uint256 remaining)
func SnapflowEscrowSessionHourlyCapExceededErrorID() common.Hash {
	return common.HexToHash("0x673e72f1d1fae7ea8d69fc54cafc9f4f3120059764221aaf093d7fc0230d06b7")
}

// UnpackSessionHourlyCapExceededError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SessionHourlyCapExceeded(address key, uint256 requested, uint256 remaining)
func (snapflowEscrow *SnapflowEscrow) UnpackSessionHourlyCapExceededError(raw []byte) (*SnapflowEscrowSessionHourlyCapExceeded, error) {
	out := new(SnapflowEscrowSessionHourlyCapExceeded)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SessionHourlyCapExceeded", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSessionKeyInactive represents a SessionKeyInactive error raised by the SnapflowEscrow contract.
type SnapflowEscrowSessionKeyInactive struct {
	Customer common.Address
	Key      common.Address
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SessionKeyInactive(address customer, address key)
func SnapflowEscrowSessionKeyInactiveErrorID() common.Hash {
	return common.HexToHash("0x295a27d3639cc5db57f2823fa52be0046afef8b8a991ed07a36ed22a07d98dc6")
}

// UnpackSessionKeyInactiveError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SessionKeyInactive(address customer, address key)
func (snapflowEscrow *SnapflowEscrow) UnpackSessionKeyInactiveError(raw []byte) (*SnapflowEscrowSessionKeyInactive, error) {
	out := new(SnapflowEscrowSessionKeyInactive)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SessionKeyInactive", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowSessionSpendCapExceeded represents a SessionSpendCapExceeded error raised by the SnapflowEscrow contract.
type SnapflowEscrowSessionSpendCapExceeded struct {
	Key       common.Address
	Requested *big.Int
	Remaining *big.Int
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error SessionSpendCapExceeded(address key, uint256 requested, uint256 remaining)
func SnapflowEscrowSessionSpendCapExceededErrorID() common.Hash {
	return common.HexToHash("0x99e2a724de471a60bf33efa56933ee082b95042510ebdac1ef3e4c3b64be2831")
}

// UnpackSessionSpendCapExceededError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error SessionSpendCapExceeded(address key, uint256 requested, uint256 remaining)
func (snapflowEscrow *SnapflowEscrow) UnpackSessionSpendCapExceededError(raw []byte) (*SnapflowEscrowSessionSpendCapExceeded, error) {
	out := new(SnapflowEscrowSessionSpendCapExceeded)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "SessionSpendCapExceeded", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowStaleVoucher represents a StaleVoucher error raised by the SnapflowEscrow contract.
type SnapflowEscrowStaleVoucher struct {
	Sequence     uint64
	LastSequence uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error StaleVoucher(uint64 sequence, uint64 lastSequence)
func SnapflowEscrowStaleVoucherErrorID() common.Hash {
	return common.HexToHash("0x18810f87bf26dd69b02c71ebffdf58029e1b04582e25570c9b497dd4e63488bd")
}

// UnpackStaleVoucherError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error StaleVoucher(uint64 sequence, uint64 lastSequence)
func (snapflowEscrow *SnapflowEscrow) UnpackStaleVoucherError(raw []byte) (*SnapflowEscrowStaleVoucher, error) {
	out := new(SnapflowEscrowStaleVoucher)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "StaleVoucher", raw); err != nil {
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

// SnapflowEscrowVoucherExpired represents a VoucherExpired error raised by the SnapflowEscrow contract.
type SnapflowEscrowVoucherExpired struct {
	Expiry uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error VoucherExpired(uint64 expiry)
func SnapflowEscrowVoucherExpiredErrorID() common.Hash {
	return common.HexToHash("0x68641fc4ff727b4ba49673f5a2e61ecf2e0f7e4e7af0d125fda7c4d07ec2c76d")
}

// UnpackVoucherExpiredError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error VoucherExpired(uint64 expiry)
func (snapflowEscrow *SnapflowEscrow) UnpackVoucherExpiredError(raw []byte) (*SnapflowEscrowVoucherExpired, error) {
	out := new(SnapflowEscrowVoucherExpired)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "VoucherExpired", raw); err != nil {
		return nil, err
	}
	return out, nil
}

// SnapflowEscrowWithdrawalNotReady represents a WithdrawalNotReady error raised by the SnapflowEscrow contract.
type SnapflowEscrowWithdrawalNotReady struct {
	ReadyAt uint64
}

// ErrorID returns the hash of canonical representation of the error's signature.
//
// Solidity: error WithdrawalNotReady(uint64 readyAt)
func SnapflowEscrowWithdrawalNotReadyErrorID() common.Hash {
	return common.HexToHash("0xb4387448a3ea3bd3bf98108bfbf80e13e305852c3294fe983f97d1242551535a")
}

// UnpackWithdrawalNotReadyError is the Go binding used to decode the provided
// error data into the corresponding Go error struct.
//
// Solidity: error WithdrawalNotReady(uint64 readyAt)
func (snapflowEscrow *SnapflowEscrow) UnpackWithdrawalNotReadyError(raw []byte) (*SnapflowEscrowWithdrawalNotReady, error) {
	out := new(SnapflowEscrowWithdrawalNotReady)
	if err := snapflowEscrow.abi.UnpackIntoInterface(out, "WithdrawalNotReady", raw); err != nil {
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
