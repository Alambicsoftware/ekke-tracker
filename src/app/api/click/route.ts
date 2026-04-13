import { NextRequest, NextResponse } from 'next/server';
import { updateTrackingClick } from '@/lib/sheets';

export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get('id');
  const url = req.nextUrl.searchParams.get('url') || 'https://ekke.fr';

  if (contactId && url) {
    updateTrackingClick(contactId, url).catch(console.error);
  }

  return NextResponse.redirect(url);
}
