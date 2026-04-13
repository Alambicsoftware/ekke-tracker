import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTemplates, saveTemplate, deleteTemplate } from '@/lib/sheets';
import type { Template } from '@/lib/types';
import { uuidv4 } from '@/lib/utils';

// GET /api/templates?spreadsheetId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });

  const spreadsheetId = req.nextUrl.searchParams.get('spreadsheetId');
  if (!spreadsheetId) return NextResponse.json({ ok: false, error: 'spreadsheetId manquant' }, { status: 400 });

  try {
    const templates = await getTemplates(spreadsheetId);
    return NextResponse.json({ ok: true, data: templates });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// POST /api/templates — créer ou mettre à jour un template
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const { spreadsheetId, template } = body as { spreadsheetId: string; template: Template };

  if (!spreadsheetId || !template) {
    return NextResponse.json({ ok: false, error: 'Paramètres manquants' }, { status: 400 });
  }

  try {
    if (!template.id) template.id = uuidv4();
    await saveTemplate(spreadsheetId, template);
    return NextResponse.json({ ok: true, data: template });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/templates?spreadsheetId=xxx&templateId=yyy
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });

  const spreadsheetId = req.nextUrl.searchParams.get('spreadsheetId');
  const templateId = req.nextUrl.searchParams.get('templateId');

  if (!spreadsheetId || !templateId) {
    return NextResponse.json({ ok: false, error: 'Paramètres manquants' }, { status: 400 });
  }

  try {
    await deleteTemplate(spreadsheetId, templateId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
