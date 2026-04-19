'use client';

/**
 * DashboardCharts
 * Client component — fetches /api/dashboard/stats and renders:
 *  1. Bar chart: Sent vs Failed per recent campaign
 *  2. Pie chart:  Customer spend-tier distribution
 *  3. Summary stat cards (total sent, failed, overall success rate)
 */

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Send, XCircle } from 'lucide-react';

interface CampaignStat {
  name: string;
  sent: number;
  failed: number;
  audienceSize: number;
  successRate: number;
}

interface SpendTier {
  tier: string;
  count: number;
  color: string;
}

interface Summary {
  totalSent: number;
  totalFailed: number;
  overallSuccessRate: string;
}

interface StatsData {
  campaigns: CampaignStat[];
  spendTiers: SpendTier[];
  summary: Summary;
}

// Skeleton shimmer for loading state
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded-lg ${className ?? ''}`}
    />
  );
}

export default function DashboardCharts() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/stats')
        .then(async (r) => {
        // Guard: if the server returned HTML (404/500), throw a readable error
        const contentType = r.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(`API not found — check that src/app/api/dashboard/stats/route.ts exists`);
        }
        return r.json();
        })
        .then((d) => setData(d))
        .catch((err) => {
        console.error('Dashboard stats error:', err.message);
        setError(err.message);
        })
        .finally(() => setLoading(false));
    }, []);
    if (error) return (
  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
    ⚠️ {error}
  </div>
);
  /* ── Loading skeletons ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { campaigns, spendTiers, summary } = data;

  /* ── Custom tooltip for bar chart ──────────────────────────────── */
  const BarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-100 shadow-lg rounded-xl p-3 text-sm">
        <p className="font-semibold text-gray-700 mb-1 truncate max-w-[160px]">
          {label}
        </p>
        <p className="text-green-600">✉ Sent: {payload[0]?.value}</p>
        <p className="text-red-500">✕ Failed: {payload[1]?.value}</p>
      </div>
    );
  };

  /* ── Custom label for pie chart ─────────────────────────────────── */
  const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.04) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Summary mini-cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Send className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Messages Sent</p>
              <p className="text-2xl font-bold text-green-700">
                {summary.totalSent.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-rose-50">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-xl">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Failed</p>
              <p className="text-2xl font-bold text-red-600">
                {summary.totalFailed.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-violet-100 rounded-xl">
              <TrendingUp className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Overall Success Rate</p>
              <p className="text-2xl font-bold text-violet-700">
                {summary.overallSuccessRate}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart — Sent vs Failed per campaign */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-700">
              📊 Recent Campaign Performance
            </CardTitle>
            <p className="text-xs text-gray-400">Messages sent vs failed (last 7)</p>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">
                No campaigns yet — create your first one!
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={campaigns}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<BarTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  />
                  <Bar
                    dataKey="sent"
                    name="Sent"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="failed"
                    name="Failed"
                    fill="#f87171"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie chart — Customer spend tier distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-700">
              👥 Customer Spend Tiers
            </CardTitle>
            <p className="text-xs text-gray-400">Distribution across all customers</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={spendTiers}
                    dataKey="count"
                    nameKey="tier"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    labelLine={false}
                    label={<PieLabel />}
                  >
                    {spendTiers.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                        Number(value).toLocaleString(),
                        '',
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex flex-col gap-2 flex-1">
                {spendTiers.map((tier, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tier.color }}
                      />
                      <span className="text-xs text-gray-600">{tier.tier}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-800">
                      {tier.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}