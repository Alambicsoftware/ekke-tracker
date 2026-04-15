import { NextRequest, NextResponse } from 'next/server';
import { recordElectronOpen } from '@/lib/sheets';

// Transparent 1×1 GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(
  _req: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  const { trackingId } = params;

  if (trackingId) {
    // Fire-and-forget — don't block the pixel response
    recordElectronOpen(trackingId).catch(console.error);
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  });
}
