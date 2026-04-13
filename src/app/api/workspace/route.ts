import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { initWorkspaceSheet, getWorkspaceConfig } from '@/lib/sheets';
import { extractSheetId, uuidv4, TYPE_COLORS } from '@/lib/utils';
import type { Workspace, ContactType } from '@/lib/types';

// GET /api/workspace — config du workspace ou email du service account
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });

  // Retourner l'email du compte de service
  if (req.nextUrl.searchParams.get('getServiceEmail')) {
    return NextResponse.json({
      ok: true,
      serviceEmail: process.env.SERVICE_ACCOUNT_EMAIL || '',
    });
  }

  const spreadsheetId = req.nextUrl.searchParams.get('spreadsheetId');
  if (!spreadsheetId) return NextResponse.json({ ok: false, error: 'spreadsheetId manquant' }, { status: 400 });

  try {
    const config = await getWorkspaceConfig(spreadsheetId);
    return NextResponse.json({ ok: true, data: config });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// POST /api/workspace — crée ou initialise un workspace
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const { sheetUrl, name, contactTypes: rawTypes, delays } = body as {
    sheetUrl: string;
    name: string;
    contactTypes: { id: string; label: string }[];
    delays: number[];
  };

  const spreadsheetId = extractSheetId(sheetUrl);
  if (!spreadsheetId) {
    return NextResponse.json({ ok: false, error: 'URL ou ID de sheet invalide' }, { status: 400 });
  }

  try {
    const contactTypes: ContactType[] = rawTypes.map((ct, i) => ({
      id: ct.id || ct.label.toLowerCase().replace(/\s+/g, '_'),
      label: ct.label,
      tabName: `Contacts - ${ct.label}`,
      color: TYPE_COLORS[i % TYPE_COLORS.length],
    }));

    const workspace: Omit<Workspace, 'spreadsheetId' | 'createdAt'> = {
      id: uuidv4(),
      name,
      contactTypes,
      delays: delays || [0, 14, 30],
      stopStatuses: ['REPLIED', 'UNSUBSCRIBED', 'BOUNCE'],
    };

    await initWorkspaceSheet(spreadsheetId, workspace);

    const fullWorkspace: Workspace = {
      ...workspace,
      spreadsheetId,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, data: fullWorkspace });
  } catch (e: unknown) {
    const err = e as Error;
    const msg = err.message.includes('PERMISSION_DENIED')
      ? `Accès refusé. Partage ce sheet avec : ${process.env.SERVICE_ACCOUNT_EMAIL || 'le compte de service'}`
      : err.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
