import type { Metadata } from 'next';
import Script from 'next/script';
import { Libre_Franklin } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
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
  metadataBase: new URL(
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ),
  title: 'Crossword App',
  description: 'Create and share crossword puzzles',
  openGraph: {
    title: 'Crossword App',
    description: 'Create and share crossword puzzles',
    url: '/',
    siteName: 'Crossword App',
    locale: 'en_US',
    type: 'website',
    images: [{
      url: '/og-crossword.png',
      width: 1200,
      height: 630,
      alt: 'Crossword puzzle grid',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crossword App',
    description: 'Create and share crossword puzzles',
    images: [{ url: '/og-crossword.png', alt: 'Crossword puzzle grid' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={libreFranklin.variable}>
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZTFF244QTT"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-ZTFF244QTT');`,
          }}
        />
        <link rel="stylesheet" href="https://use.typekit.net/ubq6oda.css" />
      </head>
      <body>
        <Providers>
          <div className="container">
            <Header />
            {children}
          </div>
        </Providers>
        <Analytics />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-ZTFF244QTT"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-ZTFF244QTT');
          `}
        </Script>
      </body>
    </html>
  );
}
