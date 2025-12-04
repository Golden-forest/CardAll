import React, { createContext, useContext, useState, ReactNode } from 'react';
import { PaymentType, paymentConfig } from '@/config/payment-config';

interface PaymentContextType {
  // Current payment type (one-time donation or subscription)
  paymentType: PaymentType;
  
  // Method to switch payment type
  setPaymentType: (type: PaymentType) => void;
  
  // Selected donation amount
  selectedAmount: number;
  
  // Method to set selected donation amount
  setSelectedAmount: (amount: number) => void;
  
  // Selected subscription plan ID (for future use)
  selectedPlanId: string | null;
  
  // Method to set selected subscription plan ID
  setSelectedPlanId: (planId: string | null) => void;
  
  // Is payment modal open
  isModalOpen: boolean;
  
  // Method to open payment modal
  openModal: () => void;
  
  // Method to close payment modal
  closeModal: () => void;
  
  // Configuration
  config: typeof paymentConfig;
}

// Create context with default values
const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

interface PaymentProviderProps {
  children: ReactNode;
}

export const PaymentProvider: React.FC<PaymentProviderProps> = ({ children }) => {
  // Set default payment type from config
  const [paymentType, setPaymentType] = useState<PaymentType>(paymentConfig.defaultPaymentType);
  
  // Set default donation amount from config
  const defaultAmount = paymentConfig.donation.amounts.find(amount => amount.default)?.value || paymentConfig.donation.amounts[0].value;
  const [selectedAmount, setSelectedAmount] = useState<number>(defaultAmount);
  
  // Set default subscription plan ID (first plan if enabled)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    paymentConfig.subscription.enabled && paymentConfig.subscription.plans.length > 0 
      ? paymentConfig.subscription.plans[0].id 
      : null
  );
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  
  // Methods to open and close modal
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  
  // Context value
  const contextValue: PaymentContextType = {
    paymentType,
    setPaymentType,
    selectedAmount,
    setSelectedAmount,
    selectedPlanId,
    setSelectedPlanId,
    isModalOpen,
    openModal,
    closeModal,
    config: paymentConfig
  };
  
  return (
    <PaymentContext.Provider value={contextValue}>
      {children}
    </PaymentContext.Provider>
  );
};

// Custom hook to use payment context
export const usePayment = (): PaymentContextType => {
  const context = useContext(PaymentContext);
  if (context === undefined) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
};
