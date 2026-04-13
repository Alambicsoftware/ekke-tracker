import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getContacts, getTemplates, updateContactSystemCols, addTrackingEvent,
} from '@/lib/sheets';
import {
  sendEmail, personalizeTemplate, wrapLinks, addTrackingPixel,
  getUserEmail, findSentThreadId,
} from '@/lib/gmail';
import { uuidv4, daysSince } from '@/lib/utils';
import type { SendResult } from '@/lib/types';

const STOP_STATUSES = ['REPLIED', 'UNSUBSCRIBED', 'BOUNCE'];
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ekke-tracker.vercel.app';
const DELAY_MS = 1500; // pause entre chaque envoi

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });
  }

  const body = await req.json();
  const {
    spreadsheetId,
    tabName,
    campaignId,
    workspaceId,
    templateIds,
    delays,
    fromName,
    contactRowIndexes, // optionnel — si non fourni, envoie à tous les contacts éligibles
  } = body as {
    spreadsheetId: string;
    tabName: string;
    campaignId: string;
    workspaceId: string;
    templateIds: string[];
    delays: number[];
    fromName: string;
    contactRowIndexes?: number[];
  };

  if (!spreadsheetId || !tabName || !campaignId || !templateIds?.length) {
    return NextResponse.json({ ok: false, error: 'Paramètres manquants' }, { status: 400 });
  }

  try {
    const userEmail = await getUserEmail(session.accessToken);
    const [{ headers, contacts }, templates] = await Promise.all([
      getContacts(spreadsheetId, tabName),
      getTemplates(spreadsheetId),
    ]);

    // Filtrer les templates de cette campagne dans l'ordre
    const campaignTemplates = templateIds
      .map((id) => templates.find((t) => t.id === id))
      .filter(Boolean) as typeof templates;

    if (!campaignTemplates.length) {
      return NextResponse.json({ ok: false, error: 'Aucun template trouvé pour cette campagne' }, { status: 400 });
    }

    const results: SendResult[] = [];
    let sentCount = 0;

    for (const contact of contacts) {
      // Filtrer sur les lignes demandées si précisé
      if (contactRowIndexes && !contactRowIndexes.includes(contact.rowIndex)) continue;

      // Ignorer les contacts bloqués ou stoppés
      if (!contact._relance_active) continue;
      if (STOP_STATUSES.includes(contact._statut.toUpperCase())) continue;
      if (!contact.email) continue;

      // Quel template envoyer ?
      const templateIndex = contact._nb_envois;
      if (templateIndex >= campaignTemplates.length) continue;

      // Vérifier le délai depuis le dernier envoi
      if (templateIndex > 0 && contact._date_envoi) {
        const days = daysSince(contact._date_envoi);
        const requiredDelay = delays[templateIndex] ?? 14;
        if (days !== null && days < requiredDelay) continue;
      }

      const template = campaignTemplates[templateIndex];

      // Générer ou réutiliser le contact ID
      const contactId = contact._contact_id || uuidv4();

      // Personnaliser le template
      const allData: Record<string, string> = { ...contact.data };
      // Aussi exposer les colonnes système utiles
      allData['email'] = contact.email;

      const { html: personalizedHtml, subject } = personalizeTemplate(
        template.bodyHtml,
        template.sujet,
        allData
      );

      // Ajouter tracking
      const trackedHtml = addTrackingPixel(
        wrapLinks(personalizedHtml, contactId, APP_URL),
        contactId,
        APP_URL
      );

      // Envoyer
      const result = await sendEmail(session.accessToken, {
        from: userEmail,
        fromName,
        to: contact.email,
        subject,
        htmlBody: trackedHtml,
        threadId: contact._thread_id || undefined,
      });

      if (result.success) {
        sentCount++;
        const now = new Date().toISOString();
        const newNbEnvois = contact._nb_envois + 1;
        const statut = templateIndex === 0 ? 'EMAIL_SENT' : `RELANCE_${templateIndex}`;

        // Mettre à jour le sheet
        await updateContactSystemCols(spreadsheetId, tabName, contact.rowIndex, {
          _statut: statut,
          _nb_envois: newNbEnvois,
          _date_envoi: now,
          _contact_id: contactId,
        });

        // Récupérer le thread ID si premier envoi
        let threadId = contact._thread_id;
        if (!threadId && result.threadId) {
          threadId = result.threadId;
          await updateContactSystemCols(spreadsheetId, tabName, contact.rowIndex, {
            _thread_id: threadId,
          });
        }

        // Enregistrer dans le tracking
        await addTrackingEvent({
          id: uuidv4(),
          contactId,
          campaignId,
          userEmail,
          workspaceId,
          spreadsheetId,
          tabName,
          rowIndex: contact.rowIndex,
          contactEmail: contact.email,
          sentAt: now,
          openedAt: '',
          clickedAt: '',
          clickedUrl: '',
          nbEnvois: newNbEnvois,
        });

        results.push({ email: contact.email, success: true, contactId });
      } else {
        results.push({ email: contact.email, success: false, error: result.error });
      }

      await sleep(DELAY_MS);
    }

    return NextResponse.json({
      ok: true,
      data: { sent: sentCount, results },
    });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
