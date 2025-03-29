'use client';

import { StoredQuote } from '../types/quote';

const STORAGE_KEY = 'tearpay_quotes';

const getQuoteKey = (invoiceId: string, currency: string, recipient: string): string => {
  return `${invoiceId},${currency},${recipient}`;
};

export const saveQuote = (quote: StoredQuote, currency: string): void => {
  if (typeof window === 'undefined') return;
  
  const existingQuotes = getQuotes();
  const key = getQuoteKey(quote.invoiceId, currency, quote.quoteRequest.recipient);
  const filteredQuotes = existingQuotes.filter(q => 
    getQuoteKey(q.invoiceId, q.quoteRequest.originAsset, q.quoteRequest.recipient) !== key
  );
  
  filteredQuotes.push(quote);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredQuotes));
};

export const getQuotes = (): StoredQuote[] => {
  if (typeof window === 'undefined') return [];
  
  const storedQuotes = localStorage.getItem(STORAGE_KEY);
  if (!storedQuotes) return [];
  
  try {
    return JSON.parse(storedQuotes);
  } catch (error) {
    console.error('Error parsing stored quotes:', error);
    return [];
  }
};

export const getQuoteByInvoiceIdAndCurrency = (invoiceId: string, currency: string, recipient: string): StoredQuote | undefined => {
  const key = getQuoteKey(invoiceId, currency, recipient);
  return getQuotes().find(quote => 
    getQuoteKey(quote.invoiceId, quote.quoteRequest.originAsset, quote.quoteRequest.recipient) === key
  );
};

export const isQuoteExpired = (quote: StoredQuote): boolean => {
  const deadline = new Date(quote.quote.deadline);
  return deadline < new Date();
};

export const deleteQuote = (invoiceId: string, currency: string, recipient: string): void => {
  if (typeof window === 'undefined') return;
  
  const existingQuotes = getQuotes();
  const key = getQuoteKey(invoiceId, currency, recipient);
  const filteredQuotes = existingQuotes.filter(quote => 
    getQuoteKey(quote.invoiceId, quote.quoteRequest.originAsset, quote.quoteRequest.recipient) !== key
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredQuotes));
};

export const clearQuotes = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}; 