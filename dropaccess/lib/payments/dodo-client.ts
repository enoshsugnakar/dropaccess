import { DODO_CONFIG } from './dodo-config';

export class DodoPaymentsClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = DODO_CONFIG.apiKey;
    this.apiSecret = DODO_CONFIG.apiSecret;
    this.baseUrl = DODO_CONFIG.baseUrl;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-API-Secret': this.apiSecret,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DodoPayments API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async createCustomer(email: string, name?: string) {
    return this.makeRequest('/customers', {
      method: 'POST',
      body: JSON.stringify({
        email,
        name,
        metadata: {
          source: 'dropaccess'
        }
      }),
    });
  }

  async createSubscription(customerId: string, planId: string, paymentMethodId?: string) {
    return this.makeRequest('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: customerId,
        plan_id: planId,
        payment_method_id: paymentMethodId,
        trial_period_days: 0, // No trial for now
      }),
    });
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd = true) {
    return this.makeRequest(`/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        cancel_at_period_end: cancelAtPeriodEnd,
      }),
    });
  }

  async getSubscription(subscriptionId: string) {
    return this.makeRequest(`/subscriptions/${subscriptionId}`);
  }

  async createPaymentIntent(amount: number, currency = 'USD', customerId?: string) {
    return this.makeRequest('/payment-intents', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        currency,
        customer_id: customerId,
      }),
    });
  }

  async getCustomer(customerId: string) {
    return this.makeRequest(`/customers/${customerId}`);
  }

  async updateCustomer(customerId: string, data: any) {
    return this.makeRequest(`/customers/${customerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}

export const dodoPayments = new DodoPaymentsClient();