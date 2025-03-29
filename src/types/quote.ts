export interface QuoteRequest {
  dry: boolean;
  swapType: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  slippageTolerance: number;
  originAsset: string;
  depositType: 'ORIGIN_CHAIN' | 'INTENTS';
  destinationAsset: string;
  amount: string;
  refundTo: string;
  refundType: 'ORIGIN_CHAIN' | 'INTENTS';
  recipient: string;
  recipientType: 'DESTINATION_CHAIN' | 'INTENTS';
  deadline: string;
  referral: string;
  quoteWaitingTimeMs?: number;
}

export interface Quote {
  depositAddress: string;
  amountIn: string;
  amountInFormatted: string;
  amountInUsd: string;
  minAmountIn: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: string;
  minAmountOut: string;
  deadline: string;
  timeWhenInactive: string;
  timeEstimate: number;
}

export interface QuoteResponse {
  timestamp: string;
  signature: string;
  quoteRequest: QuoteRequest;
  quote: Quote;
}

export interface StoredQuote extends QuoteResponse {
  invoiceId: string;
  createdAt: string;
}

export interface TransactionDetails {
  hash: string;
  explorerUrl: string;
}

export interface SwapDetails {
  intentHashes: string[];
  nearTxHashes: string[];
  amountIn: string;
  amountInFormatted: string;
  amountInUsd: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: string;
  slippage: number;
  originChainTxHashes: TransactionDetails[];
  destinationChainTxHashes: TransactionDetails[];
  refundedAmount: string;
  refundedAmountFormatted: string;
  refundedAmountUsd: string;
}

export interface GetExecutionStatusResponse {
  quoteResponse: QuoteResponse;
  status: 'KNOWN_DEPOSIT_TX' | 'PENDING_DEPOSIT' | 'INCOMPLETE_DEPOSIT' | 'PROCESSING' | 'SUCCESS' | 'REFUNDED' | 'FAILED';
  updatedAt: string;
  swapDetails: SwapDetails;
} 