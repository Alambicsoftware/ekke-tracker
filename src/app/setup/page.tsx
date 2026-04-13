'use client';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { Workspace } from '@/lib/types';
import { TYPE_COLORS } from '@/lib/utils';

const DEFAULT_TYPES = [
  { id: 'booking_concert', label: 'Booking Concert' },
  { id: 'agences_booking', label: 'Agences Booking' },
  { id: 'presse', label: 'Presse' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'promo_dj', label: 'Promo DJ' },
];

export default function SetupPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('EKKE');
  const [sheetUrl, setSheetUrl] = useState('');
  const [fromName, setFromName] = useState('EKKE');
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const serviceEmail = process.env.NEXT_PUBLIC_SERVICE_EMAIL || '(voir les paramètres Vercel)';

  function addType() {
    if (!newTypeLabel.trim()) return;
    setTypes([...types, {
      id: newTypeLabel.toLowerCase().replace(/\s+/g, '_'),
      label: newTypeLabel.trim(),
    }]);
    setNewTypeLabel('');
  }

  function removeType(id: string) {
    setTypes(types.filter((t) => t.id !== id));
  }

  async function handleCreate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetUrl,
          name,
          fromName,
          contactTypes: types,
          delays: [0, 14, 30],
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const workspace = data.data as Workspace;

      // Sauvegarder dans la session
      const currentWorkspaces = session?.workspaces || [];
      await update({
        workspaces: [...currentWorkspaces, workspace],
        activeWorkspaceId: workspace.id,
      });

      // Sauvegarder aussi en localStorage comme backup
      const stored = JSON.parse(localStorage.getItem('ekke_workspaces') || '[]');
      stored.push(workspace);
      localStorage.setItem('ekke_workspaces', JSON.stringify(stored));
      localStorage.setItem('ekke_active_workspace', workspace.id);

      router.push('/dashboard');
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.12) 0%, transparent 70%)',
        }}
      />

      <div
        className="relative z-10 w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: 'var(--accent)', color: 'white' }}>E</div>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Configuration du workspace</span>
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            {step === 1 ? 'Informations du workspace' : step === 2 ? 'Préparation du Google Sheet' : 'Types de contacts'}
          </p>
          {/* Steps */}
          <div className="flex gap-1 mt-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="h-1 flex-1 rounded-full"
                style={{ background: s <= step ? 'var(--accent)' : 'var(--border)' }} />
            ))}
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Step 1: Infos */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Nom du workspace
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: EKKE, Jérémie ingé son…"
                  className="w-full px-4 py-2.5 rounded-xl text-sm"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Nom de l'expéditeur (dans les mails)
                </label>
                <input
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="ex: EKKE"
                  className="w-full px-4 py-2.5 rounded-xl text-sm"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 2: Google Sheet */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div
                className="p-4 rounded-xl text-sm"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}
              >
                <p className="font-medium mb-2" style={{ color: 'var(--accent-light)' }}>
                  📋 Avant de continuer :
                </p>
                <ol className="flex flex-col gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <li>1. Crée un nouveau Google Sheet</li>
                  <li>
                    2. Partage-le avec ce compte de service :
                    <code
                      className="block mt-1 px-3 py-1.5 rounded-lg text-xs font-mono break-all"
                      style={{ background: 'var(--surface)', color: 'var(--accent-light)' }}
                    >
                      {process.env.NEXT_PUBLIC_SERVICE_EMAIL || 'Voir variable SERVICE_ACCOUNT_EMAIL dans Vercel'}
                    </code>
                  </li>
                  <li>3. Donne-lui l'accès <strong>Éditeur</strong></li>
                </ol>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  URL ou ID du Google Sheet
                </label>
                <input
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-mono"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 3: Types de contacts */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Ces types créeront des onglets séparés dans ton sheet pour chaque catégorie de contacts.
              </p>
              <div className="flex flex-col gap-2">
                {types.map((t, i) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }}
                    />
                    <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{t.label}</span>
                    <button
                      onClick={() => removeType(t.id)}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addType()}
                  placeholder="Ajouter un type…"
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={addType}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  +
                </button>
              </div>

              {error && (
                <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-8 pb-8 flex items-center justify-between"
          style={{ paddingTop: '0' }}
        >
          <button
            onClick={() => step === 1 ? signOut({ callbackUrl: '/' }) : setStep(step - 1)}
            className="text-sm px-4 py-2 rounded-xl"
            style={{ color: 'var(--text-secondary)' }}
          >
            {step === 1 ? 'Déconnexion' : '← Retour'}
          </button>
          <button
            onClick={() => step < 3 ? setStep(step + 1) : handleCreate()}
            disabled={loading || (step === 2 && !sheetUrl.trim()) || (step === 1 && !name.trim())}
            className="text-sm px-6 py-2.5 rounded-xl font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {loading ? 'Initialisation…' : step < 3 ? 'Continuer →' : '🚀 Créer le workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}
