'use client';

/**
 * Custom sign-out page — replaces the default NextAuth /api/auth/signout page.
 * Add NEXTAUTH_URL to your .env.local and set:
 *   pages: { signOut: '/auth/signout' }
 * in your authOptions to use this page.
 */

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default function SignOutPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="p-4 bg-red-50 rounded-full">
            <LogOut className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900">Sign out?</h2>
          <p className="text-sm text-gray-500 mt-1">
            You&apos;ll need to sign in again to access your campaigns.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleSignOut}
            className="w-full bg-red-500 hover:bg-red-600 text-white"
          >
            Yes, sign me out
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/dashboard')}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}