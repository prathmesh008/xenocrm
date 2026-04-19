'use client';

/**
 * Customer Intelligence Page — /dashboard/customers
 * Features:
 *  - Searchable, paginated customer table
 *  - Spend-tier badges (VIP / High / Mid / Low)
 *  - AI "Suggest a Segment" button powered by Gemini
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCaption, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, ChevronLeft, ChevronRight, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';

interface Customer {
  _id: string;
  name: string;
  email: string;
  spend: number;
  visits: number;
  orders: number;
  avg_order_value: number;
  lastActive: string;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

// Determine spend tier label + color from spend amount
function getSpendTier(spend: number): { label: string; className: string } {
  if (spend >= 5000) return { label: 'VIP', className: 'bg-violet-100 text-violet-700 border-violet-200' };
  if (spend >= 2000) return { label: 'High', className: 'bg-blue-100 text-blue-700 border-blue-200' };
  if (spend >= 500)  return { label: 'Mid', className: 'bg-green-100 text-green-700 border-green-200' };
  return { label: 'Low', className: 'bg-amber-100 text-amber-700 border-amber-200' };
}

// Skeleton row for loading state
function SkeletonRow() {
  return (
    <TableRow>
      {[...Array(7)].map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 bg-gray-200 animate-pulse rounded" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1, totalPages: 1, totalCount: 0, limit: 15,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '15',
        ...(search && { search }),
      });
      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers || []);
      setPagination(data.pagination || { currentPage: 1, totalPages: 1, totalCount: 0, limit: 15 });
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setCurrentPage(1);
  };

  // Call Gemini to suggest a segment based on current customer data snapshot
  const handleAISuggest = async () => {
    setAiLoading(true);
    setAiSuggestion('');
    try {
      const res = await fetch('/api/customers/ai-suggest', { method: 'POST' });
      const data = await res.json();
      setAiSuggestion(data.suggestion || 'No suggestion generated.');
    } catch {
      setAiSuggestion('Failed to generate suggestion. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="py-8 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-xl">
            <Users className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Intelligence</h1>
            <p className="text-sm text-gray-500">
              Browse, search and understand your customer base
            </p>
          </div>
        </div>
        <Link href="/dashboard/segments">
          <Button>Create Segment</Button>
        </Link>
      </div>

      {/* ── AI Segment Suggestion ───────────────────────────────────── */}
      <Card className="border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-violet-200 rounded-xl flex-shrink-0">
              <Sparkles className="h-5 w-5 text-violet-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-violet-800 mb-1">
                AI Segment Suggestion
              </h3>
              <p className="text-sm text-violet-600 mb-3">
                Let Gemini analyze your customer data and suggest who to target next.
              </p>
              <Button
                onClick={handleAISuggest}
                disabled={aiLoading}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {aiLoading ? (
                  <>
                    <span className="animate-spin mr-2">✦</span> Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Suggest a Segment
                  </>
                )}
              </Button>

              {/* AI suggestion output */}
              {aiSuggestion && (
                <div className="mt-4 p-4 bg-white rounded-xl border border-violet-100 shadow-sm">
                  <p className="text-sm font-medium text-violet-700 mb-1">💡 Gemini suggests:</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiSuggestion}</p>
                  <Link href="/dashboard/segments">
                    <Button size="sm" className="mt-3" variant="outline">
                      Create This Segment →
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit">Search</Button>
            {search && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setSearchInput('');
                  setCurrentPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* ── Customer Table ──────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-700">
            Customer List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {loading
                ? 'Loading...'
                : `Showing ${(pagination.currentPage - 1) * pagination.limit + 1}–${Math.min(
                    pagination.currentPage * pagination.limit,
                    pagination.totalCount
                  )} of ${pagination.totalCount.toLocaleString()} customers`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Spend (₹)</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead>Last Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                : customers.map((customer) => {
                    const tier = getSpendTier(customer.spend || 0);
                    return (
                      <TableRow key={customer._id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell className="text-gray-500 text-sm">{customer.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold ${tier.className}`}
                          >
                            {tier.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ₹{(customer.spend || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">{customer.visits || 0}</TableCell>
                        <TableCell className="text-right">{customer.orders || 0}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {customer.lastActive
                            ? new Date(customer.lastActive).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {pagination.currentPage} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.currentPage === pagination.totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}