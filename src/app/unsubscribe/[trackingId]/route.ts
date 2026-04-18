import { NextRequest, NextResponse } from 'next/server';
import { recordElectronUnsubscribe } from '@/lib/sheets';

export async function GET(
  _req: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  const { trackingId } = params;

  if (trackingId) {
    recordElectronUnsubscribe(trackingId).catch(console.error);
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Désinscription confirmée</title>
  <style>
    body { font-family: -apple-system, Arial, sans-serif; display: flex; align-items: center;
           justify-content: center; height: 100vh; margin: 0; background: #f9f9f9; color: #333; }
    .box { text-align: center; padding: 40px; background: #fff; border-radius: 8px;
           box-shadow: 0 2px 12px rgba(0,0,0,0.08); max-width: 400px; }
    h1 { font-size: 20px; margin-bottom: 12px; }
    p  { font-size: 14px; color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="box">
    <h1>✓ Désinscription confirmée</h1>
    <p>Vous avez bien été retiré de cette liste de diffusion.<br/>Vous ne recevrez plus d'emails de notre part.</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
