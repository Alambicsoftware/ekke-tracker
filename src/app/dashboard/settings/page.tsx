'use client';
import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { Workspace } from '@/lib/types';
import { TYPE_COLORS } from '@/lib/utils';

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState('');
  const [serviceEmail, setServiceEmail] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = document.getElementById('active-workspace-id');
    const workspaceId = el?.dataset.id;
    if (workspaceId) setActiveId(workspaceId);

    const stored: Workspace[] = JSON.parse(localStorage.getItem('ekke_workspaces') || '[]');
    setWorkspaces(stored);

    // Récupérer l'email du service account
    fetch('/api/workspace?getServiceEmail=1')
      .then((r) => r.json())
      .then((d) => { if (d.serviceEmail) setServiceEmail(d.serviceEmail); });
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeId);

  async function deleteWorkspace(wsId: string) {
    if (!confirm('Supprimer ce workspace ? (le Google Sheet ne sera pas effacé)')) return;
    const updated = workspaces.filter((w) => w.id !== wsId);
    setWorkspaces(updated);
    localStorage.setItem('ekke_workspaces', JSON.stringify(updated));

    if (wsId === activeId) {
      const newActive = updated[0]?.id || '';
      setActiveId(newActive);
      localStorage.setItem('ekke_active_workspace', newActive);
      await update({ activeWorkspaceId: newActive });
      if (!newActive) router.push('/setup');
    }
  }

  async function copyEmail() {
    if (!serviceEmail) return;
    await navigator.clipboard.writeText(serviceEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>Paramètres</h1>

      {/* Compte Google */}
      <Section title="Compte Google">
        <div className="flex items-center gap-4">
          {session?.user?.image && (
            <img src={session.user.image} alt="" className="w-10 h-10 rounded-full" />
          )}
          <div className="flex-1">
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{session?.user?.name}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{session?.user?.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="px-4 py-2 rounded-xl text-sm"
            style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}
          >
            Déconnexion
          </button>
        </div>
      </Section>

      {/* Compte de service */}
      <Section title="Compte de service (tracking)">
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Pour que le tracking fonctionne, partage chaque Google Sheet avec cette adresse (accès Éditeur) :
        </p>
        <div className="flex items-center gap-3">
          <code
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-mono break-all"
            style={{ background: 'var(--surface)', color: 'var(--accent-light)', border: '1px solid var(--border)' }}
          >
            {serviceEmail || 'Voir SERVICE_ACCOUNT_EMAIL dans les variables Vercel'}
          </code>
          {serviceEmail && (
            <button onClick={copyEmail}
              className="px-3 py-2.5 rounded-xl text-xs font-medium flex-shrink-0"
              style={{
                background: copied ? 'rgba(16,185,129,0.15)' : 'var(--surface)',
                color: copied ? '#10b981' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}>
              {copied ? '✓ Copié' : 'Copier'}
            </button>
          )}
        </div>
      </Section>

      {/* Workspaces */}
      <Section title="Workspaces">
        <div className="flex flex-col gap-3 mb-4">
          {workspaces.map((ws, i) => (
            <div key={ws.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
              style={{
                background: ws.id === activeId ? 'rgba(124,58,237,0.1)' : 'var(--surface)',
                border: `1px solid ${ws.id === activeId ? 'rgba(124,58,237,0.3)' : 'var(--border)'}`,
              }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: TYPE_COLORS[i % TYPE_COLORS.length], color: 'white' }}>
                {ws.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{ws.name}</p>
                  {ws.id === activeId && (
                    <span className="px-1.5 py-0.5 rounded text-xs"
                      style={{ background: 'rgba(124,58,237,0.2)', color: 'var(--accent-light)' }}>actif</span>
                  )}
                </div>
                <p className="text-xs mt-0.5 font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                  {ws.spreadsheetId}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {ws.contactTypes.map((ct) => (
                    <span key={ct.id} className="px-1.5 py-0.5 rounded text-xs"
                      style={{ background: ct.color + '22', color: ct.color }}>
                      {ct.label}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => deleteWorkspace(ws.id)}
                className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                Supprimer
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => router.push('/setup')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'white' }}>
          + Ajouter un workspace
        </button>
      </Section>

      {/* Délais de relance */}
      {activeWorkspace && (
        <Section title={`Délais de relance — ${activeWorkspace.name}`}>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Jours minimum entre chaque envoi pour ce workspace.
          </p>
          <div className="flex items-center gap-3">
            {activeWorkspace.delays.map((d, i) => (
              <div key={i} className="text-center">
                <div className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                  {i === 0 ? 'Immédiat' : `J+${d}`}
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {i === 0 ? 'Mail initial' : `Relance ${i}`}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
            Pour modifier les délais, crée un nouveau workspace avec les délais souhaités.
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-secondary)' }}>
        {title}
      </h2>
      <div className="p-5 rounded-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {children}
      </div>
    </div>
  );
}
