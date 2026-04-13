import { NextRequest, NextResponse } from 'next/server';
import { updateTrackingOpen } from '@/lib/sheets';

// Pixel GIF transparent 1x1
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get('id');

  if (contactId) {
    // Ne pas bloquer la réponse — tracking en arrière-plan
    updateTrackingOpen(contactId).catch(console.error);
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}
