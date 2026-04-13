import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCampaigns, saveCampaign, getTrackingForCampaign } from '@/lib/sheets';
import type { Campaign } from '@/lib/types';

// GET /api/campaigns?spreadsheetId=xxx&campaignId=yyy (campaignId optionnel)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });

  const spreadsheetId = req.nextUrl.searchParams.get('spreadsheetId');
  const campaignId = req.nextUrl.searchParams.get('campaignId');

  if (!spreadsheetId) {
    return NextResponse.json({ ok: false, error: 'spreadsheetId manquant' }, { status: 400 });
  }

  try {
    const campaigns = await getCampaigns(spreadsheetId);

    if (campaignId) {
      const campaign = campaigns.find((c) => c.id === campaignId);
      if (!campaign) return NextResponse.json({ ok: false, error: 'Campagne introuvable' }, { status: 404 });

      // Enrichir avec le tracking
      const tracking = await getTrackingForCampaign(campaignId);
      const enriched = {
        ...campaign,
        totalContacts: tracking.length,
        sent: tracking.filter((t) => t.sentAt).length,
        opened: tracking.filter((t) => t.openedAt).length,
        clicked: tracking.filter((t) => t.clickedAt).length,
        tracking,
      };
      return NextResponse.json({ ok: true, data: enriched });
    }

    // Enrichir toutes les campagnes avec les stats
    const enrichedCampaigns = await Promise.all(
      campaigns.map(async (c) => {
        const tracking = await getTrackingForCampaign(c.id);
        return {
          ...c,
          totalContacts: tracking.length,
          sent: tracking.filter((t) => t.sentAt).length,
          opened: tracking.filter((t) => t.openedAt).length,
          clicked: tracking.filter((t) => t.clickedAt).length,
        };
      })
    );

    return NextResponse.json({ ok: true, data: enrichedCampaigns });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// POST /api/campaigns — créer ou mettre à jour une campagne
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const { spreadsheetId, campaign } = body as { spreadsheetId: string; campaign: Campaign };

  if (!spreadsheetId || !campaign) {
    return NextResponse.json({ ok: false, error: 'Paramètres manquants' }, { status: 400 });
  }

  try {
    await saveCampaign(spreadsheetId, campaign);
    return NextResponse.json({ ok: true, data: campaign });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
