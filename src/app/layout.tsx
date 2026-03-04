import type { Metadata } from 'next';
import { Libre_Franklin } from 'next/font/google';
import { Header } from '@/components/ui/header';
import { Providers } from '@/components/ui/providers';
import '@/styles/crossword-styles.css';

const libreFranklin = Libre_Franklin({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-franklin',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Crossword App',
  description: 'Create and share crossword puzzles',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={libreFranklin.variable}>
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/ubq6oda.css" />
      </head>
      <body>
        <Providers>
          <div className="container">
            <Header />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
