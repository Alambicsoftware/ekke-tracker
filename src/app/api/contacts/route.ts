import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getContacts, updateContactSystemCols, importContactsToSheet } from '@/lib/sheets';

// GET /api/contacts?spreadsheetId=xxx&tabName=yyy
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });

  const spreadsheetId = req.nextUrl.searchParams.get('spreadsheetId');
  const tabName = req.nextUrl.searchParams.get('tabName');

  if (!spreadsheetId || !tabName) {
    return NextResponse.json({ ok: false, error: 'Paramètres manquants' }, { status: 400 });
  }

  try {
    const result = await getContacts(spreadsheetId, tabName);
    return NextResponse.json({ ok: true, data: result });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// PATCH /api/contacts — mise à jour d'un contact (commentaire, relance_active)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const { spreadsheetId, tabName, rowIndex, updates } = body;

  if (!spreadsheetId || !tabName || !rowIndex) {
    return NextResponse.json({ ok: false, error: 'Paramètres manquants' }, { status: 400 });
  }

  try {
    await updateContactSystemCols(spreadsheetId, tabName, rowIndex, updates);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// POST /api/contacts — import de contacts
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const { spreadsheetId, tabName, rows } = body as {
    spreadsheetId: string;
    tabName: string;
    rows: Record<string, string>[];
  };

  if (!spreadsheetId || !tabName || !rows?.length) {
    return NextResponse.json({ ok: false, error: 'Paramètres manquants' }, { status: 400 });
  }

  try {
    await importContactsToSheet(spreadsheetId, tabName, rows);
    return NextResponse.json({ ok: true, data: { imported: rows.length } });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
