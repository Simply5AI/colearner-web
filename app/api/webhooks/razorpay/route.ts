import { NextRequest, NextResponse } from 'next/server'

export async function POST(_request: NextRequest) {
  // TODO: Verify Razorpay webhook signature
  // TODO: Forward to colearner-platform
  return NextResponse.json({ received: true })
}
