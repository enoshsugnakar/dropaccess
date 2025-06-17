import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const config = {
    hasApiKey: !!process.env.DODO_PAYMENTS_API_KEY,
    hasIndividualProductId: !!process.env.DODO_INDIVIDUAL_PRODUCT_ID,
    hasBusinessProductId: !!process.env.DODO_BUSINESS_PRODUCT_ID,
    hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    hasWebhookSecret: !!process.env.DODO_PAYMENTS_WEBHOOK_SECRET,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT || 'not_set',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'not_set'
  };

  console.log('🔧 Dodo Payments Configuration Check:', config);

  return NextResponse.json(config);
}