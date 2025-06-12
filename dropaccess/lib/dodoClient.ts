import DodoPayments from 'dodopayments';

// Initialize Dodo client
const dodoClient = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode'
});

// Product configurations
export const PRODUCT_CONFIG = {
  individual: {
    productId: process.env.DODO_INDIVIDUAL_PRODUCT_ID!,
    price: 999, // $9.99 in cents
    name: 'Individual Plan',
    interval: 'monthly'
  },
  business: {
    productId: process.env.DODO_BUSINESS_PRODUCT_ID!,
    price: 1999, // $19.99 in cents
    name: 'Business Plan', 
    interval: 'monthly'
  }
} as const;

export type PlanType = keyof typeof PRODUCT_CONFIG;

// Webhook event types
export const WEBHOOK_EVENTS = {
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_CANCELED: 'subscription.canceled',
  PAYMENT_FAILED: 'payment.failed'
} as const;

export default dodoClient;