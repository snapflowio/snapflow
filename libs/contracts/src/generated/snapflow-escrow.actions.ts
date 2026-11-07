import {
  createReadContract,
  createWriteContract,
  createSimulateContract,
  createWatchContractEvent,
} from '@wagmi/core/codegen'

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SnapflowEscrow
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const snapflowEscrowAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'token_', internalType: 'contract IERC20', type: 'address' },
      { name: 'admin', internalType: 'address', type: 'address' },
      { name: 'initialFeeRecipient', internalType: 'address', type: 'address' },
      { name: 'initialFeeCapBps', internalType: 'uint16', type: 'uint16' },
      { name: 'disputeWindow_', internalType: 'uint64', type: 'uint64' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'COMPLIANCE_ROLE',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'DEFAULT_ADMIN_ROLE',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'PAUSER_ROLE',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'acceptDefaultAdminTransfer',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'applyFeeCap',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'customer', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'newAdmin', internalType: 'address', type: 'address' }],
    name: 'beginDefaultAdminTransfer',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'blockAccount',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'cancelDefaultAdminTransfer',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'cancelFeeCapSchedule',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'cancelWithdrawal',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newDelay', internalType: 'uint48', type: 'uint48' }],
    name: 'changeDefaultAdminDelay',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'channelId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'channelOf',
    outputs: [
      {
        name: '',
        internalType: 'struct Channel',
        type: 'tuple',
        components: [
          { name: 'customer', internalType: 'address', type: 'address' },
          { name: 'host', internalType: 'address', type: 'address' },
          { name: 'sequence', internalType: 'uint64', type: 'uint64' },
          { name: 'hostClaimed', internalType: 'uint256', type: 'uint256' },
          { name: 'feeClaimed', internalType: 'uint256', type: 'uint256' },
          { name: 'serviceClaimed', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'signed',
        internalType: 'struct SignedVoucher',
        type: 'tuple',
        components: [
          {
            name: 'voucher',
            internalType: 'struct Voucher',
            type: 'tuple',
            components: [
              { name: 'channelId', internalType: 'bytes32', type: 'bytes32' },
              { name: 'customer', internalType: 'address', type: 'address' },
              { name: 'host', internalType: 'address', type: 'address' },
              { name: 'hostAmount', internalType: 'uint256', type: 'uint256' },
              { name: 'feeAmount', internalType: 'uint256', type: 'uint256' },
              {
                name: 'serviceAmount',
                internalType: 'uint256',
                type: 'uint256',
              },
              { name: 'sequence', internalType: 'uint64', type: 'uint64' },
              { name: 'expiry', internalType: 'uint64', type: 'uint64' },
            ],
          },
          { name: 'signer', internalType: 'address', type: 'address' },
          { name: 'signature', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'signed',
        internalType: 'struct SignedVoucher[]',
        type: 'tuple[]',
        components: [
          {
            name: 'voucher',
            internalType: 'struct Voucher',
            type: 'tuple',
            components: [
              { name: 'channelId', internalType: 'bytes32', type: 'bytes32' },
              { name: 'customer', internalType: 'address', type: 'address' },
              { name: 'host', internalType: 'address', type: 'address' },
              { name: 'hostAmount', internalType: 'uint256', type: 'uint256' },
              { name: 'feeAmount', internalType: 'uint256', type: 'uint256' },
              {
                name: 'serviceAmount',
                internalType: 'uint256',
                type: 'uint256',
              },
              { name: 'sequence', internalType: 'uint64', type: 'uint64' },
              { name: 'expiry', internalType: 'uint64', type: 'uint64' },
            ],
          },
          { name: 'signer', internalType: 'address', type: 'address' },
          { name: 'signature', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    name: 'claimBatch',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'defaultAdmin',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'defaultAdminDelay',
    outputs: [{ name: '', internalType: 'uint48', type: 'uint48' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'defaultAdminDelayIncreaseWait',
    outputs: [{ name: '', internalType: 'uint48', type: 'uint48' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'customer', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'depositFor',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
      { name: 'v', internalType: 'uint8', type: 'uint8' },
      { name: 'r', internalType: 'bytes32', type: 'bytes32' },
      { name: 's', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'depositWithPermit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'disputeWindow',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'eip712Domain',
    outputs: [
      { name: 'fields', internalType: 'bytes1', type: 'bytes1' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'version', internalType: 'string', type: 'string' },
      { name: 'chainId', internalType: 'uint256', type: 'uint256' },
      { name: 'verifyingContract', internalType: 'address', type: 'address' },
      { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
      { name: 'extensions', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'feeCapBps',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'feeRecipient',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'role', internalType: 'bytes32', type: 'bytes32' }],
    name: 'getRoleAdmin',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32' },
      { name: 'account', internalType: 'address', type: 'address' },
    ],
    name: 'grantRole',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32' },
      { name: 'account', internalType: 'address', type: 'address' },
    ],
    name: 'hasRole',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'isBlocked',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pendingDefaultAdmin',
    outputs: [
      { name: 'newAdmin', internalType: 'address', type: 'address' },
      { name: 'schedule', internalType: 'uint48', type: 'uint48' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pendingDefaultAdminDelay',
    outputs: [
      { name: 'newDelay', internalType: 'uint48', type: 'uint48' },
      { name: 'schedule', internalType: 'uint48', type: 'uint48' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pendingFeeCap',
    outputs: [
      {
        name: '',
        internalType: 'struct FeeCapChange',
        type: 'tuple',
        components: [
          { name: 'bps', internalType: 'uint16', type: 'uint16' },
          { name: 'effectiveAt', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32' },
      { name: 'account', internalType: 'address', type: 'address' },
    ],
    name: 'renounceRole',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'requestWithdrawal',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32' },
      { name: 'account', internalType: 'address', type: 'address' },
    ],
    name: 'revokeRole',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'key', internalType: 'address', type: 'address' }],
    name: 'revokeSessionKey',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'rollbackDefaultAdminDelay',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'bps', internalType: 'uint16', type: 'uint16' }],
    name: 'scheduleFeeCap',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'customer', internalType: 'address', type: 'address' },
      { name: 'key', internalType: 'address', type: 'address' },
    ],
    name: 'sessionKeyOf',
    outputs: [
      {
        name: '',
        internalType: 'struct SessionKey',
        type: 'tuple',
        components: [
          { name: 'spendCap', internalType: 'uint128', type: 'uint128' },
          { name: 'spent', internalType: 'uint128', type: 'uint128' },
          { name: 'hourlyCap', internalType: 'uint128', type: 'uint128' },
          { name: 'activatedAt', internalType: 'uint64', type: 'uint64' },
          { name: 'expiry', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'recipient', internalType: 'address', type: 'address' }],
    name: 'setFeeRecipient',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'key', internalType: 'address', type: 'address' },
      { name: 'spendCap', internalType: 'uint128', type: 'uint128' },
      { name: 'hourlyCap', internalType: 'uint128', type: 'uint128' },
      { name: 'expiry', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'setSessionKey',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'token',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'unblockAccount',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'voucher',
        internalType: 'struct Voucher',
        type: 'tuple',
        components: [
          { name: 'channelId', internalType: 'bytes32', type: 'bytes32' },
          { name: 'customer', internalType: 'address', type: 'address' },
          { name: 'host', internalType: 'address', type: 'address' },
          { name: 'hostAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'feeAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'serviceAmount', internalType: 'uint256', type: 'uint256' },
          { name: 'sequence', internalType: 'uint64', type: 'uint64' },
          { name: 'expiry', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    name: 'voucherDigest',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'customer', internalType: 'address', type: 'address' }],
    name: 'withdrawalOf',
    outputs: [
      {
        name: '',
        internalType: 'struct WithdrawalRequest',
        type: 'tuple',
        components: [
          { name: 'amount', internalType: 'uint256', type: 'uint256' },
          { name: 'readyAt', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'AddressBlocked',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'AddressUnblocked',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'channelId',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'customer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'host', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'hostPaid',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'feePaid',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'servicePaid',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'sequence',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Claimed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [],
    name: 'DefaultAdminDelayChangeCanceled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newDelay',
        internalType: 'uint48',
        type: 'uint48',
        indexed: false,
      },
      {
        name: 'effectSchedule',
        internalType: 'uint48',
        type: 'uint48',
        indexed: false,
      },
    ],
    name: 'DefaultAdminDelayChangeScheduled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [],
    name: 'DefaultAdminTransferCanceled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newAdmin',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'acceptSchedule',
        internalType: 'uint48',
        type: 'uint48',
        indexed: false,
      },
    ],
    name: 'DefaultAdminTransferScheduled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'customer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'payer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Deposited',
  },
  { type: 'event', anonymous: false, inputs: [], name: 'EIP712DomainChanged' },
  {
    type: 'event',
    anonymous: false,
    inputs: [],
    name: 'FeeCapScheduleCancelled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'bps', internalType: 'uint16', type: 'uint16', indexed: false },
      {
        name: 'effectiveAt',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'FeeCapScheduled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousBps',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
      { name: 'bps', internalType: 'uint16', type: 'uint16', indexed: false },
    ],
    name: 'FeeCapUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousRecipient',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'recipient',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'FeeRecipientUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'Paused',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32', indexed: true },
      {
        name: 'previousAdminRole',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'newAdminRole',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
    ],
    name: 'RoleAdminChanged',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32', indexed: true },
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'RoleGranted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'role', internalType: 'bytes32', type: 'bytes32', indexed: true },
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'RoleRevoked',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'customer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'key', internalType: 'address', type: 'address', indexed: true },
    ],
    name: 'SessionKeyRevoked',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'customer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'key', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'spendCap',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'hourlyCap',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'expiry',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'SessionKeySet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'Unpaused',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'customer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'WithdrawalCancelled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'customer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'readyAt',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'WithdrawalRequested',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'customer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Withdrawn',
  },
  { type: 'error', inputs: [], name: 'AccessControlBadConfirmation' },
  {
    type: 'error',
    inputs: [{ name: 'schedule', internalType: 'uint48', type: 'uint48' }],
    name: 'AccessControlEnforcedDefaultAdminDelay',
  },
  { type: 'error', inputs: [], name: 'AccessControlEnforcedDefaultAdminRules' },
  {
    type: 'error',
    inputs: [
      { name: 'defaultAdmin', internalType: 'address', type: 'address' },
    ],
    name: 'AccessControlInvalidDefaultAdmin',
  },
  {
    type: 'error',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'neededRole', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'AccessControlUnauthorizedAccount',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'AccountBlocked',
  },
  {
    type: 'error',
    inputs: [{ name: 'channelId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'AmountDecreased',
  },
  {
    type: 'error',
    inputs: [{ name: 'channelId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'ChannelMismatch',
  },
  {
    type: 'error',
    inputs: [{ name: 'window', internalType: 'uint64', type: 'uint64' }],
    name: 'DisputeWindowOutOfRange',
  },
  { type: 'error', inputs: [], name: 'EmptyBatch' },
  { type: 'error', inputs: [], name: 'EnforcedPause' },
  { type: 'error', inputs: [], name: 'ExpectedPause' },
  {
    type: 'error',
    inputs: [
      { name: 'feeDelta', internalType: 'uint256', type: 'uint256' },
      { name: 'allowed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'FeeAboveCap',
  },
  {
    type: 'error',
    inputs: [{ name: 'effectiveAt', internalType: 'uint64', type: 'uint64' }],
    name: 'FeeCapNotReady',
  },
  {
    type: 'error',
    inputs: [
      { name: 'bps', internalType: 'uint16', type: 'uint16' },
      { name: 'maxBps', internalType: 'uint16', type: 'uint16' },
    ],
    name: 'FeeCapTooHigh',
  },
  {
    type: 'error',
    inputs: [
      { name: 'customer', internalType: 'address', type: 'address' },
      { name: 'requested', internalType: 'uint256', type: 'uint256' },
      { name: 'available', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'InsufficientBalance',
  },
  { type: 'error', inputs: [], name: 'InvalidSessionKey' },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  {
    type: 'error',
    inputs: [{ name: 'signer', internalType: 'address', type: 'address' }],
    name: 'InvalidSignature',
  },
  { type: 'error', inputs: [], name: 'NoFeeCapScheduled' },
  {
    type: 'error',
    inputs: [{ name: 'customer', internalType: 'address', type: 'address' }],
    name: 'NoWithdrawalRequested',
  },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  {
    type: 'error',
    inputs: [
      { name: 'bits', internalType: 'uint8', type: 'uint8' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'SafeCastOverflowedUintDowncast',
  },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  {
    type: 'error',
    inputs: [
      { name: 'key', internalType: 'address', type: 'address' },
      { name: 'requested', internalType: 'uint256', type: 'uint256' },
      { name: 'remaining', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'SessionHourlyCapExceeded',
  },
  {
    type: 'error',
    inputs: [
      { name: 'customer', internalType: 'address', type: 'address' },
      { name: 'key', internalType: 'address', type: 'address' },
    ],
    name: 'SessionKeyInactive',
  },
  {
    type: 'error',
    inputs: [
      { name: 'key', internalType: 'address', type: 'address' },
      { name: 'requested', internalType: 'uint256', type: 'uint256' },
      { name: 'remaining', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'SessionSpendCapExceeded',
  },
  {
    type: 'error',
    inputs: [
      { name: 'sequence', internalType: 'uint64', type: 'uint64' },
      { name: 'lastSequence', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'StaleVoucher',
  },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong',
  },
  {
    type: 'error',
    inputs: [{ name: 'expiry', internalType: 'uint64', type: 'uint64' }],
    name: 'VoucherExpired',
  },
  {
    type: 'error',
    inputs: [{ name: 'readyAt', internalType: 'uint64', type: 'uint64' }],
    name: 'WithdrawalNotReady',
  },
  { type: 'error', inputs: [], name: 'ZeroAddress' },
  { type: 'error', inputs: [], name: 'ZeroAmount' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Usdc
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const usdcAbi = [
  {
    type: 'event',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
    name: 'Transfer',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Action
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__
 */
export const readSnapflowEscrow = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"COMPLIANCE_ROLE"`
 */
export const readSnapflowEscrowComplianceRole =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'COMPLIANCE_ROLE',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"DEFAULT_ADMIN_ROLE"`
 */
export const readSnapflowEscrowDefaultAdminRole =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'DEFAULT_ADMIN_ROLE',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"PAUSER_ROLE"`
 */
export const readSnapflowEscrowPauserRole = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'PAUSER_ROLE',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"balanceOf"`
 */
export const readSnapflowEscrowBalanceOf = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"channelOf"`
 */
export const readSnapflowEscrowChannelOf = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'channelOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"defaultAdmin"`
 */
export const readSnapflowEscrowDefaultAdmin = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'defaultAdmin',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"defaultAdminDelay"`
 */
export const readSnapflowEscrowDefaultAdminDelay =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'defaultAdminDelay',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"defaultAdminDelayIncreaseWait"`
 */
export const readSnapflowEscrowDefaultAdminDelayIncreaseWait =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'defaultAdminDelayIncreaseWait',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"disputeWindow"`
 */
export const readSnapflowEscrowDisputeWindow = /*#__PURE__*/ createReadContract(
  { abi: snapflowEscrowAbi, functionName: 'disputeWindow' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"eip712Domain"`
 */
export const readSnapflowEscrowEip712Domain = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'eip712Domain',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"feeCapBps"`
 */
export const readSnapflowEscrowFeeCapBps = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'feeCapBps',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"feeRecipient"`
 */
export const readSnapflowEscrowFeeRecipient = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'feeRecipient',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"getRoleAdmin"`
 */
export const readSnapflowEscrowGetRoleAdmin = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'getRoleAdmin',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"hasRole"`
 */
export const readSnapflowEscrowHasRole = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'hasRole',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"isBlocked"`
 */
export const readSnapflowEscrowIsBlocked = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'isBlocked',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"owner"`
 */
export const readSnapflowEscrowOwner = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"paused"`
 */
export const readSnapflowEscrowPaused = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'paused',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"pendingDefaultAdmin"`
 */
export const readSnapflowEscrowPendingDefaultAdmin =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'pendingDefaultAdmin',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"pendingDefaultAdminDelay"`
 */
export const readSnapflowEscrowPendingDefaultAdminDelay =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'pendingDefaultAdminDelay',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"pendingFeeCap"`
 */
export const readSnapflowEscrowPendingFeeCap = /*#__PURE__*/ createReadContract(
  { abi: snapflowEscrowAbi, functionName: 'pendingFeeCap' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"sessionKeyOf"`
 */
export const readSnapflowEscrowSessionKeyOf = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'sessionKeyOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"supportsInterface"`
 */
export const readSnapflowEscrowSupportsInterface =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'supportsInterface',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"token"`
 */
export const readSnapflowEscrowToken = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'token',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"voucherDigest"`
 */
export const readSnapflowEscrowVoucherDigest = /*#__PURE__*/ createReadContract(
  { abi: snapflowEscrowAbi, functionName: 'voucherDigest' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"withdrawalOf"`
 */
export const readSnapflowEscrowWithdrawalOf = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'withdrawalOf',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__
 */
export const writeSnapflowEscrow = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"acceptDefaultAdminTransfer"`
 */
export const writeSnapflowEscrowAcceptDefaultAdminTransfer =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'acceptDefaultAdminTransfer',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"applyFeeCap"`
 */
export const writeSnapflowEscrowApplyFeeCap = /*#__PURE__*/ createWriteContract(
  { abi: snapflowEscrowAbi, functionName: 'applyFeeCap' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"beginDefaultAdminTransfer"`
 */
export const writeSnapflowEscrowBeginDefaultAdminTransfer =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'beginDefaultAdminTransfer',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"blockAccount"`
 */
export const writeSnapflowEscrowBlockAccount =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'blockAccount',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"cancelDefaultAdminTransfer"`
 */
export const writeSnapflowEscrowCancelDefaultAdminTransfer =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'cancelDefaultAdminTransfer',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"cancelFeeCapSchedule"`
 */
export const writeSnapflowEscrowCancelFeeCapSchedule =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'cancelFeeCapSchedule',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"cancelWithdrawal"`
 */
export const writeSnapflowEscrowCancelWithdrawal =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'cancelWithdrawal',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"changeDefaultAdminDelay"`
 */
export const writeSnapflowEscrowChangeDefaultAdminDelay =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'changeDefaultAdminDelay',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"claim"`
 */
export const writeSnapflowEscrowClaim = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'claim',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"claimBatch"`
 */
export const writeSnapflowEscrowClaimBatch = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'claimBatch',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"deposit"`
 */
export const writeSnapflowEscrowDeposit = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'deposit',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"depositFor"`
 */
export const writeSnapflowEscrowDepositFor = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'depositFor',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"depositWithPermit"`
 */
export const writeSnapflowEscrowDepositWithPermit =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'depositWithPermit',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"grantRole"`
 */
export const writeSnapflowEscrowGrantRole = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'grantRole',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"pause"`
 */
export const writeSnapflowEscrowPause = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'pause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"renounceRole"`
 */
export const writeSnapflowEscrowRenounceRole =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'renounceRole',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"requestWithdrawal"`
 */
export const writeSnapflowEscrowRequestWithdrawal =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'requestWithdrawal',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"revokeRole"`
 */
export const writeSnapflowEscrowRevokeRole = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'revokeRole',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"revokeSessionKey"`
 */
export const writeSnapflowEscrowRevokeSessionKey =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'revokeSessionKey',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"rollbackDefaultAdminDelay"`
 */
export const writeSnapflowEscrowRollbackDefaultAdminDelay =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'rollbackDefaultAdminDelay',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"scheduleFeeCap"`
 */
export const writeSnapflowEscrowScheduleFeeCap =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'scheduleFeeCap',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"setFeeRecipient"`
 */
export const writeSnapflowEscrowSetFeeRecipient =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'setFeeRecipient',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"setSessionKey"`
 */
export const writeSnapflowEscrowSetSessionKey =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'setSessionKey',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"unblockAccount"`
 */
export const writeSnapflowEscrowUnblockAccount =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'unblockAccount',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"unpause"`
 */
export const writeSnapflowEscrowUnpause = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'unpause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"withdraw"`
 */
export const writeSnapflowEscrowWithdraw = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'withdraw',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__
 */
export const simulateSnapflowEscrow = /*#__PURE__*/ createSimulateContract({
  abi: snapflowEscrowAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"acceptDefaultAdminTransfer"`
 */
export const simulateSnapflowEscrowAcceptDefaultAdminTransfer =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'acceptDefaultAdminTransfer',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"applyFeeCap"`
 */
export const simulateSnapflowEscrowApplyFeeCap =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'applyFeeCap',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"beginDefaultAdminTransfer"`
 */
export const simulateSnapflowEscrowBeginDefaultAdminTransfer =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'beginDefaultAdminTransfer',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"blockAccount"`
 */
export const simulateSnapflowEscrowBlockAccount =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'blockAccount',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"cancelDefaultAdminTransfer"`
 */
export const simulateSnapflowEscrowCancelDefaultAdminTransfer =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'cancelDefaultAdminTransfer',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"cancelFeeCapSchedule"`
 */
export const simulateSnapflowEscrowCancelFeeCapSchedule =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'cancelFeeCapSchedule',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"cancelWithdrawal"`
 */
export const simulateSnapflowEscrowCancelWithdrawal =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'cancelWithdrawal',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"changeDefaultAdminDelay"`
 */
export const simulateSnapflowEscrowChangeDefaultAdminDelay =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'changeDefaultAdminDelay',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"claim"`
 */
export const simulateSnapflowEscrowClaim = /*#__PURE__*/ createSimulateContract(
  { abi: snapflowEscrowAbi, functionName: 'claim' },
)

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"claimBatch"`
 */
export const simulateSnapflowEscrowClaimBatch =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'claimBatch',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"deposit"`
 */
export const simulateSnapflowEscrowDeposit =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'deposit',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"depositFor"`
 */
export const simulateSnapflowEscrowDepositFor =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'depositFor',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"depositWithPermit"`
 */
export const simulateSnapflowEscrowDepositWithPermit =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'depositWithPermit',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"grantRole"`
 */
export const simulateSnapflowEscrowGrantRole =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'grantRole',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"pause"`
 */
export const simulateSnapflowEscrowPause = /*#__PURE__*/ createSimulateContract(
  { abi: snapflowEscrowAbi, functionName: 'pause' },
)

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"renounceRole"`
 */
export const simulateSnapflowEscrowRenounceRole =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'renounceRole',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"requestWithdrawal"`
 */
export const simulateSnapflowEscrowRequestWithdrawal =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'requestWithdrawal',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"revokeRole"`
 */
export const simulateSnapflowEscrowRevokeRole =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'revokeRole',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"revokeSessionKey"`
 */
export const simulateSnapflowEscrowRevokeSessionKey =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'revokeSessionKey',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"rollbackDefaultAdminDelay"`
 */
export const simulateSnapflowEscrowRollbackDefaultAdminDelay =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'rollbackDefaultAdminDelay',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"scheduleFeeCap"`
 */
export const simulateSnapflowEscrowScheduleFeeCap =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'scheduleFeeCap',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"setFeeRecipient"`
 */
export const simulateSnapflowEscrowSetFeeRecipient =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'setFeeRecipient',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"setSessionKey"`
 */
export const simulateSnapflowEscrowSetSessionKey =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'setSessionKey',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"unblockAccount"`
 */
export const simulateSnapflowEscrowUnblockAccount =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'unblockAccount',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"unpause"`
 */
export const simulateSnapflowEscrowUnpause =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'unpause',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"withdraw"`
 */
export const simulateSnapflowEscrowWithdraw =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'withdraw',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__
 */
export const watchSnapflowEscrowEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: snapflowEscrowAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"AddressBlocked"`
 */
export const watchSnapflowEscrowAddressBlockedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'AddressBlocked',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"AddressUnblocked"`
 */
export const watchSnapflowEscrowAddressUnblockedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'AddressUnblocked',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"Claimed"`
 */
export const watchSnapflowEscrowClaimedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'Claimed',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"DefaultAdminDelayChangeCanceled"`
 */
export const watchSnapflowEscrowDefaultAdminDelayChangeCanceledEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'DefaultAdminDelayChangeCanceled',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"DefaultAdminDelayChangeScheduled"`
 */
export const watchSnapflowEscrowDefaultAdminDelayChangeScheduledEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'DefaultAdminDelayChangeScheduled',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"DefaultAdminTransferCanceled"`
 */
export const watchSnapflowEscrowDefaultAdminTransferCanceledEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'DefaultAdminTransferCanceled',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"DefaultAdminTransferScheduled"`
 */
export const watchSnapflowEscrowDefaultAdminTransferScheduledEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'DefaultAdminTransferScheduled',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"Deposited"`
 */
export const watchSnapflowEscrowDepositedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'Deposited',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"EIP712DomainChanged"`
 */
export const watchSnapflowEscrowEip712DomainChangedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'EIP712DomainChanged',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"FeeCapScheduleCancelled"`
 */
export const watchSnapflowEscrowFeeCapScheduleCancelledEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'FeeCapScheduleCancelled',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"FeeCapScheduled"`
 */
export const watchSnapflowEscrowFeeCapScheduledEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'FeeCapScheduled',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"FeeCapUpdated"`
 */
export const watchSnapflowEscrowFeeCapUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'FeeCapUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"FeeRecipientUpdated"`
 */
export const watchSnapflowEscrowFeeRecipientUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'FeeRecipientUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"Paused"`
 */
export const watchSnapflowEscrowPausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'Paused',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"RoleAdminChanged"`
 */
export const watchSnapflowEscrowRoleAdminChangedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'RoleAdminChanged',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"RoleGranted"`
 */
export const watchSnapflowEscrowRoleGrantedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'RoleGranted',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"RoleRevoked"`
 */
export const watchSnapflowEscrowRoleRevokedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'RoleRevoked',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"SessionKeyRevoked"`
 */
export const watchSnapflowEscrowSessionKeyRevokedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'SessionKeyRevoked',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"SessionKeySet"`
 */
export const watchSnapflowEscrowSessionKeySetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'SessionKeySet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"Unpaused"`
 */
export const watchSnapflowEscrowUnpausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'Unpaused',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"WithdrawalCancelled"`
 */
export const watchSnapflowEscrowWithdrawalCancelledEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'WithdrawalCancelled',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"WithdrawalRequested"`
 */
export const watchSnapflowEscrowWithdrawalRequestedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'WithdrawalRequested',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"Withdrawn"`
 */
export const watchSnapflowEscrowWithdrawnEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'Withdrawn',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link usdcAbi}__
 */
export const readUsdc = /*#__PURE__*/ createReadContract({ abi: usdcAbi })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link usdcAbi}__ and `functionName` set to `"allowance"`
 */
export const readUsdcAllowance = /*#__PURE__*/ createReadContract({
  abi: usdcAbi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link usdcAbi}__ and `functionName` set to `"balanceOf"`
 */
export const readUsdcBalanceOf = /*#__PURE__*/ createReadContract({
  abi: usdcAbi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link usdcAbi}__ and `functionName` set to `"decimals"`
 */
export const readUsdcDecimals = /*#__PURE__*/ createReadContract({
  abi: usdcAbi,
  functionName: 'decimals',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link usdcAbi}__ and `functionName` set to `"name"`
 */
export const readUsdcName = /*#__PURE__*/ createReadContract({
  abi: usdcAbi,
  functionName: 'name',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link usdcAbi}__ and `functionName` set to `"symbol"`
 */
export const readUsdcSymbol = /*#__PURE__*/ createReadContract({
  abi: usdcAbi,
  functionName: 'symbol',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link usdcAbi}__ and `functionName` set to `"totalSupply"`
 */
export const readUsdcTotalSupply = /*#__PURE__*/ createReadContract({
  abi: usdcAbi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link usdcAbi}__
 */
export const writeUsdc = /*#__PURE__*/ createWriteContract({ abi: usdcAbi })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link usdcAbi}__ and `functionName` set to `"approve"`
 */
export const writeUsdcApprove = /*#__PURE__*/ createWriteContract({
  abi: usdcAbi,
  functionName: 'approve',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link usdcAbi}__ and `functionName` set to `"transfer"`
 */
export const writeUsdcTransfer = /*#__PURE__*/ createWriteContract({
  abi: usdcAbi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link usdcAbi}__ and `functionName` set to `"transferFrom"`
 */
export const writeUsdcTransferFrom = /*#__PURE__*/ createWriteContract({
  abi: usdcAbi,
  functionName: 'transferFrom',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link usdcAbi}__
 */
export const simulateUsdc = /*#__PURE__*/ createSimulateContract({
  abi: usdcAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link usdcAbi}__ and `functionName` set to `"approve"`
 */
export const simulateUsdcApprove = /*#__PURE__*/ createSimulateContract({
  abi: usdcAbi,
  functionName: 'approve',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link usdcAbi}__ and `functionName` set to `"transfer"`
 */
export const simulateUsdcTransfer = /*#__PURE__*/ createSimulateContract({
  abi: usdcAbi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link usdcAbi}__ and `functionName` set to `"transferFrom"`
 */
export const simulateUsdcTransferFrom = /*#__PURE__*/ createSimulateContract({
  abi: usdcAbi,
  functionName: 'transferFrom',
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link usdcAbi}__
 */
export const watchUsdcEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: usdcAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link usdcAbi}__ and `eventName` set to `"Approval"`
 */
export const watchUsdcApprovalEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: usdcAbi,
  eventName: 'Approval',
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link usdcAbi}__ and `eventName` set to `"Transfer"`
 */
export const watchUsdcTransferEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: usdcAbi,
  eventName: 'Transfer',
})
