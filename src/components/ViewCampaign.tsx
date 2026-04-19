'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Campaign {
  _id: string;
  name: string;
  tag: string;
  audienceSize: number;
  sentCount: number;
  failedCount: number;
  successRate: string;
  totalMessages: number;
  createdAt: string;
  status: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

// Shape of live progress updates from the SSE endpoint
interface LiveProgress {
  sent: number;
  failed: number;
  total: number;
  done: boolean;
}

export default function ViewCampaignList() {
  const toast = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
  });
  const [loading, setLoading] = useState(true);
  const [campaignSummary, setCampaignSummary] = useState<Record<string, string>>({});
  const [loadingSummary, setLoadingSummary] = useState<Record<string, boolean>>({});

  // Stores live SSE progress keyed by campaignId.
  // While a campaign is sending, we show these numbers instead of the stale DB values.
  const [liveProgress, setLiveProgress] = useState<Record<string, LiveProgress>>({});

  // Keep track of open EventSource instances so we can close them on cleanup.
  // useRef so we don't trigger re-renders when adding/removing connections.
  const eventSourcesRef = useRef<Record<string, EventSource>>({});

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const fetchCampaigns = useCallback(
    async (isSilentPoll = false) => {
      try {
        if (!isSilentPoll) setLoading(true);

        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: limit.toString(),
          sortBy,
          sortOrder,
          ...(searchQuery && { search: searchQuery }),
        });

        const response = await fetch(`/api/campaigns?${params}`);
        if (!response.ok) throw new Error('Failed');

        const data = await response.json();
        setCampaigns(data.campaigns);
        setPagination(data.pagination);
      } catch (error) {
        console.error('Fetch error:', error);
      } finally {
        if (!isSilentPoll) setLoading(false);
      }
    },
    [currentPage, limit, sortBy, sortOrder, searchQuery]
  );

  // Initial fetch + polling for the campaign list (DB values / final state)
  useEffect(() => {
    fetchCampaigns(false);

    const pollInterval = setInterval(() => {
      fetchCampaigns(true);
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [fetchCampaigns]);

  /**
   * Whenever the campaigns list updates, check each campaign.
   * If a campaign is still sending (processed < audienceSize) and we don't
   * already have an open SSE connection for it, open one now.
   */
  useEffect(() => {
    campaigns.forEach((campaign) => {
      const processed = campaign.sentCount + campaign.failedCount;
      const isInProgress = processed < campaign.audienceSize;
      const alreadyConnected = !!eventSourcesRef.current[campaign._id];

      // Only open a new SSE if the campaign is still running and not yet tracked
      if (isInProgress && !alreadyConnected) {
        const es = new EventSource(
          `/api/campaigns/progress?campaignId=${campaign._id}`
        );

        eventSourcesRef.current[campaign._id] = es;

        es.onmessage = (e) => {
          try {
            const progress: LiveProgress = JSON.parse(e.data);

            // Update live display numbers for this campaign
            setLiveProgress((prev) => ({
              ...prev,
              [campaign._id]: progress,
            }));

            // When the campaign finishes, close the SSE and do a final DB refresh
            if (progress.done) {
              es.close();
              delete eventSourcesRef.current[campaign._id];
              // Remove from live state so DB values take over
              setLiveProgress((prev) => {
                const next = { ...prev };
                delete next[campaign._id];
                return next;
              });
              // Fetch fresh DB values to show final counts
              fetchCampaigns(true);
            }
          } catch {
            // Ignore malformed SSE frames (e.g. heartbeats with no JSON)
          }
        };

        es.onerror = () => {
          es.close();
          delete eventSourcesRef.current[campaign._id];
        };
      }
    });

    // Cleanup: close all open SSE connections when this component unmounts
    return () => {
      Object.values(eventSourcesRef.current).forEach((es) => es.close());
    };
  }, [campaigns, fetchCampaigns]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchCampaigns(false);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fetchCampaignSummary = async (campaignId: string) => {
    if (campaignSummary[campaignId] || loadingSummary[campaignId]) return;

    try {
      setLoadingSummary((prev) => ({ ...prev, [campaignId]: true }));
      const response = await fetch(`/api/campaigns/${campaignId}`);

      if (!response.ok) throw new Error('Failed to fetch campaign summary');

      const data = await response.json();
      setCampaignSummary((prev) => ({
        ...prev,
        [campaignId]: data.campaign.aiSummary,
      }));
    } catch (error) {
      console.error('Error fetching campaign summary:', error);
      toast.error('Failed to fetch campaign summary');
    } finally {
      setLoadingSummary((prev) => ({ ...prev, [campaignId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search">Search Campaigns</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  id="search"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="w-32">
              <Label htmlFor="limit">Per Page</Label>
              <Select
                value={limit.toString()}
                onValueChange={(value) => setLimit(Number(value))}
              >
                <SelectTrigger id="limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      {/* Campaign Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No campaigns found. Create your first campaign to get started.
            </div>
          ) : (
            <Table>
              <TableCaption>
                Showing {(pagination.currentPage - 1) * pagination.limit + 1} to{' '}
                {Math.min(
                  pagination.currentPage * pagination.limit,
                  pagination.totalCount
                )}{' '}
                of {pagination.totalCount} campaigns
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead
                    onClick={() => handleSort('name')}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-1">
                      Name <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">Tag</div>
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('audienceSize')}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-1">
                      Audience Size <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Messages Sent</TableHead>
                  <TableHead>Messages Failed</TableHead>
                  <TableHead
                    onClick={() => handleSort('successRate')}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-1">
                      Success Rate <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('createdAt')}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-1">
                      Created At <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  // Prefer live SSE data while the campaign is sending;
                  // fall back to DB values once it's done / not yet started.
                  const live = liveProgress[campaign._id];
                  const displaySent = live ? live.sent : campaign.sentCount;
                  const displayFailed = live ? live.failed : campaign.failedCount;
                  const displayTotal = live ? live.total : campaign.audienceSize;
                  const isLive = !!live && !live.done;

                  // Compute success rate from whichever data we're showing
                  const processed = displaySent + displayFailed;
                  const displaySuccessRate =
                    processed > 0
                      ? ((displaySent / processed) * 100).toFixed(2)
                      : campaign.successRate;

                  return (
                    <TableRow key={campaign._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {campaign.name}
                          {/* Pulsing dot shown while campaign is actively sending */}
                          {isLive && (
                            <span className="relative flex h-2 w-2" title="Sending in progress">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{campaign.tag || 'General'}</Badge>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => fetchCampaignSummary(campaign._id)}
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="space-y-2">
                                <h4 className="font-medium">Campaign Summary</h4>
                                {loadingSummary[campaign._id] ? (
                                  <p className="text-sm text-gray-500">
                                    Loading summary...
                                  </p>
                                ) : campaignSummary[campaign._id] ? (
                                  <p className="text-sm">
                                    {campaignSummary[campaign._id]}
                                  </p>
                                ) : (
                                  <p className="text-sm text-gray-500">
                                    Click to load summary
                                  </p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableCell>

                      <TableCell>
                        {/* Show a mini progress bar while sending */}
                        {isLive ? (
                          <div className="flex flex-col gap-1">
                            <span>{displayTotal}</span>
                            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-1.5 bg-green-500 rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(
                                    ((displaySent + displayFailed) / displayTotal) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          campaign.audienceSize
                        )}
                      </TableCell>

                      {/* Live-updating sent count */}
                      <TableCell className="font-bold text-green-600">
                        {displaySent}
                      </TableCell>

                      {/* Live-updating failed count */}
                      <TableCell className="font-bold text-red-500">
                        {displayFailed}
                      </TableCell>

                      <TableCell>{displaySuccessRate}%</TableCell>
                      <TableCell>{formatDate(campaign.createdAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Page {pagination.currentPage} of {pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={pagination.currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.min(pagination.totalPages, prev + 1)
                    )
                  }
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}