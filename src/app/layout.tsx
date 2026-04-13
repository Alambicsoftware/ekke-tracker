import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from './SessionProvider';

export const metadata: Metadata = {
  title: 'EKKE Mailer',
  description: 'Gestion des démarchages EKKE',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
