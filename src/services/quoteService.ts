'use client';

import { QuoteRequest, QuoteResponse, GetExecutionStatusResponse } from '../types/quote';

const API_BASE_URL = 'https://1click.chaindefuser.com/v0';

export const fetchQuote = async (request: QuoteRequest): Promise<QuoteResponse> => {
  const response = await fetch(`${API_BASE_URL}/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch quote');
  }

  return response.json();
};

export const fetchQuoteStatus = async (depositAddress: string): Promise<GetExecutionStatusResponse> => {
  const response = await fetch(`${API_BASE_URL}/status?depositAddress=${encodeURIComponent(depositAddress)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch quote status');
  }

  return response.json();
};

export const createQuoteRequest = (
  originAsset: string,
  destinationAsset: string,
  amount: string,
  recipient: string,
): QuoteRequest => {
  // Set deadline to 10 minutes from now
  const deadline = new Date();
  deadline.setTime(deadline.getTime() + 10 * 60 * 1000);

  return {
    dry: false,
    swapType: 'EXACT_OUTPUT',
    slippageTolerance: 100, // 1%
    originAsset,
    depositType: 'ORIGIN_CHAIN',
    destinationAsset,
    amount,
    refundTo: 'refunds.intear.near',
    refundType: 'INTENTS',
    recipient,
    recipientType: 'INTENTS',
    deadline: deadline.toISOString(),
    referral: 'tearpay.intear.near',
  };
}; 