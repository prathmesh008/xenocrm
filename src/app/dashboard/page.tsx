import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import connectDB from "@/lib/mongoose";
import Customer from "@/models/Customer";
import Campaign from "@/models/Campaign";
import Link from "next/link";
import { Users, Megaphone, BarChart2 } from "lucide-react";
import DashboardCharts from "@/components/DashboardCharts";

async function getDashboardMetrics(userId: string) {
  await connectDB();
  const [customerCount, campaignCount] = await Promise.all([
    Customer.countDocuments(),
    Campaign.countDocuments({
      $or: [{ userId }, { userId: 'system' }],
    }),
  ]);
  return { customerCount, campaignCount };
}

export default async function Dashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-red-600">
          Please sign in to access the dashboard
        </h1>
        <Link href="/auth/signin">
          <Button className="mt-4">Sign In</Button>
        </Link>
      </div>
    );
  }

  const { customerCount, campaignCount } =
    await getDashboardMetrics((session.user as any).id || session.user.email || 'system');

  return (
    <div className="py-8 space-y-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">
            Welcome, {session.user.name?.split(' ')[0] || 'User'}! 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here&apos;s what&apos;s happening with your campaigns today.
          </p>
        </div>
        <div className="space-x-3">
          <Link href="/dashboard/customers">
            <Button variant="outline">View Customers</Button>
          </Link>
          <Link href="/dashboard/segments">
            <Button variant="default">Create Segment</Button>
          </Link>
          <Link href="/dashboard/campaigns">
            <Button variant="outline">View Campaigns</Button>
          </Link>
        </div>
      </div>

      {/* ── Top stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-card micro-anim border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Customers
            </CardTitle>
            <div className="p-2 bg-violet-100 rounded-lg">
              <Users className="h-4 w-4 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-violet-700">
              {customerCount.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">All registered customers</p>
            <Link href="/dashboard/customers">
              <p className="text-xs text-violet-500 mt-2 hover:underline cursor-pointer">
                View all →
              </p>
            </Link>
          </CardContent>
        </Card>

        <Card className="glass-card micro-anim border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Campaigns
            </CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Megaphone className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">
              {campaignCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">Campaigns created by you</p>
            <Link href="/dashboard/campaigns">
              <p className="text-xs text-blue-500 mt-2 hover:underline cursor-pointer">
                View all →
              </p>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* ── Analytics section header ────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-gray-500" />
        <h2 className="text-xl font-semibold text-gray-800">Analytics</h2>
      </div>

      {/* ── Charts (client component — fetches its own data) ────────── */}
      <DashboardCharts />
    </div>
  );
}