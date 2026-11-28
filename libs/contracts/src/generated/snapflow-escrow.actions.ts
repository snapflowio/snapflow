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
      {
        name: 'roles',
        internalType: 'struct EscrowRoles',
        type: 'tuple',
        components: [
          { name: 'admin', internalType: 'address', type: 'address' },
          { name: 'pauser', internalType: 'address', type: 'address' },
          { name: 'guardian', internalType: 'address', type: 'address' },
          { name: 'claimsFreezer', internalType: 'address', type: 'address' },
          { name: 'compliance', internalType: 'address', type: 'address' },
        ],
      },
      {
        name: 'windows',
        internalType: 'struct EscrowWindows',
        type: 'tuple',
        components: [
          { name: 'withdrawalDelay', internalType: 'uint64', type: 'uint64' },
          { name: 'claimWindow', internalType: 'uint64', type: 'uint64' },
          { name: 'signerThawPeriod', internalType: 'uint64', type: 'uint64' },
        ],
      },
      {
        name: 'caps',
        internalType: 'struct DepositCaps',
        type: 'tuple',
        components: [
          { name: 'total', internalType: 'uint128', type: 'uint128' },
          { name: 'perAccount', internalType: 'uint128', type: 'uint128' },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'CLAIMS_FREEZE_ROLE',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
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
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'accountOf',
    outputs: [
      {
        name: '',
        internalType: 'struct Account',
        type: 'tuple',
        components: [
          { name: 'free', internalType: 'uint128', type: 'uint128' },
          { name: 'pending', internalType: 'uint128', type: 'uint128' },
          { name: 'unlockAt', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'signer', internalType: 'address', type: 'address' },
      {
        name: 'scope',
        internalType: 'struct SignerScope',
        type: 'tuple',
        components: [
          { name: 'hourlyCap', internalType: 'uint96', type: 'uint96' },
          { name: 'expiry', internalType: 'uint64', type: 'uint64' },
          { name: 'maxFeeBps', internalType: 'uint16', type: 'uint16' },
          { name: 'host', internalType: 'address', type: 'address' },
        ],
      },
      { name: 'proofDeadline', internalType: 'uint256', type: 'uint256' },
      { name: 'proof', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'authorizeSigner',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'customer', internalType: 'address', type: 'address' },
      { name: 'relayFee', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'autoTopUp',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'customer', internalType: 'address', type: 'address' }],
    name: 'autoTopUpOf',
    outputs: [
      {
        name: '',
        internalType: 'struct AutoTopUp',
        type: 'tuple',
        components: [
          { name: 'relayer', internalType: 'address', type: 'address' },
          { name: 'minInterval', internalType: 'uint32', type: 'uint32' },
          { name: 'lastTopUpAt', internalType: 'uint64', type: 'uint64' },
          { name: 'amount', internalType: 'uint128', type: 'uint128' },
          { name: 'threshold', internalType: 'uint128', type: 'uint128' },
          { name: 'maxRelayFee', internalType: 'uint128', type: 'uint128' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'customer', internalType: 'address', type: 'address' }],
    name: 'availableOf',
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
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'reason', internalType: 'enum BlockReason', type: 'uint8' },
      { name: 'duration', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'blockAccount',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'blockOf',
    outputs: [
      {
        name: '',
        internalType: 'struct AccountBlock',
        type: 'tuple',
        components: [
          { name: 'blockedAt', internalType: 'uint64', type: 'uint64' },
          { name: 'until', internalType: 'uint64', type: 'uint64' },
          { name: 'reason', internalType: 'enum BlockReason', type: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'blockedAt',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
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
    inputs: [
      {
        name: 'voucher',
        internalType: 'struct Voucher',
        type: 'tuple',
        components: [
          { name: 'customer', internalType: 'address', type: 'address' },
          { name: 'host', internalType: 'address', type: 'address' },
          { name: 'feeReceiver', internalType: 'address', type: 'address' },
          { name: 'feeBps', internalType: 'uint16', type: 'uint16' },
          { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'cumulativeAmount',
            internalType: 'uint128',
            type: 'uint128',
          },
          { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'metadata', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'channelIdOf',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'voucher',
        internalType: 'struct Voucher',
        type: 'tuple',
        components: [
          { name: 'customer', internalType: 'address', type: 'address' },
          { name: 'host', internalType: 'address', type: 'address' },
          { name: 'feeReceiver', internalType: 'address', type: 'address' },
          { name: 'feeBps', internalType: 'uint16', type: 'uint16' },
          { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'cumulativeAmount',
            internalType: 'uint128',
            type: 'uint128',
          },
          { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'metadata', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
      { name: 'signature', internalType: 'bytes', type: 'bytes' },
      { name: 'signer', internalType: 'address', type: 'address' },
      { name: 'maxAmount', internalType: 'uint128', type: 'uint128' },
    ],
    name: 'claim',
    outputs: [{ name: 'paid', internalType: 'uint128', type: 'uint128' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'items',
        internalType: 'struct ClaimItem[]',
        type: 'tuple[]',
        components: [
          {
            name: 'voucher',
            internalType: 'struct Voucher',
            type: 'tuple',
            components: [
              { name: 'customer', internalType: 'address', type: 'address' },
              { name: 'host', internalType: 'address', type: 'address' },
              { name: 'feeReceiver', internalType: 'address', type: 'address' },
              { name: 'feeBps', internalType: 'uint16', type: 'uint16' },
              { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'cumulativeAmount',
                internalType: 'uint128',
                type: 'uint128',
              },
              { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
              { name: 'metadata', internalType: 'bytes32', type: 'bytes32' },
            ],
          },
          { name: 'signature', internalType: 'bytes', type: 'bytes' },
          { name: 'signer', internalType: 'address', type: 'address' },
          { name: 'maxAmount', internalType: 'uint128', type: 'uint128' },
        ],
      },
    ],
    name: 'claimBatch',
    outputs: [{ name: 'totalPaid', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'items',
        internalType: 'struct ClaimItem[]',
        type: 'tuple[]',
        components: [
          {
            name: 'voucher',
            internalType: 'struct Voucher',
            type: 'tuple',
            components: [
              { name: 'customer', internalType: 'address', type: 'address' },
              { name: 'host', internalType: 'address', type: 'address' },
              { name: 'feeReceiver', internalType: 'address', type: 'address' },
              { name: 'feeBps', internalType: 'uint16', type: 'uint16' },
              { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'cumulativeAmount',
                internalType: 'uint128',
                type: 'uint128',
              },
              { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
              { name: 'metadata', internalType: 'bytes32', type: 'bytes32' },
            ],
          },
          { name: 'signature', internalType: 'bytes', type: 'bytes' },
          { name: 'signer', internalType: 'address', type: 'address' },
          { name: 'maxAmount', internalType: 'uint128', type: 'uint128' },
        ],
      },
      { name: 'host', internalType: 'address', type: 'address' },
      { name: 'payout', internalType: 'address', type: 'address' },
      { name: 'relayFee', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
      { name: 'hostSignature', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'claimBatchAndWithdraw',
    outputs: [{ name: 'totalPaid', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'claimWindow',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'channelId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'claimedOf',
    outputs: [{ name: '', internalType: 'uint128', type: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'claimsFreeze',
    outputs: [
      {
        name: '',
        internalType: 'struct ClaimsFreeze',
        type: 'tuple',
        components: [
          { name: 'since', internalType: 'uint64', type: 'uint64' },
          { name: 'until', internalType: 'uint64', type: 'uint64' },
          { name: 'accumulated', internalType: 'uint64', type: 'uint64' },
          { name: 'armed', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'completeWithdrawal',
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
    inputs: [],
    name: 'depositCaps',
    outputs: [
      {
        name: '',
        internalType: 'struct DepositCaps',
        type: 'tuple',
        components: [
          { name: 'total', internalType: 'uint128', type: 'uint128' },
          { name: 'perAccount', internalType: 'uint128', type: 'uint128' },
        ],
      },
    ],
    stateMutability: 'view',
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
      { name: 'payer', internalType: 'address', type: 'address' },
      { name: 'customer', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'relayFee', internalType: 'uint256', type: 'uint256' },
      { name: 'validAfter', internalType: 'uint256', type: 'uint256' },
      { name: 'validBefore', internalType: 'uint256', type: 'uint256' },
      { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
      { name: 'signature', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'depositWithAuthorization',
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
    name: 'disableAutoTopUp',
    outputs: [],
    stateMutability: 'nonpayable',
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
    inputs: [{ name: 'feeReceiver', internalType: 'address', type: 'address' }],
    name: 'feesAccruedOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'duration', internalType: 'uint64', type: 'uint64' }],
    name: 'freezeClaims',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'frozenBalanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
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
    inputs: [{ name: 'host', internalType: 'address', type: 'address' }],
    name: 'hostBalanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'host', internalType: 'address', type: 'address' },
      { name: 'payout', internalType: 'address', type: 'address' },
      { name: 'relayer', internalType: 'address', type: 'address' },
      { name: 'relayFee', internalType: 'uint256', type: 'uint256' },
      { name: 'nonce', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'hostWithdrawalDigest',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'host', internalType: 'address', type: 'address' }],
    name: 'hostWithdrawalNonceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'signer', internalType: 'address', type: 'address' },
      { name: 'hourlyCap', internalType: 'uint96', type: 'uint96' },
    ],
    name: 'lowerSignerLimit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'customer', internalType: 'address', type: 'address' }],
    name: 'maxDepositOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
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
    inputs: [
      { name: 'host', internalType: 'address', type: 'address' },
      { name: 'payout', internalType: 'address', type: 'address' },
      { name: 'nonce', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'payoutAddressDigest',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'host', internalType: 'address', type: 'address' }],
    name: 'payoutAddressOf',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'host', internalType: 'address', type: 'address' }],
    name: 'payoutNonceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
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
    inputs: [
      { name: 'signer', internalType: 'address', type: 'address' },
      { name: 'hourlyCap', internalType: 'uint96', type: 'uint96' },
      { name: 'expiry', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'raiseSignerLimit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'rearmClaimsFreeze',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'to', internalType: 'address', type: 'address' }],
    name: 'recoverSurplus',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'releaseFrozen',
    outputs: [],
    stateMutability: 'nonpayable',
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
    inputs: [{ name: 'signer', internalType: 'address', type: 'address' }],
    name: 'revokeSigner',
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
    inputs: [
      { name: 'relayer', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint128', type: 'uint128' },
      { name: 'threshold', internalType: 'uint128', type: 'uint128' },
      { name: 'maxRelayFee', internalType: 'uint128', type: 'uint128' },
      { name: 'minInterval', internalType: 'uint32', type: 'uint32' },
    ],
    name: 'setAutoTopUp',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'caps',
        internalType: 'struct DepositCaps',
        type: 'tuple',
        components: [
          { name: 'total', internalType: 'uint128', type: 'uint128' },
          { name: 'perAccount', internalType: 'uint128', type: 'uint128' },
        ],
      },
    ],
    name: 'setDepositCaps',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'payout', internalType: 'address', type: 'address' }],
    name: 'setPayoutAddress',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'host', internalType: 'address', type: 'address' },
      { name: 'payout', internalType: 'address', type: 'address' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
      { name: 'signature', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'setPayoutAddressWithSig',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'signer', internalType: 'address', type: 'address' }],
    name: 'signerOf',
    outputs: [
      {
        name: '',
        internalType: 'struct SignerGrant',
        type: 'tuple',
        components: [
          { name: 'customer', internalType: 'address', type: 'address' },
          { name: 'expiry', internalType: 'uint64', type: 'uint64' },
          { name: 'revoked', internalType: 'bool', type: 'bool' },
          { name: 'maxFeeBps', internalType: 'uint16', type: 'uint16' },
          { name: 'hourlyCap', internalType: 'uint96', type: 'uint96' },
          { name: 'pendingHourlyCap', internalType: 'uint96', type: 'uint96' },
          { name: 'updatedAt', internalType: 'uint64', type: 'uint64' },
          { name: 'available', internalType: 'uint128', type: 'uint128' },
          {
            name: 'pendingEffectiveAt',
            internalType: 'uint64',
            type: 'uint64',
          },
          { name: 'thawEnd', internalType: 'uint64', type: 'uint64' },
          { name: 'freezeOffset', internalType: 'uint64', type: 'uint64' },
          { name: 'remainder', internalType: 'uint16', type: 'uint16' },
          { name: 'host', internalType: 'address', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'signerThawPeriod',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
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
    inputs: [{ name: 'feeReceiver', internalType: 'address', type: 'address' }],
    name: 'sweepFees',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'signer', internalType: 'address', type: 'address' }],
    name: 'thawSigner',
    outputs: [],
    stateMutability: 'nonpayable',
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
    inputs: [],
    name: 'totalHeld',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
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
    name: 'unfrozenTime',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
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
          { name: 'customer', internalType: 'address', type: 'address' },
          { name: 'host', internalType: 'address', type: 'address' },
          { name: 'feeReceiver', internalType: 'address', type: 'address' },
          { name: 'feeBps', internalType: 'uint16', type: 'uint16' },
          { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'cumulativeAmount',
            internalType: 'uint128',
            type: 'uint128',
          },
          { name: 'timestamp', internalType: 'uint64', type: 'uint64' },
          { name: 'metadata', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'voucherDigest',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'host', internalType: 'address', type: 'address' }],
    name: 'withdrawHost',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'host', internalType: 'address', type: 'address' },
      { name: 'payout', internalType: 'address', type: 'address' },
      { name: 'relayFee', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
      { name: 'signature', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'withdrawHostWithSig',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'withdrawalDelay',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
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
      {
        name: 'reason',
        internalType: 'enum BlockReason',
        type: 'uint8',
        indexed: false,
      },
      {
        name: 'blockedAt',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
      { name: 'until', internalType: 'uint64', type: 'uint64', indexed: false },
    ],
    name: 'AccountBlocked',
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
    name: 'AccountUnblocked',
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
    name: 'AutoTopUpDisabled',
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
        name: 'relayer',
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
        name: 'relayFee',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'AutoTopUpExecuted',
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
        name: 'relayer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'threshold',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'maxRelayFee',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'minInterval',
        internalType: 'uint32',
        type: 'uint32',
        indexed: false,
      },
    ],
    name: 'AutoTopUpSet',
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
        name: 'paid',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'reason',
        internalType: 'enum ClaimFailure',
        type: 'uint8',
        indexed: false,
      },
    ],
    name: 'ClaimResult',
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
        name: 'signer',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'feeReceiver',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'paid',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      { name: 'fee', internalType: 'uint128', type: 'uint128', indexed: false },
      {
        name: 'claimed',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
    ],
    name: 'Claimed',
  },
  { type: 'event', anonymous: false, inputs: [], name: 'ClaimsFreezeRearmed' },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'by', internalType: 'address', type: 'address', indexed: true },
      { name: 'until', internalType: 'uint64', type: 'uint64', indexed: false },
    ],
    name: 'ClaimsFrozen',
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
        name: 'total',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'perAccount',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
    ],
    name: 'DepositCapsSet',
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
    inputs: [
      {
        name: 'feeReceiver',
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
    name: 'FeesSwept',
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
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Frozen',
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
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'FrozenReleased',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'host', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'payout',
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
    name: 'HostWithdrawn',
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
      { name: 'host', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'payout',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'PayoutAddressSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'relayer',
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
    name: 'RelayFeePaid',
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
      {
        name: 'signer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'hourlyCap',
        internalType: 'uint96',
        type: 'uint96',
        indexed: false,
      },
      {
        name: 'expiry',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
      {
        name: 'maxFeeBps',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
      {
        name: 'host',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'SignerAuthorized',
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
        name: 'signer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'hourlyCap',
        internalType: 'uint96',
        type: 'uint96',
        indexed: false,
      },
      {
        name: 'effectiveAt',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'SignerLimitLowerScheduled',
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
        name: 'signer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'hourlyCap',
        internalType: 'uint96',
        type: 'uint96',
        indexed: false,
      },
      {
        name: 'expiry',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'SignerLimitRaised',
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
        name: 'signer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'SignerRevoked',
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
        name: 'signer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'thawEnd',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'SignerThawed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'SurplusRecovered',
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
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
    ],
    name: 'WithdrawalCancelled',
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
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'pending',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'unlockAt',
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
        name: 'account',
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
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'room', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'AccountDepositCapExceeded',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'AccountNotBlocked',
  },
  {
    type: 'error',
    inputs: [
      { name: 'delay', internalType: 'uint48', type: 'uint48' },
      { name: 'minDelay', internalType: 'uint48', type: 'uint48' },
    ],
    name: 'AdminDelayTooShort',
  },
  {
    type: 'error',
    inputs: [
      { name: 'interval', internalType: 'uint32', type: 'uint32' },
      { name: 'minInterval', internalType: 'uint32', type: 'uint32' },
    ],
    name: 'AutoTopUpIntervalTooShort',
  },
  {
    type: 'error',
    inputs: [{ name: 'customer', internalType: 'address', type: 'address' }],
    name: 'AutoTopUpNotEnabled',
  },
  {
    type: 'error',
    inputs: [
      { name: 'customer', internalType: 'address', type: 'address' },
      { name: 'available', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'AutoTopUpNotNeeded',
  },
  {
    type: 'error',
    inputs: [
      { name: 'customer', internalType: 'address', type: 'address' },
      { name: 'nextAt', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'AutoTopUpTooSoon',
  },
  {
    type: 'error',
    inputs: [
      { name: 'size', internalType: 'uint256', type: 'uint256' },
      { name: 'maxSize', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'BatchTooLarge',
  },
  {
    type: 'error',
    inputs: [
      { name: 'duration', internalType: 'uint64', type: 'uint64' },
      { name: 'maxDuration', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'BlockDurationOutOfRange',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'Blocked',
  },
  {
    type: 'error',
    inputs: [{ name: 'window', internalType: 'uint64', type: 'uint64' }],
    name: 'ClaimWindowOutOfRange',
  },
  {
    type: 'error',
    inputs: [{ name: 'until', internalType: 'uint64', type: 'uint64' }],
    name: 'ClaimsAreFrozen',
  },
  { type: 'error', inputs: [], name: 'ClaimsFreezeArmed' },
  {
    type: 'error',
    inputs: [{ name: 'rearmAt', internalType: 'uint64', type: 'uint64' }],
    name: 'ClaimsFreezeCoolingDown',
  },
  {
    type: 'error',
    inputs: [
      { name: 'duration', internalType: 'uint64', type: 'uint64' },
      { name: 'maxDuration', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'ClaimsFreezeTooLong',
  },
  { type: 'error', inputs: [], name: 'ClaimsFreezeUnavailable' },
  {
    type: 'error',
    inputs: [
      { name: 'customer', internalType: 'address', type: 'address' },
      { name: 'blockedAt', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'CustomerBlockedForVoucher',
  },
  { type: 'error', inputs: [], name: 'EmptyBatch' },
  { type: 'error', inputs: [], name: 'EnforcedPause' },
  { type: 'error', inputs: [], name: 'ExpectedPause' },
  {
    type: 'error',
    inputs: [
      { name: 'feeBps', internalType: 'uint16', type: 'uint16' },
      { name: 'maxFeeBps', internalType: 'uint16', type: 'uint16' },
    ],
    name: 'FeeAboveSignerLimit',
  },
  {
    type: 'error',
    inputs: [{ name: 'deadline', internalType: 'uint256', type: 'uint256' }],
    name: 'HostWithdrawalSignatureExpired',
  },
  {
    type: 'error',
    inputs: [{ name: 'customer', internalType: 'address', type: 'address' }],
    name: 'InsufficientBalance',
  },
  {
    type: 'error',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'requested', internalType: 'uint256', type: 'uint256' },
      { name: 'available', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'InsufficientFreeBalance',
  },
  {
    type: 'error',
    inputs: [{ name: 'relayer', internalType: 'address', type: 'address' }],
    name: 'InvalidAutoTopUpRelayer',
  },
  {
    type: 'error',
    inputs: [{ name: 'host', internalType: 'address', type: 'address' }],
    name: 'InvalidHostWithdrawalSignature',
  },
  {
    type: 'error',
    inputs: [{ name: 'host', internalType: 'address', type: 'address' }],
    name: 'InvalidPayoutSignature',
  },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  {
    type: 'error',
    inputs: [{ name: 'signer', internalType: 'address', type: 'address' }],
    name: 'InvalidSignature',
  },
  {
    type: 'error',
    inputs: [{ name: 'signer', internalType: 'address', type: 'address' }],
    name: 'InvalidSigner',
  },
  {
    type: 'error',
    inputs: [{ name: 'signer', internalType: 'address', type: 'address' }],
    name: 'InvalidSignerProof',
  },
  { type: 'error', inputs: [], name: 'InvalidSignerScope' },
  {
    type: 'error',
    inputs: [{ name: 'channelId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'InvalidVoucherTerms',
  },
  { type: 'error', inputs: [], name: 'NoSurplus' },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'NoWithdrawalPending',
  },
  {
    type: 'error',
    inputs: [{ name: 'caller', internalType: 'address', type: 'address' }],
    name: 'NotAuthorized',
  },
  {
    type: 'error',
    inputs: [{ name: 'channelId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'NothingToClaim',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'NothingToWithdraw',
  },
  {
    type: 'error',
    inputs: [{ name: 'deadline', internalType: 'uint256', type: 'uint256' }],
    name: 'PayoutSignatureExpired',
  },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  {
    type: 'error',
    inputs: [
      { name: 'relayFee', internalType: 'uint256', type: 'uint256' },
      { name: 'maxRelayFee', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'RelayFeeTooHigh',
  },
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
      { name: 'signer', internalType: 'address', type: 'address' },
      { name: 'customer', internalType: 'address', type: 'address' },
    ],
    name: 'SignerAlreadyBound',
  },
  {
    type: 'error',
    inputs: [
      { name: 'signer', internalType: 'address', type: 'address' },
      { name: 'thawEnd', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'SignerAlreadyThawing',
  },
  {
    type: 'error',
    inputs: [{ name: 'signer', internalType: 'address', type: 'address' }],
    name: 'SignerCapReached',
  },
  {
    type: 'error',
    inputs: [{ name: 'signer', internalType: 'address', type: 'address' }],
    name: 'SignerExpired',
  },
  {
    type: 'error',
    inputs: [
      { name: 'signer', internalType: 'address', type: 'address' },
      { name: 'host', internalType: 'address', type: 'address' },
    ],
    name: 'SignerHostMismatch',
  },
  {
    type: 'error',
    inputs: [{ name: 'signer', internalType: 'address', type: 'address' }],
    name: 'SignerNotAuthorized',
  },
  {
    type: 'error',
    inputs: [{ name: 'signer', internalType: 'address', type: 'address' }],
    name: 'SignerNotThawing',
  },
  {
    type: 'error',
    inputs: [{ name: 'deadline', internalType: 'uint256', type: 'uint256' }],
    name: 'SignerProofExpired',
  },
  {
    type: 'error',
    inputs: [
      { name: 'signer', internalType: 'address', type: 'address' },
      { name: 'thawEnd', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'SignerStillThawing',
  },
  {
    type: 'error',
    inputs: [{ name: 'period', internalType: 'uint64', type: 'uint64' }],
    name: 'SignerThawPeriodOutOfRange',
  },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong',
  },
  {
    type: 'error',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'room', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'TotalDepositCapExceeded',
  },
  {
    type: 'error',
    inputs: [{ name: 'timestamp', internalType: 'uint64', type: 'uint64' }],
    name: 'VoucherFromFuture',
  },
  {
    type: 'error',
    inputs: [{ name: 'delay', internalType: 'uint64', type: 'uint64' }],
    name: 'WithdrawalDelayOutOfRange',
  },
  {
    type: 'error',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'unlockAt', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'WithdrawalLocked',
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
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"CLAIMS_FREEZE_ROLE"`
 */
export const readSnapflowEscrowClaimsFreezeRole =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'CLAIMS_FREEZE_ROLE',
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
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"accountOf"`
 */
export const readSnapflowEscrowAccountOf = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'accountOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"autoTopUpOf"`
 */
export const readSnapflowEscrowAutoTopUpOf = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'autoTopUpOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"availableOf"`
 */
export const readSnapflowEscrowAvailableOf = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'availableOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"blockOf"`
 */
export const readSnapflowEscrowBlockOf = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'blockOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"blockedAt"`
 */
export const readSnapflowEscrowBlockedAt = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'blockedAt',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"channelIdOf"`
 */
export const readSnapflowEscrowChannelIdOf = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'channelIdOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"claimWindow"`
 */
export const readSnapflowEscrowClaimWindow = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'claimWindow',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"claimedOf"`
 */
export const readSnapflowEscrowClaimedOf = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'claimedOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"claimsFreeze"`
 */
export const readSnapflowEscrowClaimsFreeze = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'claimsFreeze',
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
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"depositCaps"`
 */
export const readSnapflowEscrowDepositCaps = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'depositCaps',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"eip712Domain"`
 */
export const readSnapflowEscrowEip712Domain = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'eip712Domain',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"feesAccruedOf"`
 */
export const readSnapflowEscrowFeesAccruedOf = /*#__PURE__*/ createReadContract(
  { abi: snapflowEscrowAbi, functionName: 'feesAccruedOf' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"frozenBalanceOf"`
 */
export const readSnapflowEscrowFrozenBalanceOf =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'frozenBalanceOf',
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
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"hostBalanceOf"`
 */
export const readSnapflowEscrowHostBalanceOf = /*#__PURE__*/ createReadContract(
  { abi: snapflowEscrowAbi, functionName: 'hostBalanceOf' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"hostWithdrawalDigest"`
 */
export const readSnapflowEscrowHostWithdrawalDigest =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'hostWithdrawalDigest',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"hostWithdrawalNonceOf"`
 */
export const readSnapflowEscrowHostWithdrawalNonceOf =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'hostWithdrawalNonceOf',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"maxDepositOf"`
 */
export const readSnapflowEscrowMaxDepositOf = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'maxDepositOf',
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
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"payoutAddressDigest"`
 */
export const readSnapflowEscrowPayoutAddressDigest =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'payoutAddressDigest',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"payoutAddressOf"`
 */
export const readSnapflowEscrowPayoutAddressOf =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'payoutAddressOf',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"payoutNonceOf"`
 */
export const readSnapflowEscrowPayoutNonceOf = /*#__PURE__*/ createReadContract(
  { abi: snapflowEscrowAbi, functionName: 'payoutNonceOf' },
)

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
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"signerOf"`
 */
export const readSnapflowEscrowSignerOf = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'signerOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"signerThawPeriod"`
 */
export const readSnapflowEscrowSignerThawPeriod =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'signerThawPeriod',
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
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"totalHeld"`
 */
export const readSnapflowEscrowTotalHeld = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'totalHeld',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"unfrozenTime"`
 */
export const readSnapflowEscrowUnfrozenTime = /*#__PURE__*/ createReadContract({
  abi: snapflowEscrowAbi,
  functionName: 'unfrozenTime',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"voucherDigest"`
 */
export const readSnapflowEscrowVoucherDigest = /*#__PURE__*/ createReadContract(
  { abi: snapflowEscrowAbi, functionName: 'voucherDigest' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"withdrawalDelay"`
 */
export const readSnapflowEscrowWithdrawalDelay =
  /*#__PURE__*/ createReadContract({
    abi: snapflowEscrowAbi,
    functionName: 'withdrawalDelay',
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
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"authorizeSigner"`
 */
export const writeSnapflowEscrowAuthorizeSigner =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'authorizeSigner',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"autoTopUp"`
 */
export const writeSnapflowEscrowAutoTopUp = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'autoTopUp',
})

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
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"claimBatchAndWithdraw"`
 */
export const writeSnapflowEscrowClaimBatchAndWithdraw =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'claimBatchAndWithdraw',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"completeWithdrawal"`
 */
export const writeSnapflowEscrowCompleteWithdrawal =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'completeWithdrawal',
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
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"depositWithAuthorization"`
 */
export const writeSnapflowEscrowDepositWithAuthorization =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'depositWithAuthorization',
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
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"disableAutoTopUp"`
 */
export const writeSnapflowEscrowDisableAutoTopUp =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'disableAutoTopUp',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"freezeClaims"`
 */
export const writeSnapflowEscrowFreezeClaims =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'freezeClaims',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"grantRole"`
 */
export const writeSnapflowEscrowGrantRole = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'grantRole',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"lowerSignerLimit"`
 */
export const writeSnapflowEscrowLowerSignerLimit =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'lowerSignerLimit',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"pause"`
 */
export const writeSnapflowEscrowPause = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'pause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"raiseSignerLimit"`
 */
export const writeSnapflowEscrowRaiseSignerLimit =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'raiseSignerLimit',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"rearmClaimsFreeze"`
 */
export const writeSnapflowEscrowRearmClaimsFreeze =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'rearmClaimsFreeze',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"recoverSurplus"`
 */
export const writeSnapflowEscrowRecoverSurplus =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'recoverSurplus',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"releaseFrozen"`
 */
export const writeSnapflowEscrowReleaseFrozen =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'releaseFrozen',
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
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"revokeSigner"`
 */
export const writeSnapflowEscrowRevokeSigner =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'revokeSigner',
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
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"setAutoTopUp"`
 */
export const writeSnapflowEscrowSetAutoTopUp =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'setAutoTopUp',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"setDepositCaps"`
 */
export const writeSnapflowEscrowSetDepositCaps =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'setDepositCaps',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"setPayoutAddress"`
 */
export const writeSnapflowEscrowSetPayoutAddress =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'setPayoutAddress',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"setPayoutAddressWithSig"`
 */
export const writeSnapflowEscrowSetPayoutAddressWithSig =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'setPayoutAddressWithSig',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"sweepFees"`
 */
export const writeSnapflowEscrowSweepFees = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'sweepFees',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"thawSigner"`
 */
export const writeSnapflowEscrowThawSigner = /*#__PURE__*/ createWriteContract({
  abi: snapflowEscrowAbi,
  functionName: 'thawSigner',
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
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"withdrawHost"`
 */
export const writeSnapflowEscrowWithdrawHost =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'withdrawHost',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"withdrawHostWithSig"`
 */
export const writeSnapflowEscrowWithdrawHostWithSig =
  /*#__PURE__*/ createWriteContract({
    abi: snapflowEscrowAbi,
    functionName: 'withdrawHostWithSig',
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
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"authorizeSigner"`
 */
export const simulateSnapflowEscrowAuthorizeSigner =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'authorizeSigner',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"autoTopUp"`
 */
export const simulateSnapflowEscrowAutoTopUp =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'autoTopUp',
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
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"claimBatchAndWithdraw"`
 */
export const simulateSnapflowEscrowClaimBatchAndWithdraw =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'claimBatchAndWithdraw',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"completeWithdrawal"`
 */
export const simulateSnapflowEscrowCompleteWithdrawal =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'completeWithdrawal',
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
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"depositWithAuthorization"`
 */
export const simulateSnapflowEscrowDepositWithAuthorization =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'depositWithAuthorization',
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
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"disableAutoTopUp"`
 */
export const simulateSnapflowEscrowDisableAutoTopUp =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'disableAutoTopUp',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"freezeClaims"`
 */
export const simulateSnapflowEscrowFreezeClaims =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'freezeClaims',
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
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"lowerSignerLimit"`
 */
export const simulateSnapflowEscrowLowerSignerLimit =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'lowerSignerLimit',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"pause"`
 */
export const simulateSnapflowEscrowPause = /*#__PURE__*/ createSimulateContract(
  { abi: snapflowEscrowAbi, functionName: 'pause' },
)

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"raiseSignerLimit"`
 */
export const simulateSnapflowEscrowRaiseSignerLimit =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'raiseSignerLimit',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"rearmClaimsFreeze"`
 */
export const simulateSnapflowEscrowRearmClaimsFreeze =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'rearmClaimsFreeze',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"recoverSurplus"`
 */
export const simulateSnapflowEscrowRecoverSurplus =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'recoverSurplus',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"releaseFrozen"`
 */
export const simulateSnapflowEscrowReleaseFrozen =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'releaseFrozen',
  })

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
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"revokeSigner"`
 */
export const simulateSnapflowEscrowRevokeSigner =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'revokeSigner',
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
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"setAutoTopUp"`
 */
export const simulateSnapflowEscrowSetAutoTopUp =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'setAutoTopUp',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"setDepositCaps"`
 */
export const simulateSnapflowEscrowSetDepositCaps =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'setDepositCaps',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"setPayoutAddress"`
 */
export const simulateSnapflowEscrowSetPayoutAddress =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'setPayoutAddress',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"setPayoutAddressWithSig"`
 */
export const simulateSnapflowEscrowSetPayoutAddressWithSig =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'setPayoutAddressWithSig',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"sweepFees"`
 */
export const simulateSnapflowEscrowSweepFees =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'sweepFees',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"thawSigner"`
 */
export const simulateSnapflowEscrowThawSigner =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'thawSigner',
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
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"withdrawHost"`
 */
export const simulateSnapflowEscrowWithdrawHost =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'withdrawHost',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `functionName` set to `"withdrawHostWithSig"`
 */
export const simulateSnapflowEscrowWithdrawHostWithSig =
  /*#__PURE__*/ createSimulateContract({
    abi: snapflowEscrowAbi,
    functionName: 'withdrawHostWithSig',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__
 */
export const watchSnapflowEscrowEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: snapflowEscrowAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"AccountBlocked"`
 */
export const watchSnapflowEscrowAccountBlockedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'AccountBlocked',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"AccountUnblocked"`
 */
export const watchSnapflowEscrowAccountUnblockedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'AccountUnblocked',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"AutoTopUpDisabled"`
 */
export const watchSnapflowEscrowAutoTopUpDisabledEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'AutoTopUpDisabled',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"AutoTopUpExecuted"`
 */
export const watchSnapflowEscrowAutoTopUpExecutedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'AutoTopUpExecuted',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"AutoTopUpSet"`
 */
export const watchSnapflowEscrowAutoTopUpSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'AutoTopUpSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"ClaimResult"`
 */
export const watchSnapflowEscrowClaimResultEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'ClaimResult',
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
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"ClaimsFreezeRearmed"`
 */
export const watchSnapflowEscrowClaimsFreezeRearmedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'ClaimsFreezeRearmed',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"ClaimsFrozen"`
 */
export const watchSnapflowEscrowClaimsFrozenEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'ClaimsFrozen',
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
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"DepositCapsSet"`
 */
export const watchSnapflowEscrowDepositCapsSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'DepositCapsSet',
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
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"FeesSwept"`
 */
export const watchSnapflowEscrowFeesSweptEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'FeesSwept',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"Frozen"`
 */
export const watchSnapflowEscrowFrozenEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'Frozen',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"FrozenReleased"`
 */
export const watchSnapflowEscrowFrozenReleasedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'FrozenReleased',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"HostWithdrawn"`
 */
export const watchSnapflowEscrowHostWithdrawnEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'HostWithdrawn',
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
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"PayoutAddressSet"`
 */
export const watchSnapflowEscrowPayoutAddressSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'PayoutAddressSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"RelayFeePaid"`
 */
export const watchSnapflowEscrowRelayFeePaidEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'RelayFeePaid',
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
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"SignerAuthorized"`
 */
export const watchSnapflowEscrowSignerAuthorizedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'SignerAuthorized',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"SignerLimitLowerScheduled"`
 */
export const watchSnapflowEscrowSignerLimitLowerScheduledEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'SignerLimitLowerScheduled',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"SignerLimitRaised"`
 */
export const watchSnapflowEscrowSignerLimitRaisedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'SignerLimitRaised',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"SignerRevoked"`
 */
export const watchSnapflowEscrowSignerRevokedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'SignerRevoked',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"SignerThawed"`
 */
export const watchSnapflowEscrowSignerThawedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'SignerThawed',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link snapflowEscrowAbi}__ and `eventName` set to `"SurplusRecovered"`
 */
export const watchSnapflowEscrowSurplusRecoveredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: snapflowEscrowAbi,
    eventName: 'SurplusRecovered',
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
