import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gemini Studio',
  description: 'Google AI Studio alternative powered by Gemini API',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ height: '100vh', overflow: 'hidden' }}>{children}</body>
    </html>
  );
}
