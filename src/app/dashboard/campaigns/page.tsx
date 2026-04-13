'use client';
import { useEffect, useState } from 'react';
import type { Campaign, Template, Workspace } from '@/lib/types';
import { uuidv4 } from '@/lib/utils';
import Link from 'next/link';

export default function CampaignsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const el = document.getElementById('active-workspace-id');
    const spreadsheetId = el?.dataset.sheet;
    const workspaceId = el?.dataset.id;
    if (!spreadsheetId || !workspaceId) return;

    const stored: Workspace[] = JSON.parse(localStorage.getItem('ekke_workspaces') || '[]');
    const ws = stored.find((w) => w.id === workspaceId);
    if (ws) setWorkspace(ws);

    Promise.all([
      fetch(`/api/campaigns?spreadsheetId=${spreadsheetId}`).then((r) => r.json()),
      fetch(`/api/templates?spreadsheetId=${spreadsheetId}`).then((r) => r.json()),
    ]).then(([c, t]) => {
      if (c.ok) setCampaigns(c.data);
      if (t.ok) setTemplates(t.data);
    }).finally(() => setLoading(false));
  }, []);

  const statusStyle = (s: string) => ({
    draft: { label: 'Brouillon', color: 'var(--text-secondary)', bg: 'rgba(120,120,160,0.1)' },
    active: { label: 'Active', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    paused: { label: 'En pause', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    completed: { label: 'Terminée', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  } as Record<string, { label: string; color: string; bg: string }>)[s] || { label: s, color: 'var(--text-secondary)', bg: 'transparent' };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Campagnes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {campaigns.length} campagne{campaigns.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          + Nouvelle campagne
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl py-16 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Aucune campagne</p>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--accent)', color: 'white' }}>
            Créer la première campagne
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => {
            const st = statusStyle(c.statut);
            const openRate = c.sent ? Math.round(((c.opened || 0) / c.sent) * 100) : 0;
            return (
              <Link key={c.id} href={`/dashboard/campaigns/${c.id}`}
                className="flex items-center gap-6 px-6 py-4 rounded-2xl"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ background: workspace?.contactTypes.find((ct) => ct.id === c.contactType)?.color || 'var(--accent)' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.nom}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {workspace?.contactTypes.find((ct) => ct.id === c.contactType)?.label || c.type}
                  </p>
                </div>
                <div className="flex items-center gap-8 text-sm">
                  <div className="text-center">
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.sent || 0}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>envoyés</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold" style={{ color: 'var(--accent-light)' }}>{openRate}%</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>ouverture</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold" style={{ color: '#34d399' }}>{c.clicked || 0}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>clics</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium flex-shrink-0"
                  style={{ background: st.bg, color: st.color }}>
                  {st.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {showCreate && workspace && (
        <CreateCampaignModal
          workspace={workspace}
          templates={templates}
          onClose={() => setShowCreate(false)}
          onCreate={(campaign) => { setCampaigns((prev) => [campaign, ...prev]); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

function CreateCampaignModal({ workspace, templates, onClose, onCreate }: {
  workspace: Workspace;
  templates: Template[];
  onClose: () => void;
  onCreate: (c: Campaign) => void;
}) {
  const [nom, setNom] = useState('');
  const [contactType, setContactType] = useState(workspace.contactTypes[0]?.id || '');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedCt = workspace.contactTypes.find((ct) => ct.id === contactType);

  async function handleCreate() {
    if (!nom || !contactType || selectedTemplates.length === 0) {
      setError('Remplis tous les champs et sélectionne au moins un template');
      return;
    }
    setLoading(true);
    setError('');
    const campaign: Campaign = {
      id: uuidv4(),
      nom,
      type: selectedCt?.label || contactType,
      contactType,
      tabName: selectedCt?.tabName || '',
      templateIds: selectedTemplates,
      delays: workspace.delays || [0, 14, 30],
      statut: 'draft',
      dateCreation: new Date().toISOString(),
      dateDerniereAction: '',
      notes,
    };
    const el = document.getElementById('active-workspace-id');
    const spreadsheetId = el?.dataset.sheet;
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId, campaign }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) onCreate(campaign);
    else setError(data.error);
  }

  function toggleTemplate(id: string) {
    setSelectedTemplates((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Nouvelle campagne</h3>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>✕</button>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              Nom de la campagne
            </label>
            <input value={nom} onChange={(e) => setNom(e.target.value)}
              placeholder="ex: Booking printemps 2025"
              className="w-full px-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Type de contacts</label>
            <div className="flex flex-wrap gap-2">
              {workspace.contactTypes.map((ct) => (
                <button key={ct.id} onClick={() => setContactType(ct.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm"
                  style={{
                    background: contactType === ct.id ? ct.color + '33' : 'var(--surface)',
                    color: contactType === ct.id ? ct.color : 'var(--text-secondary)',
                    border: `1px solid ${contactType === ct.id ? ct.color : 'var(--border)'}`,
                  }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: ct.color }} />
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              Séquence de templates{' '}
              <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>
                (ordre : mail initial → relances)
              </span>
            </label>
            {templates.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Aucun template — crée-en dans la section Templates
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {templates.map((t) => (
                  <button key={t.id} onClick={() => toggleTemplate(t.id)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm"
                    style={{
                      background: selectedTemplates.includes(t.id) ? 'rgba(124,58,237,0.15)' : 'var(--surface)',
                      border: `1px solid ${selectedTemplates.includes(t.id) ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
                      color: 'var(--text-primary)',
                    }}>
                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs flex-shrink-0"
                      style={{ background: selectedTemplates.includes(t.id) ? 'var(--accent)' : 'var(--border)', color: 'white' }}>
                      {selectedTemplates.includes(t.id) ? selectedTemplates.indexOf(t.id) + 1 : ''}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{t.nom}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{t.sujet}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Notes (optionnel)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-4 py-2.5 rounded-xl text-sm resize-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
          </div>
          {error && (
            <p className="text-sm px-3 py-2 rounded-xl"
              style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>{error}</p>
          )}
        </div>
        <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl"
            style={{ color: 'var(--text-secondary)' }}>Annuler</button>
          <button onClick={handleCreate} disabled={loading}
            className="px-5 py-2 text-sm rounded-xl font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}>
            {loading ? '…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
