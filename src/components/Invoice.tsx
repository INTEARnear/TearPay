'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

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
  onSuccess?: () => void;
  onCancel?: () => void;
}

const Invoice: React.FC<InvoiceProps> = ({ amountUsd, invoiceId, recipientAddress, redirectTo, showRecipient = true, onSuccess, onCancel }) => {
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

  async function handleTokenSelect(token: Token) {
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
        Math.floor(amountUsd * 1e6).toString(),
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
  }

  function handleBack() {
    setSelectedToken(undefined);
    setQuote(undefined);
    setIsLoading(false);
    setError(undefined);
    setQuoteExpired(false);
    setQuoteStatus(undefined);
  }

  async function handleRefreshQuote() {
    if (selectedToken) {
      await handleTokenSelect(selectedToken);
    }
  }

  function handleCopyAddress() {
    if (quote?.quote.depositAddress) {
      navigator.clipboard.writeText(quote.quote.depositAddress);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  }

  // Check quote expiration and status periodically
  useEffect(() => {
    if (quote) {
      const checkExpiration = () => {
        if (!quote) return;
        if (isQuoteExpired(quote)) {
          setQuoteExpired(true);
        }
      }

      const checkStatus = async () => {
        try {
          if (!quote) return;
          const status = await fetchQuoteStatus(quote.quote.depositAddress);
          setQuoteStatus(status.status);

          // If payment is successful, save it and update UI
          if (status.status === 'SUCCESS' && !isPaid) {
            savePaymentStatus(invoiceId, 'SUCCESS');
            setIsPaid(true);
            onSuccess?.();
          }
        } catch (error) {
          console.error('Error fetching quote status:', error);
        }
      }

      checkExpiration();
      checkStatus();
      const expirationInterval = setInterval(checkExpiration, 1000); // Check every second
      const statusInterval = setInterval(checkStatus, 5000); // Check every 5 seconds
      return () => {
        clearInterval(expirationInterval);
        clearInterval(statusInterval);
      };
    }
  }, [quote, invoiceId, isPaid, onSuccess]);

  function getStatusColor(status: string | undefined) {
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
  }

  function getStatusText(status: string | undefined) {
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
  }

  return (
    <div className="max-w-7xl mx-auto bg-gray-900 rounded-xl shadow-lg overflow-hidden">
      <div className="flex flex-col md:flex-row">
        {/* Amount section - now on top for mobile */}
        <div className="w-full md:w-1/3 p-6 md:p-12 flex flex-col items-center justify-center bg-gray-800 relative order-first md:order-last">
          {onCancel && (
            <button
              onClick={onCancel}
              className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
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
                    Don&apos;t pay to this address directly, use the form below
                  </div>
                </div>
              </div>
              <div className="text-gray-400 mt-2 text-sm">has created this invoice in TearPay. This user is not endorsed or affiliated with Intear, make sure you trust them before paying. Don&apos;t send tokens directly to this address, use the form below.</div>
            </div>
          )}
        </div>

        {/* Currency selector or deposit info - now on bottom for mobile */}
        <div className="w-full md:w-2/3 relative">
          {isPaid ? (
            <div className="p-6 md:p-12 text-center">
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
            <div className="p-6 md:p-12">
              <button
                onClick={handleBack}
                className="absolute top-6 left-6 p-2 text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="space-y-6 mt-12 md:mt-8">
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
                            className="mt-1 flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
                            onClick={handleCopyAddress}
                          >
                            <div className="flex-1 break-all mr-4">
                              <span className="text-white font-mono">{quote?.quote.depositAddress}</span>
                            </div>
                            <button className="flex-shrink-0 text-gray-400 hover:text-white transition-colors">
                              {showCopied ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                              )}
                            </button>
                          </div>
                          {quote?.quote.depositAddress && (
                            <div className="mt-4 flex justify-center">
                              <div className="p-4 bg-white rounded-lg">
                                <QRCodeSVG
                                  value={quote.quote.depositAddress}
                                  size={200}
                                  level="H"
                                  includeMargin={true}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        {selectedToken.contractAddress && (
                          <div>
                            <label className="block text-sm font-medium text-gray-400">Token Contract Address</label>
                            <div className="mt-1 flex items-center gap-2">
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
      </div>
    </div>
  );
};

const BLOCKCHAIN_ICONS = {
  arb: 'data:image/webp;base64,UklGRmwDAABXRUJQVlA4IGADAABwEACdASpAAEAAPtFepk2oJSOiKhZroQAaCWQAuRgJV3fiK1LFi+Y4jzRzQd2eykOBWlompeZTeEqLnlgqofAXjeN+H2oaFl7uwDUi6bM3MUyprLzEFlE2ojJXq1vfs5uh30kPwwVBe8apExDHE/Xizq12MOwU+gkT+9N3WpIwT+kmQ1iBOGm3cCZAAAD+/m6TMD4k7z6l7cBtTZmfFgyZxIn+Y4bG6qLuSsAvYhthmU4tAukHFqO/mBc9nZgzUQ317ff4nIo1s/BuyDMCGpMFGVo3Ctv7aAvUI+ppGS+Dl7K8dtOgTjBaqwQnw3ewnICDeszh393ZHygiuNr0HB7peHS05nbqSLUcUQs3dmaoCBEk0+vlfgGN/lADoAo/0cwcofhQkevJd97C5bwQJ7Pl3wCPtEdqVUbfTehku2TimykbxYA+H8di9lOpRMywdXOIHt2GjhmZ94O4YmD90yeBl8DDgLBRS5b5SndYKckpf9yeC68QIAw33adrJq75EscWguPCG1mjnhddZ+0eIMvBhbYPhXgGBHxuFE9X9Yrm93BOhX9v+02SI7sL09hCW+tS1cGx5sm7KDZdDpjOE3FkDNzSyOSWDQyReIpQZS6DoqpPRm62SJMxvEtN7FM1casbeVlEuadtcXYZJyCa0V5sfazT8KZZ8rXWLzz6QVvwa3JZpL1BFbgqJWn43+j/5t3PO6/qwxuuX2TT8QSWdH668+8VwvX/hcyGmdhV/XGPbwOKO8eh7GsEuouHLlAnGH/KUXGRmA6HMW5c3NDfqTX4zjEvdyw/fE27QF8PygaTbb9GNLQSxCIVYEuo1vsq85wpvUZzjBjbiGXh6GTVn8jvTDlzYgWDxsWiB8MN/GQrSfSHJei0+cHltMr/p3V3LcYzt9n4OrZ7nkQvwh8Bw1IXSjT1+x+Az/lFRPwfT5cGnc8tRPGvdm5YTeNDfJsiy92mxOWcjc8xXVi4TnEyWCYmrLY0F7Hs8TaixTKDvs5pVNOsx+/HNoePTDxzbPwy7wTnsjnNjhvyjtiiwjoFuvAkndirLQQTp3ewEAEnrvkVkI+0UnoRQ9cdvuMNZtAemhjO/h5yj1Bn6kK04aizTPjcqLSoe/3S3zhDtX1RNmqmWZkQMDDpB43n58v3/Cp7gAA=',
  base: 'data:image/webp;base64,UklGRkoxAABXRUJQVlA4WAoAAAAwAAAAPwAAPwAASUNDUHgjAAAAACN4bGNtcwIQAABtbnRyUkdCIFhZWiAH3wALAAoADAASADhhY3NwKm5peAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWxjbXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtkZXNjAAABCAAAALBjcHJ0AAABuAAAARJ3dHB0AAACzAAAABRjaGFkAAAC4AAAACxyWFlaAAADDAAAABRiWFlaAAADIAAAABRnWFlaAAADNAAAABRyVFJDAAADSAAAIAxnVFJDAAADSAAAIAxiVFJDAAADSAAAIAxjaHJtAAAjVAAAACRkZXNjAAAAAAAAABxzUkdCLWVsbGUtVjItc3JnYnRyYy5pY2MAAAAAAAAAAAAAAB0AcwBSAEcAQgAtAGUAbABsAGUALQBWADIALQBzAHIAZwBiAHQAcgBjAC4AaQBjAGMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHRleHQAAAAAQ29weXJpZ2h0IDIwMTUsIEVsbGUgU3RvbmUgKHdlYnNpdGU6IGh0dHA6Ly9uaW5lZGVncmVlc2JlbG93LmNvbS87IGVtYWlsOiBlbGxlc3RvbmVAbmluZWRlZ3JlZXNiZWxvdy5jb20pLiBUaGlzIElDQyBwcm9maWxlIGlzIGxpY2Vuc2VkIHVuZGVyIGEgQ3JlYXRpdmUgQ29tbW9ucyBBdHRyaWJ1dGlvbi1TaGFyZUFsaWtlIDMuMCBVbnBvcnRlZCBMaWNlbnNlIChodHRwczovL2NyZWF0aXZlY29tbW9ucy5vcmcvbGljZW5zZXMvYnktc2EvMy4wL2xlZ2FsY29kZSkuAAAAAFhZWiAAAAAAAAD21gABAAAAANMtc2YzMgAAAAAAAQxCAAAF3v//8yUAAAeTAAD9kP//+6H///2iAAAD3AAAwG5YWVogAAAAAAAAb6AAADj1AAADkFhZWiAAAAAAAAAknwAAD4QAALbEWFlaIAAAAAAAAGKXAAC3hwAAGNljdXJ2AAAAAAAAEAAAAAABAAIABAAFAAYABwAJAAoACwAMAA4ADwAQABEAEwAUABUAFgAYABkAGgAbABwAHgAfACAAIQAjACQAJQAmACgAKQAqACsALQAuAC8AMAAyADMANAA1ADcAOAA5ADoAOwA9AD4APwBAAEIAQwBEAEUARwBIAEkASgBMAE0ATgBPAFEAUgBTAFQAVQBXAFgAWQBaAFwAXQBeAF8AYQBiAGMAZABmAGcAaABpAGsAbABtAG4AbwBxAHIAcwB0AHYAdwB4AHkAewB8AH0AfgCAAIEAggCDAIUAhgCHAIgAiQCLAIwAjQCOAJAAkQCSAJMAlQCWAJcAmACaAJsAnACdAJ8AoAChAKIApAClAKYApwCoAKoAqwCsAK0ArwCwALEAsgC0ALUAtgC3ALkAugC7ALwAvgC/AMAAwQDCAMQAxQDGAMcAyQDKAMsAzADOAM8A0ADRANMA1ADVANcA2ADZANoA3ADdAN4A4ADhAOIA5ADlAOYA6ADpAOoA7ADtAO8A8ADxAPMA9AD2APcA+AD6APsA/QD+AP8BAQECAQQBBQEHAQgBCgELAQ0BDgEPAREBEgEUARUBFwEYARoBGwEdAR8BIAEiASMBJQEmASgBKQErAS0BLgEwATEBMwE0ATYBOAE5ATsBPAE+AUABQQFDAUUBRgFIAUoBSwFNAU8BUAFSAVQBVQFXAVkBWgFcAV4BYAFhAWMBZQFnAWgBagFsAW4BbwFxAXMBdQF2AXgBegF8AX4BfwGBAYMBhQGHAYkBigGMAY4BkAGSAZQBlgGXAZkBmwGdAZ8BoQGjAaUBpwGpAasBrAGuAbABsgG0AbYBuAG6AbwBvgHAAcIBxAHGAcgBygHMAc4B0AHSAdQB1gHYAdoB3AHeAeEB4wHlAecB6QHrAe0B7wHxAfMB9QH4AfoB/AH+AgACAgIEAgcCCQILAg0CDwISAhQCFgIYAhoCHQIfAiECIwIlAigCKgIsAi4CMQIzAjUCOAI6AjwCPgJBAkMCRQJIAkoCTAJPAlECUwJWAlgCWgJdAl8CYQJkAmYCaQJrAm0CcAJyAnUCdwJ5AnwCfgKBAoMChgKIAosCjQKQApIClQKXApoCnAKfAqECpAKmAqkCqwKuArACswK1ArgCuwK9AsACwgLFAsgCygLNAs8C0gLVAtcC2gLdAt8C4gLkAucC6gLsAu8C8gL1AvcC+gL9Av8DAgMFAwgDCgMNAxADEwMVAxgDGwMeAyADIwMmAykDLAMuAzEDNAM3AzoDPQM/A0IDRQNIA0sDTgNRA1QDVgNZA1wDXwNiA2UDaANrA24DcQN0A3cDegN9A4ADggOFA4gDiwOOA5EDlAOYA5sDngOhA6QDpwOqA60DsAOzA7YDuQO8A78DwgPFA8kDzAPPA9ID1QPYA9sD3wPiA+UD6APrA+4D8gP1A/gD+wP+BAIEBQQIBAsEDwQSBBUEGAQcBB8EIgQlBCkELAQvBDMENgQ5BD0EQARDBEcESgRNBFEEVARXBFsEXgRiBGUEaARsBG8EcwR2BHkEfQSABIQEhwSLBI4EkgSVBJkEnASgBKMEpwSqBK4EsQS1BLgEvAS/BMMExgTKBM4E0QTVBNgE3ATgBOME5wTqBO4E8gT1BPkE/QUABQQFCAULBQ8FEwUWBRoFHgUiBSUFKQUtBTEFNAU4BTwFQAVDBUcFSwVPBVIFVgVaBV4FYgVmBWkFbQVxBXUFeQV9BYEFhAWIBYwFkAWUBZgFnAWgBaQFqAWsBa8FswW3BbsFvwXDBccFywXPBdMF1wXbBd8F4wXnBesF7wX0BfgF/AYABgQGCAYMBhAGFAYYBhwGIQYlBikGLQYxBjUGOQY+BkIGRgZKBk4GUwZXBlsGXwZjBmgGbAZwBnQGeQZ9BoEGhQaKBo4GkgaXBpsGnwakBqgGrAaxBrUGuQa+BsIGxgbLBs8G1AbYBtwG4QblBuoG7gbyBvcG+wcABwQHCQcNBxIHFgcbBx8HJAcoBy0HMQc2BzoHPwdDB0gHTQdRB1YHWgdfB2MHaAdtB3EHdgd7B38HhAeJB40HkgeXB5sHoAelB6kHrgezB7cHvAfBB8YHygfPB9QH2QfdB+IH5wfsB/EH9Qf6B/8IBAgJCA0IEggXCBwIIQgmCCsILwg0CDkIPghDCEgITQhSCFcIXAhhCGYIawhwCHUIegh/CIQIiQiOCJMImAidCKIIpwisCLEItgi7CMAIxQjKCM8I1AjZCN8I5AjpCO4I8wj4CP0JAwkICQ0JEgkXCR0JIgknCSwJMQk3CTwJQQlGCUwJUQlWCVsJYQlmCWsJcQl2CXsJgQmGCYsJkQmWCZsJoQmmCasJsQm2CbwJwQnGCcwJ0QnXCdwJ4gnnCe0J8gn4Cf0KAgoICg0KEwoZCh4KJAopCi8KNAo6Cj8KRQpKClAKVgpbCmEKZgpsCnIKdwp9CoMKiAqOCpQKmQqfCqUKqgqwCrYKvArBCscKzQrTCtgK3grkCuoK7wr1CvsLAQsHCwwLEgsYCx4LJAsqCy8LNQs7C0ELRwtNC1MLWQtfC2QLagtwC3YLfAuCC4gLjguUC5oLoAumC6wLsgu4C74LxAvKC9AL1gvcC+IL6QvvC/UL+wwBDAcMDQwTDBkMIAwmDCwMMgw4DD4MRQxLDFEMVwxdDGQMagxwDHYMfQyDDIkMjwyWDJwMogyoDK8MtQy7DMIMyAzODNUM2wzhDOgM7gz1DPsNAQ0IDQ4NFQ0bDSENKA0uDTUNOw1CDUgNTw1VDVwNYg1pDW8Ndg18DYMNiQ2QDZYNnQ2kDaoNsQ23Db4NxQ3LDdIN2Q3fDeYN7A3zDfoOAQ4HDg4OFQ4bDiIOKQ4vDjYOPQ5EDkoOUQ5YDl8OZg5sDnMOeg6BDogOjg6VDpwOow6qDrEOuA6+DsUOzA7TDtoO4Q7oDu8O9g79DwQPCw8SDxkPIA8nDy4PNQ88D0MPSg9RD1gPXw9mD20PdA97D4IPiQ+QD5gPnw+mD60PtA+7D8IPyg/RD9gP3w/mD+0P9Q/8EAMQChASEBkQIBAnEC8QNhA9EEQQTBBTEFoQYhBpEHAQeBB/EIYQjhCVEJ0QpBCrELMQuhDCEMkQ0BDYEN8Q5xDuEPYQ/REFEQwRFBEbESMRKhEyETkRQRFIEVARVxFfEWcRbhF2EX0RhRGNEZQRnBGkEasRsxG7EcIRyhHSEdkR4RHpEfAR+BIAEggSDxIXEh8SJxIuEjYSPhJGEk4SVRJdEmUSbRJ1En0ShBKMEpQSnBKkEqwStBK8EsQSzBLUEtsS4xLrEvMS+xMDEwsTExMbEyMTKxMzEzsTRBNME1QTXBNkE2wTdBN8E4QTjBOUE50TpROtE7UTvRPFE80T1hPeE+YT7hP2E/8UBxQPFBcUIBQoFDAUOBRBFEkUURRaFGIUahRzFHsUgxSMFJQUnBSlFK0UthS+FMYUzxTXFOAU6BTxFPkVARUKFRIVGxUjFSwVNBU9FUUVThVXFV8VaBVwFXkVgRWKFZMVmxWkFawVtRW+FcYVzxXYFeAV6RXyFfoWAxYMFhQWHRYmFi8WNxZAFkkWUhZaFmMWbBZ1Fn4WhhaPFpgWoRaqFrMWuxbEFs0W1hbfFugW8Rb6FwMXDBcUFx0XJhcvFzgXQRdKF1MXXBdlF24XdxeAF4kXkhecF6UXrhe3F8AXyRfSF9sX5BftF/cYABgJGBIYGxgkGC4YNxhAGEkYUhhcGGUYbhh3GIEYihiTGJwYphivGLgYwhjLGNQY3hjnGPAY+hkDGQwZFhkfGSkZMhk7GUUZThlYGWEZaxl0GX4ZhxmRGZoZpBmtGbcZwBnKGdMZ3RnmGfAZ+hoDGg0aFhogGioaMxo9GkYaUBpaGmMabRp3GoEaihqUGp4apxqxGrsaxRrOGtga4hrsGvUa/xsJGxMbHRsnGzAbOhtEG04bWBtiG2wbdRt/G4kbkxudG6cbsRu7G8UbzxvZG+Mb7Rv3HAEcCxwVHB8cKRwzHD0cRxxRHFscZRxwHHochByOHJgcohysHLYcwRzLHNUc3xzpHPQc/h0IHRIdHB0nHTEdOx1FHVAdWh1kHW8deR2DHY4dmB2iHa0dtx3BHcwd1h3hHesd9R4AHgoeFR4fHioeNB4+HkkeUx5eHmgecx59Hogekx6dHqgesh69Hsce0h7cHuce8h78HwcfEh8cHycfMh88H0cfUh9cH2cfch98H4cfkh+dH6cfsh+9H8gf0h/dH+gf8x/+IAggEyAeICkgNCA/IEogVCBfIGogdSCAIIsgliChIKwgtyDCIM0g2CDjIO4g+SEEIQ8hGiElITAhOyFGIVEhXCFnIXIhfiGJIZQhnyGqIbUhwCHMIdch4iHtIfgiBCIPIhoiJSIwIjwiRyJSIl4iaSJ0In8iiyKWIqEirSK4IsMizyLaIuYi8SL8IwgjEyMfIyojNSNBI0wjWCNjI28jeiOGI5EjnSOoI7QjvyPLI9Yj4iPuI/kkBSQQJBwkKCQzJD8kSyRWJGIkbiR5JIUkkSScJKgktCS/JMsk1yTjJO4k+iUGJRIlHiUpJTUlQSVNJVklZSVwJXwliCWUJaAlrCW4JcQl0CXcJecl8yX/JgsmFyYjJi8mOyZHJlMmXyZrJncmhCaQJpwmqCa0JsAmzCbYJuQm8Cb9JwknFSchJy0nOSdGJ1InXidqJ3YngyePJ5snpye0J8AnzCfZJ+Un8Sf9KAooFigjKC8oOyhIKFQoYChtKHkohiiSKJ4oqyi3KMQo0CjdKOko9ikCKQ8pGykoKTQpQSlNKVopZylzKYApjCmZKaYpsim/Kcwp2CnlKfEp/ioLKhgqJCoxKj4qSipXKmQqcSp9KooqlyqkKrEqvSrKKtcq5CrxKv4rCisXKyQrMSs+K0srWCtlK3IrfyuMK5krpSuyK78rzCvZK+Yr8ywBLA4sGywoLDUsQixPLFwsaSx2LIMskCyeLKssuCzFLNIs3yztLPotBy0ULSEtLy08LUktVi1kLXEtfi2LLZktpi2zLcEtzi3bLekt9i4ELhEuHi4sLjkuRy5ULmEuby58Loouly6lLrIuwC7NLtsu6C72LwMvES8eLywvOi9HL1UvYi9wL34viy+ZL6cvtC/CL9Av3S/rL/kwBjAUMCIwLzA9MEswWTBnMHQwgjCQMJ4wrDC5MMcw1TDjMPEw/zENMRoxKDE2MUQxUjFgMW4xfDGKMZgxpjG0McIx0DHeMewx+jIIMhYyJDIyMkAyTjJcMmoyeTKHMpUyozKxMr8yzTLcMuoy+DMGMxQzIzMxMz8zTTNcM2ozeDOGM5UzozOxM8AzzjPcM+sz+TQHNBY0JDQzNEE0TzReNGw0ezSJNJg0pjS1NMM00jTgNO80/TUMNRo1KTU3NUY1VDVjNXI1gDWPNZ01rDW7Nck12DXnNfU2BDYTNiE2MDY/Nk42XDZrNno2iTaXNqY2tTbENtM24TbwNv83DjcdNyw3OzdJN1g3Zzd2N4U3lDejN7I3wTfQN9837jf9OAw4GzgqODk4SDhXOGY4dTiEOJM4ojixOME40DjfOO44/TkMORs5Kzk6OUk5WDlnOXc5hjmVOaQ5tDnDOdI54TnxOgA6DzofOi46PTpNOlw6azp7Ooo6mjqpOrg6yDrXOuc69jsGOxU7JTs0O0Q7UztjO3I7gjuRO6E7sDvAO9A73zvvO/48DjwePC08PTxNPFw8bDx8PIs8mzyrPLo8yjzaPOo8+T0JPRk9KT05PUg9WD1oPXg9iD2YPac9tz3HPdc95z33Pgc+Fz4nPjc+Rz5XPmc+dz6HPpc+pz63Psc+1z7nPvc/Bz8XPyc/Nz9HP1c/Zz94P4g/mD+oP7g/yD/ZP+k/+UAJQBlAKkA6QEpAWkBrQHtAi0CcQKxAvEDNQN1A7UD+QQ5BHkEvQT9BT0FgQXBBgUGRQaJBskHDQdNB5EH0QgVCFUImQjZCR0JXQmhCeEKJQppCqkK7QstC3ELtQv1DDkMfQy9DQENRQ2FDckODQ5RDpEO1Q8ZD10PnQ/hECUQaRCtEO0RMRF1EbkR/RJBEoUSyRMJE00TkRPVFBkUXRShFOUVKRVtFbEV9RY5Fn0WwRcFF0kXjRfRGBUYXRihGOUZKRltGbEZ9Ro9GoEaxRsJG00bkRvZHB0cYRylHO0dMR11HbkeAR5FHoke0R8VH1kfoR/lICkgcSC1IP0hQSGFIc0iESJZIp0i5SMpI3EjtSP9JEEkiSTNJRUlWSWhJekmLSZ1JrknASdJJ40n1SgZKGEoqSjtKTUpfSnFKgkqUSqZKt0rJSttK7Ur/SxBLIks0S0ZLWEtpS3tLjUufS7FLw0vVS+dL+UwKTBxMLkxATFJMZEx2TIhMmkysTL5M0EziTPRNBk0ZTStNPU1PTWFNc02FTZdNqU28Tc5N4E3yTgROF04pTjtOTU5fTnJOhE6WTqlOu07NTt9O8k8ETxZPKU87T05PYE9yT4VPl0+qT7xPzk/hT/NQBlAYUCtQPVBQUGJQdVCHUJpQrVC/UNJQ5FD3UQlRHFEvUUFRVFFnUXlRjFGfUbFRxFHXUelR/FIPUiJSNFJHUlpSbVKAUpJSpVK4UstS3lLxUwRTFlMpUzxTT1NiU3VTiFObU65TwVPUU+dT+lQNVCBUM1RGVFlUbFR/VJJUpVS4VMtU3lTyVQVVGFUrVT5VUVVlVXhVi1WeVbFVxVXYVetV/lYSViVWOFZLVl9WclaFVplWrFa/VtNW5lb6Vw1XIFc0V0dXW1duV4JXlVepV7xX0FfjV/dYClgeWDFYRVhYWGxYgFiTWKdYuljOWOJY9VkJWR1ZMFlEWVhZa1l/WZNZp1m6Wc5Z4ln2WglaHVoxWkVaWVpsWoBalFqoWrxa0FrkWvhbC1sfWzNbR1tbW29bg1uXW6tbv1vTW+db+1wPXCNcN1xLXGBcdFyIXJxcsFzEXNhc7F0BXRVdKV09XVFdZV16XY5dol22Xctd313zXgheHF4wXkReWV5tXoJell6qXr9e017nXvxfEF8lXzlfTl9iX3dfi1+gX7RfyV/dX/JgBmAbYC9gRGBYYG1ggmCWYKtgv2DUYOlg/WESYSdhO2FQYWVhemGOYaNhuGHNYeFh9mILYiBiNWJJYl5ic2KIYp1ismLHYtti8GMFYxpjL2NEY1ljbmODY5hjrWPCY9dj7GQBZBZkK2RAZFVkamR/ZJVkqmS/ZNRk6WT+ZRNlKWU+ZVNlaGV9ZZNlqGW9ZdJl6GX9ZhJmJ2Y9ZlJmZ2Z9ZpJmp2a9ZtJm6Gb9ZxJnKGc9Z1NnaGd+Z5NnqWe+Z9Rn6Wf/aBRoKmg/aFVoamiAaJZoq2jBaNZo7GkCaRdpLWlDaVhpbmmEaZlpr2nFadtp8GoGahxqMmpIal1qc2qJap9qtWrKauBq9msMayJrOGtOa2RremuQa6ZrvGvSa+hr/mwUbCpsQGxWbGxsgmyYbK5sxGzabPBtBm0cbTNtSW1fbXVti22hbbhtzm3kbfpuEW4nbj1uU25qboBulm6tbsNu2W7wbwZvHG8zb0lvYG92b4xvo2+5b9Bv5m/9cBNwKnBAcFdwbXCEcJpwsXDHcN5w9HELcSJxOHFPcWZxfHGTcapxwHHXce5yBHIbcjJySHJfcnZyjXKkcrpy0XLocv9zFnMsc0NzWnNxc4hzn3O2c81z5HP6dBF0KHQ/dFZ0bXSEdJt0snTJdOB093UOdSZ1PXVUdWt1gnWZdbB1x3XedfZ2DXYkdjt2UnZqdoF2mHavdsd23nb1dwx3JHc7d1J3aneBd5h3sHfHd9539ngNeCV4PHhUeGt4gniaeLF4yXjgePh5D3kneT55VnlueYV5nXm0ecx543n7ehN6KnpCelp6cXqJeqF6uHrQeuh7AHsXey97R3tfe3Z7jnume7571nvufAV8HXw1fE18ZXx9fJV8rXzFfNx89H0MfSR9PH1UfWx9hH2cfbR9zX3lff1+FX4tfkV+XX51fo1+pX6+ftZ+7n8Gfx5/N39Pf2d/f3+Xf7B/yH/gf/mAEYApgEGAWoBygIqAo4C7gNSA7IEEgR2BNYFOgWaBf4GXgbCByIHhgfmCEoIqgkOCW4J0goyCpYK+gtaC74MHgyCDOYNRg2qDg4Obg7SDzYPlg/6EF4QwhEiEYYR6hJOErITEhN2E9oUPhSiFQYVahXKFi4Wkhb2F1oXvhgiGIYY6hlOGbIaFhp6Gt4bQhumHAocbhzSHTYdnh4CHmYeyh8uH5If9iBeIMIhJiGKIe4iViK6Ix4jgiPqJE4ksiUaJX4l4iZGJq4nEid6J94oQiiqKQ4pdinaKj4qpisKK3Ir1iw+LKItCi1uLdYuOi6iLwovbi/WMDowojEKMW4x1jI+MqIzCjNyM9Y0PjSmNQo1cjXaNkI2pjcON3Y33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',
  bera: 'data:image/webp;base64,UklGRsYDAABXRUJQVlA4WAoAAAAQAAAAPwAAPwAAQUxQSLUBAAABgFtr25vm+/+KVvw4LEBYQSwAm4A66GCBjGronb0AVJRxg5w7qHEgfI4K/2v3EeHAbSRFSpYZ77r2CeRRqUyr0R7tXplfd6N23TKVJH0Klah1twd29LDt2Ukl9CAj+cGePbnv56JSwxLhwuzMnj3PixHhk2BmxD4dZ4K+1jJbB/btsWVKzwRSa9biJhXwiGHvWZN72/DE9c2RtXm8u/bSPrNWn90b45Y1e2O4bc0+6eZkO29MpPes3X1aOBFfM8B13OlpbzLEZvA32SOGY/YX0RGDHEZ+rlNkmAXxTWyGYxb9JsdA81+Eekj6IaLkHsk+SVRjqDVSPSwdZW6xbE3rgOVg1Rlso42mPUIz2qHZvaJ55X8vfgS/CH5D+Oe2gaaOf2/xvxuqg6Wn4L+bf+B3m0J96HiIiPJIckREUeT/ZoyISBRwFAV9GxnC3rkovG7B103wug1fN8LrVnDdfGf8gbrdvbnTmRtur+G5xXNu2mjaayrgJ7dpWOrQMqW/3Dj2/a5lguRPESnO/eTWWSGsITvLaK7vNTcP8hGpK7cn7Z57bu/WEkqQPqUyrbrTd4OGj+8GBABWUDgg6gEAADAMAJ0BKkAAQAA+zVCiS6ekoyG39AgA8BmJZgCqlY3XvqUSygl20LYAH4DsCDAlZneNMC6F9CYpdqHl4kDbwZTZV0I2yvPFFTFcJbYMXNqnH3mCXwDpTzRaSg3PE4L3ueFBW96Ip1InzQAA/u+n/+0/6W//5zL/bpHM38PoScq1HAp/1/hEwjZZ5Yj9UI8EKay7GsQ9/MSVHA74/cxNbBMh3D2FP2mdaIj8YjPEyLS8MRHYG6JMUr3P9jh83gM/PaqUd6W28fWNKPdFapTiA/76fwGba895c4Qkt8BycBh3IN/2gBnaJ3fbMpvDavCZlXt3vSm23NU2XpV+cxFMr+Z2RXcQpcdbvnqKaH24QX68JkpU1UpNbhW4AiYZ68tRy78o9O7qTomxkakz7mwrY6hXS0zLtVYjXVGz483PGhpLdfOmWrGkxMUsttaWjVNc9wj9jH4MBD7RKbeIDdEj8q/7ixuw/IXQHr1xMjTq4v9ISN2jHDAerlV/YbHbYOf5s4ru+FZbHS2xP+Bh/XTLHnmpOZmcH2PbydrThMC5rCm9Xnmbl0S++IeDYJ8+cybvlcLJg00MA7j7VOVJ0xv9Cdf0diQ0ddmclfCFAA1vomVbjb5txuBB4dSvvwPfvQckU6RtyJW4AIREAAA=',
  bsc: 'data:image/webp;base64,UklGRuIEAABXRUJQVlA4WAoAAAAQAAAAPwAAPwAAQUxQSOABAAABkOP//5tkvz8szEksF6CewD9HiAfBbHHLBexthEnYdew+baOdIMHuGFzh1UJ+dv/5f332iGDgtpGi5Jj5Ol8gRVOmdKr/gv6IefTs/6s50hKkT2HZB80w4i+NwtaebQo9pHNee8hKDrteMa1hiez6bczKxg9bBZEQ0+3FnMyeaySaWr6ccmInJ0spZTKVJ9biUyWjiLE7YE0Odg0lFhoz1mZUX1Rg8ThmjcZHC9/Prb+1WpvGdzMzuzPW7Gw38/VeKwPW7qAivkI+McDH8ldP+wlDvDA/szrFELmfKAQMMsh9/EZtMcx18U7pHsfNh57HQL035rpIWhbR8hDJ0CbaY6j7ZLWwNE0ZYgmlM8UydWoMtvoPzV8fTfCMpj9CM+L/XvxIH75IgMbHP7dVNDUnAr+3K2X4d8Nsgr9bFu1j2SOy4d9tq42kY/2A/xZR7gbHfZGISKzj2PyYYHO43FCgj7oR6Jl3v8hNFxhODPpsGZPbJD43/qTcSmQ0dOfmQ+P72K87tysF/7rG/UWNBXjdgq+bVE3Jk4mGp/1SCkqg4faS7q3nmpRMUdh6SFK33q5lNdTO6aLXVa2b214uratuX95rhd/kuWnY3Lc1l/5LK7W/fn/EPAr9v1VHmilSkwBWUDgg3AIAAFARAJ0BKkAAQAA+0VymTqglIyIoCqkAGglsAKw5gdZ+Af5nzIrN/idgSQb2UfufZh6D/MA/VPpAeYDoef5X1AP6l/vOsT9ADzX/+p+6Hwbfur6OkVIMA7SqSmAg3rOWaM0kT73RjSQwvPmugfJ4pQXM3Tduq1KnQfSh4YY6NwkrTNVDlRkbDDF3ofv/H8kt+GQlAAD+kz//Vk//1WJ//1CBv7c4j8mLgf/bPM3Oha9iTe1KumhPrhHUwC7isdDNIaSkQnw47WFmX9RjRrSqL2RAzxUQySRskn7FZJbelNB1/VtDNC1YaR1X+v8MA9RC83mejnUluql/6OiQuuzMdPzHS/rbBa8OMWmNa8fPbx1CVCASxpz+8HMFt+r4R12VYI4eiiPqU35gyKjYsOFpWlmWh2r0kF3Z5zgoq3r2GYOWnnPZ0kmq6z7OF5NopAonWGedf+FvOXnFeCnWZq/uIz9SvbMu94kEqemz1F3HimvNvinFURgJIgMWrsmhF9CvPup4NMKrszR2tTsYbuSzfSTiOFEOr72TjdA9O6JZXw6PyZL+e6AyHScWXAUAxYzuehKqJJPmQT0qnA/jI0fqWeImFfdSObLHvphTUOqZAmMHblw1jGZwdwNILHwZ3lP404MPCb7fKk7MOv3DQ1k5EttctUKeZKX0GxVdat6wFPUK4LjKfyG/m7+c3g43X7TILYyQYJqdhLV/CA9ciWmtrOAgeRxxmwgI7CsTiE0BaFWCXndt+2apJ+BsNM4i0HEDmeVP21jUQru1rdNzSma0ERSLi/ZfFmGnV2SP6/gFdRMpNHMtDpPazBpWf6Opdn1VxndwPe/tRVnYfV4K4vBwDwnWkwZmMGq9ErHTbwQYqrwuD5tQzIx0uuZhbjMi4idjHPBzEznFMJetjWqoUsS/hoN7Aj4+A3QlbUf98nmRcvlE+cdE6gHfrvBY9/HPXu4kDpeFVMKB20RvCgAAAA==',
  btc: 'data:image/webp;base64,UklGRqoEAABXRUJQVlA4WAoAAAAQAAAAPwAAPwAAQUxQSDkCAAABkChJsmlbvc+999m2bdu2bdu2bdu2bdu2bex9fM5cbsz8QERMAMxXIifKWrxqnbrVS+VMFlUB98gZG0zae/v9L9Xh0H5/enBkTquc0RkFpOu0572HDPq+nRySJxKPoIJzX/nI3K+bq0a3zpZz8TeyUN1TIZJF8Qe9JYv/LMpghVLoqJesf9AgyLSgVm+J5d9xsU2KNuI/MfWuS2pKjOku4rs3lQnRpnuI875khgKHu4j3xjhGWvwj5r7JQfoKvib2/5vrineIBD7Jpqe/VwKtiRJRtpckUq0TgW0OCT0RJ7w8n6S4moY3hcQejhEm5WM5/8qGaeGVQ7MBBG4gwXcTASmfS9LKA1UckmgYMIRE7wiyrZd1J3Hs87I+50n1VJZaLdcnWe7WxX7J8vcu+1cWDSknrsRvWf4+eb7I8rRN+0KWWj3uZVlf8gVukXUvKUbJ2h0JtdyiRgFpX0tyVAYi7ZD0MBmADn5BixQA6V7I0aoAgDJXzunYYVD4mxRve4QbuEzK5YThId8HGc4WiFAZ5RexM0ZESHxGwruC0Fv6Ez9nN+hWutnZLY6mD5GneZkdSAKjsZf7WZ1ND+PxV/oYnckCM+PMdnLx70sHc6P2+87DMT8RzA6ofJ3D645RYWHKmT+tsm/Jo8DSwFI7/lvhOtsgGiyPWnnTN7P+HW0eFywj5R1+7pffkHp7ZpkYYKvEzN952bmXP+1ur8/j/PP++uaBpRMoYG6Llb5Y7dadu7ZrUCZr/ECYDwBWUDggSgIAANANAJ0BKkAAQAA+0VqkTKglI6IqGZ0RABoJbACqlUFY/i7mV3xMc95euHnAfln2AOcB5gOhn6AH9J/zPqo+o76AHSbPoKtLhALZf5vZOxPvea8eYYG0sKZ7sclKDtqIQyRTQRLM0bMLHHdwz4lOsUrkXLhW/+BAAP6/v/+H7//Dkf/+GA9zzfHCJ2W0713+Or4i5C4Rx8ouGGxdFQeBFyL2Zs1A11YEfsQ/fftFoIiPph3l8yAJHWKdDdlGWa+zFez9z1+xX7oQYMBQJyh9zamT++WnN1wVJw5SmPuhO1087hZa5VbmUcmo6vgdsvMWdEc8JA4PPuornNNi5xLrqrDPr3dt4F5oAUdMIp9fcJTe0H7JYU5bA0k0f0nfJCK2L0lfF+jL/iOMfd5r/1nRPMpe8V9/3R31L9AZl0uZ3QEHEC8feY3W7KvArwOYZy9RkP50GvUfWgZD5oiXQbh7zCNjAbOjo+vkPjzgqAUGbwspx/Ek0HltaPM7+ntqCcsyDfuHOZbGxZJrC/SaripLcSaKzHevRKvUM3RjTJ8HAjXQcsGa+mA+ldx4+SH9JD+KIxq100ekkMWoz6+eyC18y0MGkfhspgPln2ROecuD5qSRc7us81ZQoFnfgvhWbvoU5em/VDXSP5VwwxpqXPZP/IYuP/NnQdzkuqLdra0qtpy7c0BdlNeoXSwiEgaiZbS97pzPJPoAu4OKDJrUe8EEkgWR7sy7uHyyrHYBjv8A+OAPwyEDQvHvqxTU1Li7QAx1LcZAjXvJC5oAAAA=',
  doge: 'data:image/webp;base64,UklGRh4FAABXRUJQVlA4WAoAAAAQAAAAPwAAPwAAQUxQSPYCAAABBjnStilyM2JmzMwMYmWmSHiALd0At/YEopAiKXO2NzDbV9hQqVnMYFuwMP1Xebr/Bl3g64hw4EhS4zRL1ILnMusnwCLlV1/rHRjx6L1WnR+4TvmN92JTS29Wtw7/+EOsvlmait1rdOhafmM0tXNOmuR3UqM3yt1Q0ZZcu1TUChIgoYjwa8m2CnuK767shtFcg0RA6FfuFltSnVjLEISRkTSQWUt4Gwr6vpxJcyU308aZ7yswpiy+Lek1NUbQdtybus2eqGIJpkOhpOhkrtaI1oXIjcwhgJl0sdxqQNUCJ5VgYLKQMLJIwXKNlpLZC4Jg0Dco6uXSCKVCUGauREf8DwkYALDnIJP+j1DMxzW82CA9AmAJRdaHwktIirb7WGo+8hn6OdKaIUhkOPCZ8ylKnJMgYZmkgbQKQGeJIpX7v8m+JR1XLsuCtYfqe2Ily6mxa+bAnh0KX5fLtO9yGZbuGl3k2+U6SZraqqEDXqpurvO1W1u7GTGadgk0pEf/05iy7pNWBHHHkGoMcG+bRedqfyfS9r0AsQumbwRBX/EafCzAlFVfGiGrizAVYMngQB0mgg+q3yhny/REkS1v/LVVBcBQpy2r17o2iV3XvW31vtonqLhPhMOB4SMN5Nr+jmiBe6IOf9O676gu6lQ3asG6yAu5PlqwC1W/4SHnvPHBvKYgF5lnKcCUQYdcMqW8N/imU08fk99bzj01763G1BWgeW9iNO0U4vvpUfm74Rr9d6M86bZr8t1C2/ZVsdsWSJQuZd2acpbIr6j78LtfCe4h/L7P7Fvi0b7FudNZoki3b2LvJ+n6wg7Nvgl49oPAAjhguy/g08QfTqeDTICPG+1bnUECfrbEft9svkoELXjDfbsgLltAOFtoNY4bBMlY/tDJrDeNWyZ+UoRltolbgPznH8+sRghK3GQft8FokAAlbrOOGxe3Q4LQLC3rMIkbTZdsS65fypMVI6mN9HqyreKq4+YriNuPvPe2cbvt/waDw37Q8n8DAFZQOCACAgAA0AwAnQEqQABAAD7RYqhQqCUjoqQYCtkAGgloALb7lr6E2pXV4H38lJiip8QBPCfY0qWRXXUab/j0yrKXXvOm7QoTikv7e6OI+trd41ulyn2cKsPKgIWtYgPWXUpL+2BL6cphyVQxo+OfLYeN9YAAAP79UTcNysUfOA5/jxQJ/+Fa3YOvedKigH0GsQQz6/Ybqb+GkB5pD7ROKget6jiEGzhQjVdNcIM/2LN1LH10plh73CrAwEzUzNbyOj9tgzbatItTxHwqitx/MF9cdQFTmV/xyjYbbGnmJXzAizV7jpYF1r8XSSXH5b7B7ZtJcSXyfLFBMfZnLSvmjhZRRpFsPyArSFcV/XjO2Inu4KAm5P5/euyYWsIx/Qq+GaEo3vhLdg1MiQozSj6gA8GXdDfdEw/hZyCxuAXXBiW5ly4IIS9TSUd6RW6X1aRIw+6dc1nuPjwjFm1csK0PuRbQB8P57e0T8gRVWocsm1RBXgOSltxruI+v+Tb1zIVxJtjId7LYnlqAzo82nn66b23xOlhHEhHsyM+Ncxn+bEUPNhJilGNh7+7mANnBy+mgmSEF0KlCQVBmUEvTsLQZqimefZZ7C0Z+Ba/2OnmGTbGIvPCg8We+5xSaQIJCoQhXNN0mM5ptintWrULvDo6FiSuyjVZq9iHApg+A8hqz6eFolu+K3AAAAA==',
  eth: 'data:image/webp;base64,UklGRvwCAABXRUJQVlA4WAoAAAAQAAAAPwAAPwAAQUxQSCACAAABkAPZtmlb6+Dbtm3btm3bthXZtm3btm3bOPfO4HitzywiJoD+d4bUhSltSgrLfH9HVFFh5uJHO1HVPgLX0giKcxgAJocUo/QNmN6UFpPtASx3RRcSdhGsf3YWUuOTDW6kExHvGBxODyVAGRh08q68gBwP4Hh3DHbhlsK50Z1dnc8ucCsDs/jH4XpmKFbq0KC795VY5X4MD/fHYhR+Obw0eip8Gnz1BHczs0l0Gh7PC8NEGw6vP1Rhkv+pZzgch0WE1fA+0Ffh0PirD7iXlUGyC/B1STj/Stz1JXggsX9alvkfvHs8JIHim6JQmEr7f3rzaXEOjfyjuClVitHtlgfGkephKVSGiP5FHtU9Bilpp7xxc6dXbFJSjW6t+0eZLh+oGJpCltr+w8m7WRlVitbuxoZoxLH+pw/zs6gUpfVlm5+7yoWmUGV3GbeyEsvQE4D7/eOSkmL0C9O1jtFJzTDjLT43IaYJDgOB47XDUYiC6769Hp9KoVi97gCYFoYLlXgG4PPyPDpFqlksJIWtfsgAcCIJsVV7/wSApyMTKURa9sWfAOBlGWIcZa0JwXPNIiUY+ghmY5DGibLcMAHfdp4OwnJTdOLd6LOFwzvZiXmYaS6+tiT2iY85mxWWH5V56eR0chKoDTTsXlckkdE22QSG6TIoxx2rbTFJavMvpnu5SWzYWQC+tSXByU4B88NLovJvz6ck0SF6VyPhoXRp/8ABVlA4ILYAAACQBwCdASpAAEAAPrlMm0u/pKKht/1aA/AXCWMAz9xirvvrpI4SX4j5FU1OCpBloskSBMiFLRiXQpLM3y7ifCveC/Q37AAA/vggIbV0mYnQOkiB7LxLYf0Ck///J4HxRdcMt0U59/VJVLoJGdoWOA7D4wcbN7gGyZB+pWf+xbq1DNDh/Q4G5vvtrdw6CBy5K60ueBKA5nzWVYYojMAL3KASSMmv1HFHge4/pb//k9xLeGHk7AAAAA==',
  gnosis: 'data:image/webp;base64,UklGRtIBAABXRUJQVlA4IMYBAADwCQCdASpAAEAAPtFco00oJSMiKA35ABoJZQDLrKt/At8GU/wA0mUyrx8UmFNA0VWIVC1j6+12EuNMS/n1U9SHglEwpdGgeRNp8f2lVJc3NjNp4PehxU2AAP73opatJpF58XCccfCItu7clY6XN7fEkYMHR1dXXq+Ml0r2++mr8Tf4DMg2T0Ab/fpMtNKdqu2/sqel9lsjVtPOqC7freIn0NltM8JnHMMTklPC+a5+MvmbYDwT30c4lBUy6bT/lYjh1dUqEFw/VH1g5SuwRWv/sujhvhZ/p3ZJzgbfOLTxc9Rv9FYJpw1wW1u/yDAirGOusCnv3Y4R+EIOZhpG2pFHZri2+8d+8KSgnTCE4fD/CqN0+szGS68j3x/HbeaB8djbni0Zw8GJ8rvV+J2mYShUkIOq7/JDNOq3rRRYiXF6sU0ubfUJiEYbdbuDLRA4UrOvv2L0kaKjqTUSyRGCN714zeqGTDryiULIKOHvo71Sed/kW/1TwOFEV4+pQYV83TpueHFWz3/Da+Dd7x5jxYg5eI0AT6ZoCmN3U1GCegPTyLVsXpxe3SfzvN/aVE9q/ggraBuywgJmB8YehibRpeQ2VvQIAAAA',
  near: 'data:image/webp;base64,UklGRlIBAABXRUJQVlA4IEYBAADwBwCdASpAAEAAPtFeqE0oJSQiKAtRABoJZgDIwBXTANtmk8KQAU4V70xL9msC4o7fOwIqMLOtL7KWLQDAHTdG5GodexLlbwAA/uIuff/rK//+ZX//zK/PAc41YV4D2FoGD0isvOof/Cw28nv2O/M0tIyzK12/R3pfguXwmCb66dDxDEih5LwWCQNw+uke/6PPQGnO0f4/ZJ3vfO+xT1MAq/1C3LdWxYJXJb30G9eZKV/8NJQmL48gFfTtjBAlA3kzUeWXPHgv5lHhme68oRHB2+uEUPUlDSVVA4WVcgzTwuyOMG8l24dqOyzDU/QbzcqDUWQQeDfZj1+r4o+frKKJtfaYRWlbh9fSzZgPB364355F/2aPi0s56aLH38r5kOAD9Q01etBWOKK/0/ZQ9IoHP34fg80cxRZQRN3BmYcSwUoZJCAAAA==',
  pol: 'data:image/webp;base64,UklGRtIDAABXRUJQVlA4WAoAAAAQAAAAPwAAPwAAQUxQSHwBAAABCqjZ/7+JQsd2JiCskGzAJjxxkUwAKh407ibg1OHaCNebq47e6z//L+d//98vIhi5jaQoWabTQNc+gRSNZB2v1Xv8m2/MnB57bY+zEUufEakGg+/l5qzyPWDSdSFq10eTjZIyIjuq4Yly42W9UZZem+VISDL+wyak4nOoq+7tchNa6TqkTLr2abQonFZ9LBgbTXKg9lSpszLapI6orDdGqyyX73aMZokvkApWuiFOnac22WhX+CzuhwHIcoZs10BkOcVfYhD/BPt+A5KFiIgizQ3MRuRA5RkHy4G6AUp7ckMkI7GoOkbCZFFgoDJl+1g4535h+XK8JRahlgErd2joEQ39opEZGjL/XoKv+EfwH8K3W3y/wfdbRo8bbg49bmXh4+YVjNuUGyEZyhXMW0Q2ct6sWEQUaeBoRuB1A7xuwddN8LoNXjfi61Z43Qyv2+G5AZ5b8LlJ1YjT1ZLbXELnxtC5tRkqt3JDIujcfIW5Pcx/g/a5/wYtj5WvEFZQOCAwAgAA8A0AnQEqQABAAD7RVqVLqCSjoaoWbokAGglsALLD53jh4u3O8wHQQ/1XoudQBvJP99/2eCAPzZbPmdqrG97EXF6i+6YkyZ3ZTnotJZuyFVKtOD8QE+YqhyU0kO3JxcHDw6ObYRc2nLM7gJxGr9e9EXRNLY/bGrAAAP7uH//8/H/56H//XRe+dT9YPhL4mkI4Fqub1T/BSKVOyfV8THd3GCeq6/puXExfGuKwSL72VbT2/mkw1ZsHjHTiLyUwoHnAN+uI93XBBmey9tL9KnY/BaO8j28tf5lLWyzaDf+Dn+yR3PLrldfXNTBrhIusisokvP49UFSeB9odb0otX0zWDbJxe1qBzt2+T8YghbWWpaVsXGFHZuoaxwijN1M9aWu5zHB1JkTSZ31UEsHnd6FAz1W7N03H6eC6MlYwI1UjLEW6VAKep8jUFF0x+Z8vkAR0GfbWlHfl06gL4oWR8yX5egA0dKlrspGMYJ0+sO6qvwvaE9LMz54F6Po83P/LHzN9hMUeuxXzOwurpDiZ2j820mlYaWWzltOaNxuRs5r467fdQpA+hh9xAIFUmqbXI1IYoz5dyucerrDiooFtHnFI5/b54xSyVwdeqztefF+D/HcvmSnk+7wtjgxqImSDtK0tCw/RwljN51c8mybHhCWX2kzgXuJW7R5m+GnbDZNoEdr8nVz+KP3dqCX7NPCpFbsRAW4XeE59Qb8xNnEJn7PFrTeBqTqt8m572i9H9bMAAAA=',
  sol: 'data:image/webp;base64,UklGRpwCAABXRUJQVlA4WAoAAAAQAAAAPwAAPwAAQUxQSFoBAAABkLtt2/E3z/e9sW17sp3VTv4P265t2/bayba9xfYzpb3z1J0iYgLov3MVkpIqMUCH6UVvpyXOXbNEaUVfWORomULlf2GRk60mBM54zyKne80JnPScRc6stiJw9H0WObPaisDRt1nk3BYbAkfdZpn77Qlsdp5lnnQntFHl0cMCD7V7EV43UEtvoDT6c9X8kxIlBiqcxZWJkaUfHXlZqsNU/QSL/Fqoocisa0oEf8yGkeWyKRH8IhVGlsumRfCjOBhZbpgVwffjYGS7a0EE34uFkctRGXwjFEaeZ2TweTMYeS07feabT5/Bnqs1wpGuDCTq9Oeq/GMlxvloMK3wWX/fov3f3de/+NB5C1jOZxY51W6ISn/JIie7LQic+IRFTvdaEDjhAYucWWNF4PgHLHJhpzWBI26zzMNOBA66ziIXTroT2Owki1w46UFok+arVySu9iC8rkTq9P85VlA4IBwBAABQCQCdASpAAEAAPrlKmku/pCIst/1YA/AXCWwAzumB2X4VUPrZ48dgD1R5oB/Yv2x9/+m/wnHcdmQYmg82yvzJ5kNi8deGF5aGJoAuu+wNcQ4sAAD+8/T//cD//bzP/91lXcc68FJf/qyzlBWD0+BOcr9B0BFVVfBM3zMZzr/ROGFyL1+7o8ga+fm4OZjY3n9qjdLrB6X7uOm00CBrpQ7Tzp6vEvOY5Il5E2wMm/u4K60/999vENI2+RvyugKv1pFjNfHRVwVgEKOpYOZCoejme9J0VkY6n6MvlQ2D/u1FZ7fAQYGsIA4lgUzb11g9zmi/ea4mD24FbfkDQNoJfGHoRuwpBFOarFoHej+0lzmW9u6VRBbZLp8S/v4AAA==',
  xrp: 'data:image/webp;base64,UklGRlABAABXRUJQVlA4WAoAAAAQAAAAPwAAPwAAQUxQSCcAAAABFyAQSEMaQW5wRESDYkaSII9BHK69RRtgPxH9n4A4qCW+973EQQQAVlA4IAIBAAAQBwCdASpAAEAAPtFYpEwoJSOiKA35ABoJaQAMKrFEusnVGB9H+SmCOFB4GLtgkIOZ+IWM3w/BoPddSYyH5bRAoAD++DLPQr4EMm+d+ogR2OMZ5JSeYKj0E0rHxO1UU1mDcqH6yU+EqU7VWEFT0g+vvJTenon+sVyefZnvzvine8Po2fHM321yiwSKwGTzpk0XZFvpDMmHFyKUtRVuC0MzrZwO2lX8cAVnt3zpWega+V1eg1XQsF8kTzTLJUXRAYn+xbVd7H/yhUtC8HD+aL7d4AyI++/r1tU0bDOcN7hyKGpKm0TYVcns30BmEqYIYHI1slnJcVpeFiE003tHg/RgAAA=',
  zec: 'data:image/webp;base64,UklGRhgEAABXRUJQVlA4WAoAAAAQAAAAPwAAPwAAQUxQSIsBAAABgGNt2/HoCzsN6mgDw5rrsK3aNlq7NivPAmx7SsX63ySj//+eDUSEI7eNHEmaPLN76lDuJzCRyrTR6T3Lhy+fdvvn6+FKb0aMVsY4qk1s3nz10J963rZaknSckBnLtq0kSutuhYnH54bqcz+JVrisk3yhyTsWSJLCSYFW0q+i59wkWc9CrEw0qtRb4uJdhlrsZ41W4qStRSuK8AEvcdM7HClmnxCIo8L0/5tmQCCuCsPa//6t0Uuc9bWq/ybVSty1Zf5JzDUBvIv/66MZgjiv+02uB4O38BfGQwJ5Yv5JNcGs+3k+w3Fh+aZUIJxVjDHtFgHZ1TOW8IXEmsJYI0FtZZp1LNu6qBcsb7GpbiyerC4C27+IZm0PzfETmrd3NFY7Gjce/A3+E/wf4dstvt/g+y1+3MCPW/BxEz1u21Lw8wZ83sLPm/B5G183wOsWfN0Er9vgdSO+boXXzfC6HZ4b8LlFnOo0frkJntvguVGiRum5FZqbK00yjrn9jVtul7xu4HB8rxv0SVg3YABWUDggZgIAALAPAJ0BKkAAQAA+zVaiS6ekoyGwFgz48BmJbAC8nFYCz7BxfXWsS95nbN6GB1PO9AYCk+k1iqa+sBb/PkIM++aerj5N0sGooMsVabuGiUxLkpeWhJzZ2By7dtaXo4Gk2cQ0sgCJlRPLs9ZoqzxXbPDmZLjqXC4jgKH/XnwRkfbAwx3Q/cAAAP772RZTD1/uRs/gWDKeSzVITG28QqHxE9AXUcWTAoCpkMC34X+kAxpyFtxcvHIdhD1xbeP4kYJjSNiouRGeHQsD65yShi90WwG2kCUQ87AEiKOatSe+VJW7vMYIrL10ZIURAT2z5jNHStkhbC33GwH5k54jj0xDOfLIzekPYAVviTE2yOhsZJLeybWCqY5f6Py7mX3eot7dnHHXrC3QJR4ESB/DJO1AdNJeeqLotWaWO+Zu9qwYveHPrFEYFEmCpa+XH/sRE6PQv4zRy9WbvVqVmW6m09LubHnYl2gE8NPzyN56l48582zCDy0cRKoIUA5cpcsseAstRdxpipK3kUHYRu5mQFH/64LkYkbSTM8cWgEn5RS7ALGPoodvz5Ho6Grx6khj3wvFmsZQYGIPw48Uq9iC9ds6GuRXnqCumzZda18eYTQ+wIz+hLQ6J1o2MKbNZrCQo7KT2BOcGJS1u5Ef3CK3b79+cSHznosvSflOgVKKxrEkPinYfTvrpMCVWcnLvoMHqBxBUV3aMQn//rxx6s+MpvG8PphjHjGcJzWupznHaQfCvVSoZ6mEPyi87IdttxhmRVZ45FmKx8a+aLrMLi/4Yv/fJFv4qZbkMm+qjx+dQTANgLfwoEB00AAA',
}

type SupportedBlockchain = keyof typeof BLOCKCHAIN_ICONS;

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

async function getNearMetadata(contractId: string) {
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
}

interface TokenWithIcon extends Token {
  iconUrl?: string;
}

interface CurrencySelectorProps {
  onSelect: (token: Token) => void;
  selectedToken?: Token;
}

function getTokenIcon(symbol: string): string | undefined {
  const chain = symbol.toLowerCase() as keyof typeof BLOCKCHAIN_ICONS;
  return BLOCKCHAIN_ICONS[chain];
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  onSelect,
  selectedToken,
}) => {
  const [tokens, setTokens] = useState<TokenWithIcon[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTokens() {
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
    }

    fetchTokens();
  }, []);

  const filteredTokens = tokens.filter(token =>
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.blockchain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full bg-gray-900 md:p-6 sm:p-2 rounded-xl">
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
                <span className={`font-medium ${token.symbol.length > 6 ? "text-md" : "text-2xl"} mb-2 block`}>{token.symbol}</span>
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

interface QuoteRequest {
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

interface Quote {
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

interface QuoteResponse {
  timestamp: string;
  signature: string;
  quoteRequest: QuoteRequest;
  quote: Quote;
}

interface StoredQuote extends QuoteResponse {
  invoiceId: string;
  createdAt: string;
}

interface TransactionDetails {
  hash: string;
  explorerUrl: string;
}

interface SwapDetails {
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

interface GetExecutionStatusResponse {
  quoteResponse: QuoteResponse;
  status: 'KNOWN_DEPOSIT_TX' | 'PENDING_DEPOSIT' | 'INCOMPLETE_DEPOSIT' | 'PROCESSING' | 'SUCCESS' | 'REFUNDED' | 'FAILED';
  updatedAt: string;
  swapDetails: SwapDetails;
}

const STORAGE_KEY_STATUS = 'tearpay_payment_status';

interface PaymentStatus {
  invoiceId: string;
  status: 'SUCCESS' | 'FAILED' | 'PROCESSING';
  timestamp: string;
}

function savePaymentStatus(invoiceId: string, status: PaymentStatus['status']): void {
  if (typeof window === 'undefined') return;

  const existingStatuses = getPaymentStatuses();
  const newStatus: PaymentStatus = {
    invoiceId,
    status,
    timestamp: new Date().toISOString(),
  };

  const filteredStatuses = existingStatuses.filter(s => s.invoiceId !== invoiceId);
  filteredStatuses.push(newStatus);
  localStorage.setItem(STORAGE_KEY_STATUS, JSON.stringify(filteredStatuses));
}

function getPaymentStatuses(): PaymentStatus[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(STORAGE_KEY_STATUS);
  return stored ? JSON.parse(stored) : [];
}

function getPaymentStatus(invoiceId: string): PaymentStatus | undefined {
  return getPaymentStatuses().find(status => status.invoiceId === invoiceId);
}

function isPaymentSuccessful(invoiceId: string): boolean {
  const status = getPaymentStatus(invoiceId);
  return status?.status === 'SUCCESS';
}

const API_BASE_URL = 'https://1click.chaindefuser.com/v0';

async function fetchQuote(request: QuoteRequest): Promise<QuoteResponse> {
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
}

async function fetchQuoteStatus(depositAddress: string): Promise<GetExecutionStatusResponse> {
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
}

function createQuoteRequest(
  originAsset: string,
  destinationAsset: string,
  amount: string,
  recipient: string,
): QuoteRequest {
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
    recipientType: parseFloat(amount) >= 1_000_000 ? 'DESTINATION_CHAIN' : 'INTENTS',
    deadline: deadline.toISOString(),
    referral: 'tearpay.intear.near',
  };
}

const STORAGE_KEY_QUOTES = 'tearpay_quotes';

function getQuoteKey(invoiceId: string, currency: string, recipient: string): string {
  return `${invoiceId},${currency},${recipient}`;
}

function saveQuote(quote: StoredQuote, currency: string): void {
  if (typeof window === 'undefined') return;

  const existingQuotes = getQuotes();
  const key = getQuoteKey(quote.invoiceId, currency, quote.quoteRequest.recipient);
  const filteredQuotes = existingQuotes.filter(q =>
    getQuoteKey(q.invoiceId, q.quoteRequest.originAsset, q.quoteRequest.recipient) !== key
  );

  filteredQuotes.push(quote);
  localStorage.setItem(STORAGE_KEY_QUOTES, JSON.stringify(filteredQuotes));
}

function getQuotes(): StoredQuote[] {
  if (typeof window === 'undefined') return [];

  const storedQuotes = localStorage.getItem(STORAGE_KEY_QUOTES);
  if (!storedQuotes) return [];

  try {
    return JSON.parse(storedQuotes);
  } catch (error) {
    console.error('Error parsing stored quotes:', error);
    return [];
  }
}

function getQuoteByInvoiceIdAndCurrency(invoiceId: string, currency: string, recipient: string): StoredQuote | undefined {
  const key = getQuoteKey(invoiceId, currency, recipient);
  return getQuotes().find(quote =>
    getQuoteKey(quote.invoiceId, quote.quoteRequest.originAsset, quote.quoteRequest.recipient) === key
  );
}

function isQuoteExpired(quote: StoredQuote): boolean {
  const deadline = new Date(quote.quote.deadline);
  return deadline < new Date();
}
