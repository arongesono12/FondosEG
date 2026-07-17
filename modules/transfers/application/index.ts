/**
 * Public application API for the transfers domain.
 *
 * HTTP routes depend on this boundary instead of importing database adapters
 * directly. The legacy implementation is re-exported during the incremental
 * migration and can be replaced without changing route handlers.
 */
export {
  cancelWalletTransferOperation,
  confirmWalletTransferOperation,
  correctAgentTransferOperation,
  createAgentTransferOperation,
  createWalletTransferDirectOperation,
  createWalletTransferHold,
  markAgentTransferPaidOut,
  resetAgentBalanceOperation,
  topUpAgentBalanceOperation,
} from '@/lib/server/financial-operations';

