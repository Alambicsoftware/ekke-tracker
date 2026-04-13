'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Workspace } from '@/lib/types';
import Link from 'next/link';

const NAV = [
  { href: '/dashboard', label: 'Vue d\'ensemble', icon: '◈' },
  { href: '/dashboard/contacts', label: 'Contacts', icon: '⊕' },
  { href: '/dashboard/campaigns', label: 'Campagnes', icon: '✉' },
  { href: '/dashboard/templates', label: 'Templates', icon: '◧' },
  { href: '/dashboard/settings', label: 'Paramètres', icon: '⚙' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [showWsMenu, setShowWsMenu] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/'); return; }
    if (status !== 'authenticated') return;

    // Charger les workspaces depuis session + localStorage
    const sessionWs = session?.workspaces || [];
    const stored: Workspace[] = JSON.parse(localStorage.getItem('ekke_workspaces') || '[]');

    // Fusionner (session prioritaire)
    const merged = [...sessionWs];
    for (const sw of stored) {
      if (!merged.find((w) => w.id === sw.id)) merged.push(sw);
    }
    setWorkspaces(merged);

    const activeFromSession = session?.activeWorkspaceId;
    const activeFromStorage = localStorage.getItem('ekke_active_workspace');
    const active = activeFromSession || activeFromStorage || merged[0]?.id || '';
    setActiveId(active);

    if (merged.length === 0) router.push('/setup');
  }, [status, session, router]);

  const activeWorkspace = workspaces.find((w) => w.id === activeId);

  async function switchWorkspace(ws: Workspace) {
    setActiveId(ws.id);
    localStorage.setItem('ekke_active_workspace', ws.id);
    await update({ activeWorkspaceId: ws.id });
    setShowWsMenu(false);
    router.refresh();
  }

  if (status === 'loading' || !activeWorkspace) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside
        className="w-60 flex-shrink-0 flex flex-col fixed inset-y-0 left-0 z-40"
        style={{
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Workspace switcher */}
        <div className="p-4 relative" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setShowWsMenu(!showWsMenu)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
            style={{
              background: showWsMenu ? 'var(--card)' : 'transparent',
              border: '1px solid ' + (showWsMenu ? 'var(--accent)' : 'var(--border)'),
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {activeWorkspace.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {activeWorkspace.name}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {activeWorkspace.contactTypes.length} type{activeWorkspace.contactTypes.length > 1 ? 's' : ''}
              </p>
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>▼</span>
          </button>

          {/* Dropdown workspaces */}
          {showWsMenu && (
            <div
              className="absolute top-full left-4 right-4 mt-1 rounded-xl overflow-hidden z-50"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}
            >
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => switchWorkspace(ws)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm"
                  style={{
                    background: ws.id === activeId ? 'rgba(124,58,237,0.15)' : 'transparent',
                    color: ws.id === activeId ? 'var(--accent-light)' : 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    if (ws.id !== activeId) e.currentTarget.style.background = 'var(--surface)';
                  }}
                  onMouseLeave={(e) => {
                    if (ws.id !== activeId) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                    style={{ background: 'var(--accent)', color: 'white' }}
                  >
                    {ws.name.slice(0, 1).toUpperCase()}
                  </div>
                  {ws.name}
                </button>
              ))}
              <div style={{ borderTop: '1px solid var(--border)' }}>
                <Link
                  href="/setup"
                  onClick={() => setShowWsMenu(false)}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  + Nouveau workspace
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: isActive ? 'rgba(124,58,237,0.2)' : 'transparent',
                  color: isActive ? 'var(--accent-light)' : 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--card)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt="avatar"
                className="w-8 h-8 rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {session?.user?.name || session?.user?.email}
              </p>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-xs"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-60 min-h-screen">
        {/* Pass active workspace via context via a hidden element */}
        <div id="active-workspace-id" data-id={activeId} data-sheet={activeWorkspace.spreadsheetId} className="hidden" />
        {children}
      </main>
    </div>
  );
}
