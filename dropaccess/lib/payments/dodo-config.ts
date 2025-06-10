export const DODO_CONFIG = {
  apiKey: process.env.DODO_API_KEY!,
  apiSecret: process.env.DODO_API_SECRET!,
  webhookSecret: process.env.DODO_WEBHOOK_SECRET!,
  baseUrl: process.env.DODO_BASE_URL || 'https://api.dodopayments.com',
  environment: process.env.NODE_ENV === 'production' ? 'live' : 'test'
};

export const SUBSCRIPTION_PLANS = {
  weekly: {
    name: 'Weekly Plan',
    price: 299, // $2.99 in cents
    interval: 'week',
    features: ['10 drops per week', '25MB files', '7-day expiry', '10 recipients']
  },
  monthly: {
    name: 'Monthly Plan', 
    price: 999, // $9.99 in cents
    interval: 'month',
    features: ['50 drops per month', '100MB files', '30-day expiry', '25 recipients']
  },
  business: {
    name: 'Business Plan',
    price: 1999, // $19.99 in cents
    interval: 'month',
    features: ['200 drops per month', '500MB files', '90-day expiry', '100 recipients']
  }
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;