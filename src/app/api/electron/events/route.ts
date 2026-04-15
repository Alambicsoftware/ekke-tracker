import { NextRequest, NextResponse } from 'next/server';
import { getElectronEvents } from '@/lib/sheets';

// GET /api/electron/events?ids=uuid1,uuid2,...
// Returns { [trackingId]: { opened_at, clicked_at, clicked_url } }
// Only returns entries that exist in the sheet (missing IDs are omitted).
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids');
  if (!idsParam) {
    return NextResponse.json({ error: 'ids param required' }, { status: 400 });
  }

  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({});
  }

  try {
    const events = await getElectronEvents(ids);
    return NextResponse.json(events);
  } catch (err) {
    console.error('[electron/events]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
