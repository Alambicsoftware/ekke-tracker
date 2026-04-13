'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { TrackingEvent, Campaign } from '@/lib/types';
import { formatDateTime, STATUS_CONFIG } from '@/lib/utils';

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="p-5 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </p>
          <p className="text-3xl font-bold" style={{ color }}>{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tracking, setTracking] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const el = document.getElementById('active-workspace-id');
    const spreadsheetId = el?.dataset.sheet;
    const workspaceId = el?.dataset.id;
    if (!spreadsheetId || !workspaceId) return;

    async function load() {
      try {
        const [cRes] = await Promise.all([
          fetch(`/api/campaigns?spreadsheetId=${spreadsheetId}`),
        ]);
        const cData = await cRes.json();
        if (cData.ok) setCampaigns(cData.data || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalSent = campaigns.reduce((s, c) => s + (c.sent || 0), 0);
  const totalOpened = campaigns.reduce((s, c) => s + (c.opened || 0), 0);
  const totalClicked = campaigns.reduce((s, c) => s + (c.clicked || 0), 0);
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

  const activeCampaigns = campaigns.filter((c) => c.statut === 'active');

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Vue d'ensemble
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Bonjour {session?.user?.name?.split(' ')[0]} 👋
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8 xl:grid-cols-4">
        <StatCard label="Mails envoyés" value={totalSent} color="var(--text-primary)" />
        <StatCard label="Taux d'ouverture" value={`${openRate}%`} sub={`${totalOpened} ouvertures`} color="var(--accent-light)" />
        <StatCard label="Clics" value={totalClicked} color="#34d399" />
        <StatCard label="Campagnes actives" value={activeCampaigns.length} color="#f59e0b" />
      </div>

      {/* Campagnes récentes */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Campagnes</h2>
          <a href="/dashboard/campaigns" className="text-xs" style={{ color: 'var(--accent-light)' }}>
            Voir tout →
          </a>
        </div>
        {campaigns.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Aucune campagne pour l'instant
            </p>
            <a
              href="/dashboard/campaigns"
              className="inline-flex px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              Créer une campagne
            </a>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {campaigns.slice(0, 5).map((c) => (
              <a
                key={c.id}
                href={`/dashboard/campaigns/${c.id}`}
                className="flex items-center gap-4 px-6 py-4 block"
                style={{ color: 'inherit', textDecoration: 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.nom}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.type}</p>
                </div>
                <div className="flex items-center gap-6 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span>{c.sent || 0} envoyés</span>
                  <span style={{ color: 'var(--accent-light)' }}>{c.opened || 0} ouverts</span>
                  <span style={{ color: '#34d399' }}>{c.clicked || 0} cliqués</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      background: c.statut === 'active' ? 'rgba(16,185,129,0.15)' :
                        c.statut === 'paused' ? 'rgba(245,158,11,0.15)' : 'rgba(120,120,160,0.15)',
                      color: c.statut === 'active' ? '#10b981' :
                        c.statut === 'paused' ? '#f59e0b' : 'var(--text-secondary)',
                    }}
                  >
                    {c.statut === 'active' ? 'Active' : c.statut === 'paused' ? 'En pause' :
                      c.statut === 'draft' ? 'Brouillon' : 'Terminée'}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
