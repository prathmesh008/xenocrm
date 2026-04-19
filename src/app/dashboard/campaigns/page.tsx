import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import CampaignList from '@/components/CampaignList';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import ViewCampaignList from '@/components/ViewCampaign';

export default async function CampaignsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-red-600">Please sign in to view campaigns</h1>
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
          <h1 className="text-3xl font-bold text-primary">Campaign History</h1>
          <p className="text-muted-foreground mt-2">
            View all your past campaigns, including delivery stats and audience sizes.
          </p>
        </div>
        <Link href="/dashboard/segments">
          <Button variant="default">Create New Segment</Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <ViewCampaignList />
        </CardContent>
      </Card>
    </div>
  );
}