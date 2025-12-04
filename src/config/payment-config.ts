// Payment configuration file
// This file contains all payment-related settings that can be easily modified

export enum PaymentType {
  ONE_TIME = 'one_time',
  SUBSCRIPTION = 'subscription'
}

export enum PaymentPlatform {
  PAYPAL = 'paypal',
  STRIPE = 'stripe',
  BUY_ME_A_COFFEE = 'buy_me_a_coffee'
}

export interface DonationAmount {
  value: number;
  label: string;
  default?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

export interface PaymentConfig {
  // Default payment type (can be switched between ONE_TIME and SUBSCRIPTION)
  defaultPaymentType: PaymentType;
  
  // Enabled payment platforms
  enabledPlatforms: PaymentPlatform[];
  
  // Donation settings
  donation: {
    amounts: DonationAmount[];
    currency: string;
    // PayPal specific settings
    paypal: {
      businessId: string; // Your PayPal business ID or email
      buttonId: string; // PayPal donate button ID
    };
    // Buy Me a Coffee specific settings
    buyMeACoffee: {
      username: string; // Your Buy Me a Coffee username
      buttonId: string; // Buy Me a Coffee button ID
    };
  };
  
  // Subscription settings (for future use)
  subscription: {
    enabled: boolean; // Set to true when ready to enable subscriptions
    plans: SubscriptionPlan[];
    currency: string;
    // Stripe specific settings
    stripe: {
      publicKey: string; // Your Stripe public key
    };
  };
  
  // UI settings
  ui: {
    showSubscriptionOption: boolean; // Set to true when ready to show subscription option
    modalTitle: string;
    thankYouMessage: string;
  };
}

// Default payment configuration
export const paymentConfig: PaymentConfig = {
  defaultPaymentType: PaymentType.ONE_TIME,
  enabledPlatforms: [PaymentPlatform.PAYPAL, PaymentPlatform.BUY_ME_A_COFFEE],
  
  donation: {
    amounts: [
      { value: 3, label: '$3', default: true },
      { value: 5, label: '$5' },
      { value: 10, label: '$10' },
      { value: 20, label: '$20' }
    ],
    currency: 'USD',
    paypal: {
      businessId: 'your-paypal-business-id@example.com', // Replace with your actual PayPal business ID
      buttonId: 'your-paypal-button-id' // Replace with your actual PayPal button ID
    },
    buyMeACoffee: {
      username: 'your-username', // Replace with your actual Buy Me a Coffee username
      buttonId: 'your-bmc-button-id' // Replace with your actual Buy Me a Coffee button ID
    }
  },
  
  subscription: {
    enabled: false,
    plans: [
      {
        id: 'basic',
        name: 'Basic',
        description: 'Basic subscription plan',
        price: 4.99,
        currency: 'USD',
        interval: 'month',
        features: [
          'Unlimited cards',
          'Basic analytics',
          'Email support'
        ]
      },
      {
        id: 'pro',
        name: 'Pro',
        description: 'Pro subscription plan',
        price: 9.99,
        currency: 'USD',
        interval: 'month',
        features: [
          'All Basic features',
          'Advanced analytics',
          'Priority support',
          'Custom branding'
        ]
      }
    ],
    currency: 'USD',
    stripe: {
      publicKey: 'your-stripe-public-key' // Replace with your actual Stripe public key
    }
  },
  
  ui: {
    showSubscriptionOption: true, // Set to true when ready to enable subscriptions
    modalTitle: 'Support CardAll',
    thankYouMessage: 'Thank you for your support! Your contribution helps us continue to improve CardAll.'
  }
};
