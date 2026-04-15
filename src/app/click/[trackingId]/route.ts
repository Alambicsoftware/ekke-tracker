import { NextRequest, NextResponse } from 'next/server';
import { recordElectronClick } from '@/lib/sheets';

export async function GET(
  req: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  const { trackingId } = params;
  const url = req.nextUrl.searchParams.get('url') || 'https://ekke.fr';

  if (trackingId) {
    // Fire-and-forget — don't delay the redirect
    recordElectronClick(trackingId, url).catch(console.error);
  }

  return NextResponse.redirect(url);
}
