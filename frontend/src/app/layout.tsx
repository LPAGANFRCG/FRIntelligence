import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrunkRAG AEC | Intelligent Construction Drawing & Spec Inspector',
  description: 'Zero-friction construction document & blueprint intelligence connected to Vertex AI RAG',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="h-screen w-screen overflow-hidden flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
