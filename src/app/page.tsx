'use client';
import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      const workspaces = session?.workspaces || [];
      if (workspaces.length === 0) {
        router.push('/setup');
      } else {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.15) 0%, transparent 70%)',
        }}
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 p-10 rounded-2xl flex flex-col items-center gap-8"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            E
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            EKKE Mailer
          </h1>
          <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
            Gestion des démarchages par mail
          </p>
        </div>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: 'var(--border)' }} />

        {/* Login button */}
        <button
          onClick={() => signIn('google')}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-medium text-sm"
          style={{
            background: 'white',
            color: '#1a1a2e',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
          </svg>
          Se connecter avec Google
        </button>

        <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
          Accès à Gmail (envoi) et Google Sheets requis
        </p>
      </div>

      {/* Version */}
      <p className="relative z-10 mt-6 text-xs" style={{ color: 'var(--text-secondary)' }}>
        v2.0 — Catwalk → EKKE Mailer
      </p>
    </div>
  );
}
