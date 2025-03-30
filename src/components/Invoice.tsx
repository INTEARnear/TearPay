'use client';

import React, { useState, useEffect } from 'react';
import { StoredQuote } from '../types/quote';
import { createQuoteRequest, fetchQuote, fetchQuoteStatus } from '../services/quoteService';
import { saveQuote, getQuoteByInvoiceIdAndCurrency, isQuoteExpired } from '../services/quoteStorage';
import { savePaymentStatus, isPaymentSuccessful } from '../services/paymentStatus';

const USDC_ACCOUNT_ID = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';

interface Token {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price: number;
  priceUpdatedAt: string;
  contractAddress: string;
}

export interface InvoiceProps {
  amountUsd: number;
  invoiceId: string;
  recipientAddress: string;
  redirectTo?: string;
  showRecipient?: boolean;
}

const Invoice: React.FC<InvoiceProps> = ({ amountUsd, invoiceId, recipientAddress, redirectTo, showRecipient = true }) => {
  const [selectedToken, setSelectedToken] = useState<Token | undefined>();
  const [quote, setQuote] = useState<StoredQuote | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [quoteExpired, setQuoteExpired] = useState(false);
  const [quoteStatus, setQuoteStatus] = useState<string | undefined>();
  const [isPaid, setIsPaid] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  useEffect(() => {
    // Check if payment was already successful
    setIsPaid(isPaymentSuccessful(invoiceId));
  }, [invoiceId]);

  const handleTokenSelect = async (token: Token) => {
    setSelectedToken(token);
    setIsLoading(true);
    setError(undefined);
    setQuoteExpired(false);
    setQuoteStatus(undefined);

    try {
      // Check for cached quote
      const cachedQuote = getQuoteByInvoiceIdAndCurrency(invoiceId, token.assetId, recipientAddress);
      if (cachedQuote && !isQuoteExpired(cachedQuote)) {
        setQuote(cachedQuote);
        setIsLoading(false);
        return;
      }

      const quoteRequest = createQuoteRequest(
        token.assetId,
        `nep141:${USDC_ACCOUNT_ID}`,
        Math.floor(amountUsd * 10e6).toString(),
        recipientAddress,
      );

      const quoteResponse = await fetchQuote(quoteRequest);
      const storedQuote: StoredQuote = {
        ...quoteResponse,
        invoiceId,
        createdAt: new Date().toISOString(),
      };

      saveQuote(storedQuote, token.assetId);
      setQuote(storedQuote);
    } catch (error) {
      console.error('Error generating quote:', error);
      setError('This token is not supported for payments at this time.');
      setSelectedToken(undefined);
      setQuote(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedToken(undefined);
    setQuote(undefined);
    setIsLoading(false);
    setError(undefined);
    setQuoteExpired(false);
    setQuoteStatus(undefined);
  };

  const handleRefreshQuote = async () => {
    if (selectedToken) {
      await handleTokenSelect(selectedToken);
    }
  };

  const handleCopyAddress = () => {
    if (quote?.quote.depositAddress) {
      navigator.clipboard.writeText(quote.quote.depositAddress);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  // Check quote expiration and status periodically
  useEffect(() => {
    if (quote) {
      const checkExpiration = () => {
        if (isQuoteExpired(quote)) {
          setQuoteExpired(true);
        }
      };

      const checkStatus = async () => {
        try {
          const status = await fetchQuoteStatus(quote.quote.depositAddress);
          setQuoteStatus(status.status);
          
          // If payment is successful, save it and update UI
          if (status.status === 'SUCCESS' && !isPaid) {
            savePaymentStatus(invoiceId, 'SUCCESS');
            setIsPaid(true);
          }
        } catch (error) {
          console.error('Error fetching quote status:', error);
        }
      };

      checkExpiration();
      checkStatus();
      const expirationInterval = setInterval(checkExpiration, 1000); // Check every second
      const statusInterval = setInterval(checkStatus, 5000); // Check every 5 seconds
      return () => {
        clearInterval(expirationInterval);
        clearInterval(statusInterval);
      };
    }
  }, [quote, invoiceId, isPaid]);

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'SUCCESS':
        return 'text-green-400';
      case 'PROCESSING':
        return 'text-blue-400';
      case 'FAILED':
        return 'text-red-400';
      case 'REFUNDED':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = (status: string | undefined) => {
    switch (status) {
      case 'SUCCESS':
        return 'Payment Successful';
      case 'PROCESSING':
        return 'Processing Payment';
      case 'FAILED':
        return 'Payment Failed';
      case 'REFUNDED':
        return 'Something went wrong. Please reach out to https://t.me/slimytentacles for a refund, and include the Deposit Address above';
      case 'KNOWN_DEPOSIT_TX':
        return 'Deposit Transaction Detected';
      case 'PENDING_DEPOSIT':
        return 'Waiting for Deposit';
      case 'INCOMPLETE_DEPOSIT':
        return 'Incomplete Deposit. Please deposit the remaining amount';
      default:
        return 'Unknown Status';
    }
  };

  return (
    <div className="max-w-7xl mx-auto bg-gray-900 rounded-xl shadow-lg overflow-hidden">
      <div className="flex">
        {/* Left side - Currency selector or deposit info */}
        <div className="w-2/3 relative">
          {isPaid ? (
            <div className="p-12 text-center">
              <div className="mb-6">
                <svg className="mx-auto h-16 w-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">Payment Successful!</h3>
              <p className="text-gray-300 mb-8">Thank you for your payment. The transaction has been completed successfully.</p>
              {redirectTo && (
                <a
                  href={redirectTo}
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Return to Site
                </a>
              )}
            </div>
          ) : selectedToken ? (
            <div className="p-12">
              <button
                onClick={handleBack}
                className="absolute top-6 left-6 p-2 text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="space-y-6 mt-8">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">Payment Information</h3>
                  <div className="bg-gray-800 p-4 rounded-lg">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                      </div>
                    ) : quoteExpired ? (
                      <div className="text-center py-8">
                        <p className="text-yellow-200 mb-4">This quote has expired. Please get a new quote to continue.</p>
                        <button
                          onClick={handleRefreshQuote}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Get New Quote
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400">Deposit Address</label>
                          <div 
                            className="mt-1 text-white font-mono break-all cursor-pointer hover:bg-gray-700 p-2 rounded transition-colors flex items-center justify-between relative"
                            onClick={handleCopyAddress}
                          >
                            <span>{quote?.quote.depositAddress}</span>
                            <div className="flex items-center gap-2">
                              {showCopied && (
                                <span className="text-sm text-green-400 animate-fade-in-out">Copied!</span>
                              )}
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        {selectedToken.contractAddress && (
                          <div>
                            <label className="block text-sm font-medium text-gray-400">Token Contract Address</label>
                            <div className="mt-1 flex items-center gap-2">
                              {selectedToken && <BlockchainIcon blockchain={selectedToken.blockchain} className="!w-4 !h-4" />}
                              <div className="text-white font-mono">
                                {selectedToken.contractAddress.slice(0, 10)}...{selectedToken.contractAddress.slice(-8)}
                              </div>
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium text-gray-400">Amount to Send</label>
                          <div className="mt-1 text-white font-mono">{quote?.quote.amountInFormatted} {selectedToken.symbol}</div>
                        </div>
                        <div className="text-sm text-gray-400">
                          Please pay before {new Date(quote?.quote.deadline || '').toLocaleString()}
                        </div>
                        {quoteStatus && (
                          <div className={`mt-4 flex items-center gap-2 ${getStatusColor(quoteStatus)}`}>
                            <div className="relative">
                              <div className="absolute -inset-1 rounded-full bg-current opacity-20 animate-ping"></div>
                              <div className="relative h-2 w-2 rounded-full bg-current"></div>
                            </div>
                            <span className="text-sm font-medium">{getStatusText(quoteStatus)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              {error && (
                <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg">
                  <p className="text-red-200">{error}</p>
                </div>
              )}
              <CurrencySelector
                onSelect={handleTokenSelect}
                selectedToken={selectedToken}
              />
            </div>
          )}
        </div>

        {/* Right side - Amount */}
        <div className="w-1/3 p-12 flex flex-col items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="text-gray-400 mb-3 text-lg">Amount</div>
            <div className="text-6xl font-bold text-white">${amountUsd.toFixed(2)}</div>
          </div>
          {showRecipient && (
            <div className="mt-8 text-center">
              <div 
                className="text-white font-mono text-sm select-none cursor-not-allowed relative group"
              >
                {recipientAddress}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 max-w-[300px] z-50">
                  <div className="relative">
                    Don&apos;t pay to this address directly, use the form on the left
                  </div>
                </div>
              </div>
              <div className="text-gray-400 mt-2 text-sm">has created this invoice in TearPay. This user is not endorsed or affiliated with Intear, make sure you trust them before paying. Don&apos;t send tokens directly to this address, use the form on the left.</div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

import arbIcon from '../../public/blockchain-icons/arb.webp';
import baseIcon from '../../public/blockchain-icons/base.webp';
import beraIcon from '../../public/blockchain-icons/bera.webp';
import bscIcon from '../../public/blockchain-icons/bsc.webp';
import btcIcon from '../../public/blockchain-icons/btc.webp';
import dogeIcon from '../../public/blockchain-icons/doge.webp';
import ethIcon from '../../public/blockchain-icons/eth.webp';
import gnosisIcon from '../../public/blockchain-icons/gnosis.webp';
import nearIcon from '../../public/blockchain-icons/near.webp';
import polIcon from '../../public/blockchain-icons/pol.webp';
import solIcon from '../../public/blockchain-icons/sol.webp';
import xrpIcon from '../../public/blockchain-icons/xrp.webp';
import zecIcon from '../../public/blockchain-icons/zec.webp';

const BLOCKCHAIN_ICONS = {
  arb: arbIcon.src,
  base: baseIcon.src,
  bera: beraIcon.src,
  bsc: bscIcon.src,
  btc: btcIcon.src,
  doge: dogeIcon.src,
  eth: ethIcon.src,
  gnosis: gnosisIcon.src,
  near: nearIcon.src,
  pol: polIcon.src,
  sol: solIcon.src,
  xrp: xrpIcon.src,
  zec: zecIcon.src,
} as const;

export type SupportedBlockchain = keyof typeof BLOCKCHAIN_ICONS;

interface BlockchainIconProps {
  blockchain: string;
  className?: string;
}

const BlockchainIcon: React.FC<BlockchainIconProps> = ({ blockchain, className = '' }) => {
  const chain = blockchain.toLowerCase() as SupportedBlockchain;
  const icon = BLOCKCHAIN_ICONS[chain];
  
  if (!icon) {
    return null;
  }

  return (
    <img 
      src={icon}
      alt={blockchain}
      width={32}
      height={32}
      className={className}
    />
  );
};

const getNearMetadata = async (contractId: string) => {
  const response = await fetch('https://rpc.mainnet.near.org', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'dontcare',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: contractId,
        method_name: 'ft_metadata',
        args_base64: btoa(JSON.stringify({}))
      },
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return JSON.parse(Buffer.from(data.result.result, 'base64').toString());
};

interface TokenWithIcon extends Token {
  iconUrl?: string;
}

interface CurrencySelectorProps {
  onSelect: (token: Token) => void;
  selectedToken?: Token;
}

const getTokenIcon = (symbol: string): string | undefined => {
  const chain = symbol.toLowerCase() as keyof typeof BLOCKCHAIN_ICONS;
  return BLOCKCHAIN_ICONS[chain];
};

const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  onSelect,
  selectedToken,
}) => {
  const [tokens, setTokens] = useState<TokenWithIcon[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const response = await fetch('https://1click.chaindefuser.com/v0/tokens');
        const data: Token[] = await response.json();
        
        // Initialize tokens with icons
        setTokens(data.map(token => ({ 
          ...token, 
          iconUrl: getTokenIcon(token.symbol)
        })));
        setIsLoading(false);

        // Additionally fetch NEAR token metadata for any missing icons
        data.forEach(async (token) => {
          if (!getTokenIcon(token.symbol) && token.blockchain === 'near' && token.assetId.startsWith('nep141:')) {
            try {
              const contractId = token.assetId.replace('nep141:', '');
              const metadata = await getNearMetadata(contractId);

              if (metadata.icon) {
                setTokens(currentTokens => 
                  currentTokens.map(t => 
                    t.assetId === token.assetId 
                      ? { ...t, iconUrl: metadata.icon } 
                      : t
                  )
                );
              }
            } catch (error) {
              console.error(`Error fetching icon for ${token.assetId}:`, error);
            }
          }
        });
      } catch (error) {
        console.error('Error fetching tokens:', error);
        setIsLoading(false);
      }
    };

    fetchTokens();
  }, []);

  const filteredTokens = tokens.filter(token =>
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.blockchain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full bg-gray-900 p-6 rounded-xl">
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Search by token or blockchain..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-6 py-4 text-lg bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 placeholder-gray-400"
        />
      </div>
      
      {isLoading ? (
        <div className="text-center text-gray-400 text-xl">Loading currencies...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2">
          {filteredTokens.map((token) => (
            <button
              key={token.assetId}
              onClick={() => onSelect(token)}
              className={`group aspect-square p-6 rounded-xl flex flex-col items-center justify-center transition-all relative overflow-hidden
                ${selectedToken?.assetId === token.assetId 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-100'}`}
            >
              {token.iconUrl && (
                <div 
                  className="absolute inset-0 opacity-10 bg-no-repeat bg-center bg-contain filter blur-[6px] group-hover:blur-[2px] transition-all duration-300 group-hover:scale-110"
                  style={{ backgroundImage: `url(${token.iconUrl})` }}
                />
              )}
              <div className="relative z-10">
                <span className="font-medium text-2xl mb-2 block">{token.symbol}</span>
                <div className="flex items-center justify-center">
                  <BlockchainIcon 
                    blockchain={token.blockchain} 
                    className={`${selectedToken?.assetId === token.assetId ? 'text-white' : 'text-gray-400'}`}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Invoice;
