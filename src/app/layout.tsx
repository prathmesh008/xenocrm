import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { Button } from '@/components/ui/button';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import Link from 'next/link';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Xeno CRM Platform',
  description: 'Mini CRM for customer segmentation and campaigns',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen`}>
        <Providers>
          <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-white/20 p-4 flex justify-between items-center sticky top-0 z-50">
            {session ? (
              <Link href="/dashboard">
                <div className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-500 hover:scale-105 transition-transform duration-300">
                  Xeno CRM
                </div>
              </Link>
            ) : (
              <Link href="/">
                <div className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-500 hover:scale-105 transition-transform duration-300">
                  Xeno CRM
                </div>
              </Link>
            )}

            <div className="space-x-4">
              {session ? (
                <Link href="/api/auth/signout">
                  <Button variant="outline">Sign Out</Button>
                </Link>
              ) : (
                <Link href="/api/auth/signin">
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-500 text-white hover:scale-105 transition-all duration-300">
                    Sign In with Google
                  </Button>
                </Link>
              )}
            </div>
          </nav>
          <main className="container mx-auto p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
