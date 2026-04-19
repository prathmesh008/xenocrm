'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { 
  generateMessageSuggestions,
  generateCampaignObjective, 
  parseSegmentRules,
  autoTagCampaign 
} from '@/lib/ai';
import { PlusCircle, Trash2 } from 'lucide-react';
import UnsplashSelector from '@/components/unsplash';

type Rule = {
  field: string;
  operator: string;
  value: string;
  connector?: 'AND' | 'OR';
};

export default function SegmentForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [rules, setRules] = useState<Rule[]>([{ field: 'spend', operator: '>', value: '', connector: 'AND' }]);
  const [audienceSize, setAudienceSize] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [selectedMessage, setSelectedMessage] = useState('');
  const toast = useToast();
  const [liveProgress, setLiveProgress] = useState<{
    sent: number; failed: number; total: number; done: boolean;
  } | null>(null);
const [isLaunching, setIsLaunching] = useState(false);
  const fields = [
    { value: 'spend', label: 'Total Spend (INR)', type: 'number' },
    { value: 'visits', label: 'Number of Visits', type: 'number' },
    { value: 'orders', label: 'Orders', type: 'number' },
    { value: 'avg_order_value', label: 'Avg Order Value (INR)', type: 'number' },
    { value: 'clv', label: 'Customer Lifetime Value (INR)', type: 'number' },
    { value: 'preferred_category', label: 'Preferred Category', type: 'enum', options: ['Electronics', 'Clothing', 'Home & Kitchen', 'Beauty', 'Books', 'Sports'] },
    { value: 'source', label: 'Source', type: 'enum', options: ['Organic', 'Ads', 'Referral', 'Social Media', 'Direct'] },
  ];

  const operators = ['>', '<', '=', '>=', '<='];

  const addRule = () => {
    setRules([...rules, { field: 'spend', operator: '>', value: '', connector: 'AND' }]);
  };

  const updateRule = (index: number, key: keyof Rule, value: string) => {
    const newRules = [...rules];
    if (key === 'connector' && (value === 'AND' || value === 'OR')) {
      newRules[index][key] = value;
    } else if (key !== 'connector') {
      if (key === 'value') {
        newRules[index][key] = value.toString();
      } else {
        newRules[index][key] = value;
        if (key === 'field') {
          const selectedField = fields.find(f => f.value === value);
          if (selectedField?.type === 'enum') {
            newRules[index].operator = '=';
          }
        }
      }
    }
    setRules(newRules);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const generateRulesFromAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt to generate rules');
      return;
    }

    try {
      let generatedRules = await parseSegmentRules(aiPrompt);
      
      // BULLETPROOFING: If Gemini returned a single object instead of an array, force it into an array.
      if (generatedRules && !Array.isArray(generatedRules)) {
        generatedRules = [generatedRules];
      }

      if (!generatedRules || generatedRules.length === 0) {
        toast.warning('The prompt could not be parsed into valid rules. Try a different prompt.');
        return;
      }

      const formattedRules = generatedRules.map((rule: any) => ({
        field: rule.field || 'spend',
        operator: rule.operator || '>',
        value: rule.value ? rule.value.toString() : '',
        connector: rule.connector || 'AND'
      }));
      
      setRules(formattedRules);
      toast.success('Rules generated from prompt successfully');
    } catch (error) {
      console.error("Rules Generation Error:", error);
      toast.error('Failed to generate rules from prompt');
    }
  };

  const generateObjective = async () => {
    if (rules.some((rule) => !rule.value)) {
      toast.error('Please fill in all rule values before generating an objective');
      return;
    }

    try {
      const objective = await generateCampaignObjective(rules);
      setName(objective);
      toast.success('Campaign objective generated successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate campaign objective');
    }
  };

  const generateMessagesFromRules = async () => {
    if (rules.some((rule) => !rule.value)) {
      toast.error('Please fill in all rule values before generating messages');
      return;
    }

    try {
      await toast.promise(
        (async () => {
          const generatedMessages = await generateMessageSuggestions(rules);
          if (!generatedMessages || generatedMessages.length === 0) {
            throw new Error('No messages generated');
          }

          setMessages(generatedMessages);
          setSelectedMessage(generatedMessages[0] || '');
          return generatedMessages;
        })(),
        {
          loading: 'Generating message suggestions...',
          success: 'Message suggestions generated successfully',
          error: 'Failed to generate message suggestions'
        }
      );
    } catch (error) {
      console.error(error);
    }
  };

  const previewAudience = async () => {
    try {
      await toast.promise(
        (async () => {
          const response = await fetch('/api/customers/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },        
            body: JSON.stringify({ rules }),
          });

          if (!response.ok) {
            throw new Error('Failed to preview audience');
          }

          const data = await response.json();
          setAudienceSize(data.count);
          return data.count;
        })(),
        {
          loading: 'Calculating audience size...',
          success: (count) => `Audience size: ${count} customers`,
          error: 'Failed to preview audience size'
        }
      );
    } catch (error) {
      console.error(error);
    }
  };

  const saveSegment = async () => {
  if (!name || rules.some((rule) => !rule.value)) {
    toast.error('Please fill in all fields');
    return false;
  }

  setIsLaunching(true);

  try {
    const tag = selectedMessage ? await autoTagCampaign(rules, selectedMessage) : 'General';

    const segmentResponse = await fetch('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        rules,
        audienceSize,
        messageContent: selectedMessage,
        campaignId: `temp_${Date.now()}`
      }),
    });

    if (!segmentResponse.ok) throw new Error('Failed to create segment');
    const segmentData = await segmentResponse.json();
    const segmentId = segmentData.segment?._id;
    if (!segmentId) throw new Error('Missing segment ID');

    // Start campaign and get campaignId back
    const campaignResponse = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segmentId,
        name: `Campaign for ${name}`,
        message: selectedMessage,
        tag
      }),
    });

    if (!campaignResponse.ok) throw new Error('Failed to initiate campaign');
    const campaignData = await campaignResponse.json();
    const campaignId = campaignData.campaignId;

    // Start SSE tracking
    if (campaignId) {
      const es = new EventSource(`/api/campaigns/progress?campaignId=${campaignId}`);
      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        setLiveProgress(data);
        if (data.done) {
          es.close();
          toast.success(`Campaign done! ${data.sent} sent, ${data.failed} failed`);
          setTimeout(() => router.push('/dashboard/campaigns'), 2000);
        }
      };
      es.onerror = () => {
        es.close();
        router.push('/dashboard/campaigns');
      };
    } else {
      router.push('/dashboard/campaigns');
    }

    return true;
  } catch (error) {
    console.error(error);
    toast.error('Failed to save segment or initiate campaign');
    setIsLaunching(false);
    return false;
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await saveSegment();
    if (success) {
      router.push('/dashboard/campaigns');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Create New Segment</h1>
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <Label htmlFor="aiPrompt" className="text-lg font-medium">Generate Rules with AI</Label>
          <div className="flex gap-3">
            <Input
              id="aiPrompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g., People who haven't shopped in 6 months and spent over 5000"
              className="flex-1"
            />
            <Button type="button" onClick={generateRulesFromAI} className="transition-all hover:scale-105">
              Generate Rules
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Rules</h3>
          {rules.map((rule, index) => {
            const field = fields.find(f => f.value === rule.field);
            const isEnumField = field?.type === 'enum';
            
            return (
              <div key={index} className="flex items-center gap-3 rounded-md border p-4 bg-gray-50">
                <Select
                  value={rule.field}
                  onValueChange={(value) => updateRule(index, 'field', value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={rule.operator}
                  onValueChange={(value) => updateRule(index, 'operator', value)}
                  disabled={isEnumField}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {isEnumField ? (
                      <SelectItem value="=">=</SelectItem>
                    ) : (
                      operators.map((op) => (
                        <SelectItem key={op} value={op}>
                          {op}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {field?.type === 'enum' ? (
                  <Select
                    value={rule.value}
                    onValueChange={(value) => updateRule(index, 'value', value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Value" />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={rule.value}
                    onChange={(e) => updateRule(index, 'value', e.target.value)}
                    placeholder="Value"
                    className="w-40"
                    type={field?.type || 'text'}
                    key={`rule-value-${index}`}
                  />
                )}
                {index < rules.length - 1 && (
                  <Select
                    value={rule.connector}
                    onValueChange={(value) => updateRule(index, 'connector', value)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="Connector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRule(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <Button 
            type="button" 
            variant="outline" 
            onClick={addRule}
            className="w-full justify-center gap-2 transition-all hover:scale-105"
          >
            <PlusCircle className="h-4 w-4" />
            Add Rule
          </Button>
        </div>

        <div className="space-y-4">
          <Label htmlFor="name" className="text-lg font-medium">Campaign Objective</Label>
          <div className="flex gap-3">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Re-engage high-spending inactive customers"
              required
              className="flex-1"
            />
            <Button 
              type="button" 
              onClick={generateObjective}
              className="transition-all hover:scale-105"
            >
              Generate Objective
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-lg font-medium">Message Suggestions</Label>
          <div className="space-y-4">
            <div className="flex gap-3">
              <Button 
                type="button" 
                onClick={generateMessagesFromRules}
                className="transition-all hover:scale-105"
              >
                Generate from Rules
              </Button>
            <UnsplashSelector prompt={name} />  
            </div>
            {messages.length > 0 && (
              <Select
                value={selectedMessage}
                onValueChange={setSelectedMessage}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a message" />
                </SelectTrigger>
                <SelectContent>
                  {messages.map((msg, index) => (
                    <SelectItem key={index} value={msg}>
                      {msg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Progress UI - outside the button row */}
        {isLaunching && (
          <div className="mt-4 p-4 rounded-lg border bg-gray-50 space-y-3">
            <p className="text-sm font-semibold">
              {liveProgress?.done ? '🎉 Campaign Complete!' : '⏳ Campaign in progress...'}
            </p>
            {liveProgress && liveProgress.total > 0 && (
              <>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(((liveProgress.sent + liveProgress.failed) / liveProgress.total) * 100)}%`
                    }}
                  />
                </div>
                <div className="flex gap-6 text-sm">
                  <span className="text-green-600 font-medium">✓ Sent: {liveProgress.sent}</span>
                  <span className="text-red-500 font-medium">✗ Failed: {liveProgress.failed}</span>
                  <span className="text-gray-500">Total: {liveProgress.total}</span>
                  <span className="text-gray-500 font-medium">
                    {Math.round(((liveProgress.sent + liveProgress.failed) / liveProgress.total) * 100)}%
                  </span>
                </div>
              </>
            )}
            {!liveProgress || liveProgress.total === 0 && (
              <p className="text-sm text-gray-500">Initializing campaign...</p>
            )}
            {liveProgress?.done && (
              <p className="text-green-600 text-sm font-medium">Redirecting to campaigns...</p>
            )}
            
          </div>
        )}

        {/* Button row */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            type="button"
            onClick={previewAudience}
            variant="outline"
            className="transition-all hover:scale-105"
          >
            Preview Audience
          </Button>
          <Button
            type="submit"
            disabled={isLaunching}
            className="transition-all hover:scale-105"
          >
            {isLaunching ? 'Launching...' : 'Save Segment'}
          </Button>
        </div>
        {audienceSize !== null && (
          <p className="text-sm text-muted-foreground mt-2">
            Audience Size: {audienceSize} customers
          </p>
        )}
      </form>
    </div>
  );
}