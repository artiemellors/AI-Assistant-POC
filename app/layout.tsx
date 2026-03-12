import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Outfit Kurator — AI Personal Stylist for Kmart Australia',
  description:
    'Describe the look you want and get complete outfit recommendations from Kmart Australia with real prices and direct links.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* AnkoModerat is loaded via @font-face in globals.css from the Kmart Kosmos design system CDN */}
        {/* Preconnect to the Kosmos Storybook CDN for faster font loading */}
        <link rel="preconnect" href="https://kmartau.github.io" />
      </head>
      <body>{children}</body>
    </html>
  );
}
