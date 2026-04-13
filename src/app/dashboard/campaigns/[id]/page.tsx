'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Campaign, TrackingEvent, Workspace } from '@/lib/types';
import { STATUS_CONFIG, getDisplayStatus, formatDateTime, formatDate } from '@/lib/utils';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [tracking, setTracking] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const el = document.getElementById('active-workspace-id');
    const spreadsheetId = el?.dataset.sheet;
    const workspaceId = el?.dataset.id;
    if (!spreadsheetId || !workspaceId) return;

    const stored: Workspace[] = JSON.parse(localStorage.getItem('ekke_workspaces') || '[]');
    const ws = stored.find((w) => w.id === workspaceId);
    if (ws) setWorkspace(ws);

    fetch(`/api/campaigns?spreadsheetId=${spreadsheetId}&campaignId=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setCampaign(data.data);
          setTracking(data.data.tracking || []);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function updateStatus(statut: Campaign['statut']) {
    if (!campaign || !workspace) return;
    const el = document.getElementById('active-workspace-id');
    const spreadsheetId = el?.dataset.sheet;
    await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId, campaign: { ...campaign, statut } }),
    });
    setCampaign((prev) => prev ? { ...prev, statut } : prev);
  }

  async function handleSend() {
    if (!campaign || !workspace) return;
    setSending(true);
    setSendResult('');
    const el = document.getElementById('active-workspace-id');
    const spreadsheetId = el?.dataset.sheet;
    const workspaceId = el?.dataset.id;

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId,
          tabName: campaign.tabName,
          campaignId: campaign.id,
          workspaceId,
          templateIds: campaign.templateIds,
          delays: campaign.delays,
          fromName: workspace.name,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSendResult(`✓ ${data.data.sent} mail(s) envoyé(s)`);
        // Activer la campagne si brouillon
        if (campaign.statut === 'draft') await updateStatus('active');
        // Recharger les stats
        setTimeout(() => {
          fetch(`/api/campaigns?spreadsheetId=${spreadsheetId}&campaignId=${id}`)
            .then((r) => r.json())
            .then((d) => { if (d.ok) { setCampaign(d.data); setTracking(d.data.tracking || []); }});
        }, 3000);
      } else {
        setSendResult(`Erreur: ${data.error}`);
      }
    } finally {
      setSending(false);
    }
  }

  const filteredTracking = tracking.filter((t) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'opened') return !!t.openedAt;
    if (statusFilter === 'clicked') return !!t.clickedAt;
    if (statusFilter === 'pending') return !t.openedAt;
    return true;
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: 'var(--text-secondary)' }}>Campagne introuvable</p>
        <button onClick={() => router.push('/dashboard/campaigns')}
          className="mt-4 text-sm" style={{ color: 'var(--accent-light)' }}>← Retour</button>
      </div>
    );
  }

  const openRate = campaign.sent ? Math.round(((campaign.opened || 0) / campaign.sent) * 100) : 0;
  const clickRate = campaign.sent ? Math.round(((campaign.clicked || 0) / campaign.sent) * 100) : 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <button
            onClick={() => router.push('/dashboard/campaigns')}
            className="text-sm mb-3 flex items-center gap-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            ← Campagnes
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{campaign.nom}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {workspace?.contactTypes.find((ct) => ct.id === campaign.contactType)?.label || campaign.type}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Statut */}
          <select
            value={campaign.statut}
            onChange={(e) => updateStatus(e.target.value as Campaign['statut'])}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
          >
            <option value="draft">Brouillon</option>
            <option value="active">Active</option>
            <option value="paused">En pause</option>
            <option value="completed">Terminée</option>
          </select>
          {/* Bouton envoyer */}
          <button
            onClick={handleSend}
            disabled={sending || campaign.statut === 'completed'}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {sending ? (
              <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />Envoi…</>
            ) : '✉ Envoyer / Relancer'}
          </button>
        </div>
      </div>

      {sendResult && (
        <div
          className="mb-6 px-4 py-3 rounded-xl text-sm"
          style={{
            background: sendResult.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(248,113,113,0.1)',
            color: sendResult.startsWith('✓') ? '#10b981' : '#f87171',
            border: `1px solid ${sendResult.startsWith('✓') ? 'rgba(16,185,129,0.3)' : 'rgba(248,113,113,0.3)'}`,
          }}
        >
          {sendResult}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Envoyés', value: campaign.sent || 0, color: 'var(--text-primary)' },
          { label: 'Ouverts', value: `${campaign.opened || 0} (${openRate}%)`, color: 'var(--accent-light)' },
          { label: 'Cliqués', value: `${campaign.clicked || 0} (${clickRate}%)`, color: '#34d399' },
          { label: 'Templates', value: campaign.templateIds.length, color: '#f59e0b' },
        ].map((s) => (
          <div key={s.label} className="p-5 rounded-2xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tableau des envois */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Suivi des envois
            <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>
              ({filteredTracking.length})
            </span>
          </h2>
          <div className="flex gap-2">
            {['all', 'pending', 'opened', 'clicked'].map((f) => (
              <button key={f}
                onClick={() => setStatusFilter(f)}
                className="px-3 py-1 rounded-lg text-xs font-medium"
                style={{
                  background: statusFilter === f ? 'var(--accent)' : 'var(--surface)',
                  color: statusFilter === f ? 'white' : 'var(--text-secondary)',
                }}>
                {f === 'all' ? 'Tous' : f === 'pending' ? 'Non ouverts' : f === 'opened' ? 'Ouverts' : 'Cliqués'}
              </button>
            ))}
          </div>
        </div>

        {filteredTracking.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {tracking.length === 0 ? 'Aucun envoi pour cette campagne' : 'Aucun résultat pour ce filtre'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Email', 'Envoyé le', 'Statut', 'Ouvert le', 'Clic le', 'Lien cliqué'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium"
                      style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTracking.map((t, i) => {
                  const hasOpened = !!t.openedAt;
                  const hasClicked = !!t.clickedAt;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                        {t.contactEmail}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatDateTime(t.sentAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            background: hasClicked ? 'rgba(52,211,153,0.15)' : hasOpened ? 'rgba(167,139,250,0.15)' : 'rgba(96,165,250,0.1)',
                            color: hasClicked ? '#34d399' : hasOpened ? 'var(--accent-light)' : '#60a5fa',
                          }}>
                          {hasClicked ? 'Cliqué' : hasOpened ? 'Ouvert' : 'Envoyé'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: hasOpened ? 'var(--accent-light)' : 'var(--text-secondary)' }}>
                        {formatDateTime(t.openedAt)}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: hasClicked ? '#34d399' : 'var(--text-secondary)' }}>
                        {formatDateTime(t.clickedAt)}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {t.clickedUrl ? (
                          <a href={t.clickedUrl} target="_blank" rel="noopener noreferrer"
                            className="hover:underline" style={{ color: '#34d399' }}>
                            {t.clickedUrl.replace(/^https?:\/\//, '').slice(0, 40)}…
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
