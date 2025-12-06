import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'alfred-pwa',
    timestamp: new Date().toISOString()
  });
}
