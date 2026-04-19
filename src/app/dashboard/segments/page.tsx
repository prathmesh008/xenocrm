import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SegmentForm from '@/components/SegmentForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function SegmentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-red-600">Please sign in to create segments</h1>
        <Link href="/auth/signin">
          <Button className="mt-4">Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Create Audience Segments</h1>
          <p className="text-muted-foreground mt-2">
            Define customer segments using flexible rules to target your campaigns effectively.
          </p>
        </div>
        <Link href="/dashboard/campaigns">
          <Button variant="outline">View Campaigns</Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New Segment</CardTitle>
        </CardHeader>
        <CardContent>
          <SegmentForm />
        </CardContent>
      </Card>
    </div>
  );
}