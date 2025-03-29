'use client';

const STORAGE_KEY = 'tearpay_payment_status';

interface PaymentStatus {
  invoiceId: string;
  status: 'SUCCESS' | 'FAILED' | 'PROCESSING';
  timestamp: string;
}

export const savePaymentStatus = (invoiceId: string, status: PaymentStatus['status']): void => {
  if (typeof window === 'undefined') return;
  
  const existingStatuses = getPaymentStatuses();
  const newStatus: PaymentStatus = {
    invoiceId,
    status,
    timestamp: new Date().toISOString(),
  };
  
  const filteredStatuses = existingStatuses.filter(s => s.invoiceId !== invoiceId);
  filteredStatuses.push(newStatus);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredStatuses));
};

export const getPaymentStatuses = (): PaymentStatus[] => {
  if (typeof window === 'undefined') return [];
  
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const getPaymentStatus = (invoiceId: string): PaymentStatus | undefined => {
  return getPaymentStatuses().find(status => status.invoiceId === invoiceId);
};

export const isPaymentSuccessful = (invoiceId: string): boolean => {
  const status = getPaymentStatus(invoiceId);
  return status?.status === 'SUCCESS';
}; 