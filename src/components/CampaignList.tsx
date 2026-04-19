'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { generateMessageSuggestions } from '@/lib/ai';

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
  const [messages, setMessages] = useState<string[]>([]);
  const [selectedMessage, setSelectedMessage] = useState('');
  const toast = useToast();

  const fields = [
    { value: 'spend', label: 'Total Spend (INR)' },
    { value: 'visits', label: 'Number of Visits' },
    { value: 'inactiveDays', label: 'Inactive Days' },
  ];

  const operators = ['>', '<', '=', '>=', '<='];

  const addRule = () => {
    setRules([...rules, { field: 'spend', operator: '>', value: '', connector: 'AND' }]);
  };

  // const updateRule = (index: number, key: keyof Rule, value: string) => {
  //   const newRules = [...rules];
  //   newRules[index][key] = value;
  //   setRules(newRules);
  // };

  const updateRule = (index: number, key: keyof Rule, value: string) => {
    const newRules = [...rules];
    if (key === "connector" && (value === "AND" || value === "OR")) {
      newRules[index][key] = value;
      setRules(newRules);
    } else if (key !== "connector") {
      newRules[index][key] = value;
      setRules(newRules);
    } else {
      console.error(`Invalid value "${value}" for key "${key}". Expected 'AND' or 'OR'.`);
      // Optionally, provide user feedback
    }
  };
  
  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };
  const generateMessages = async () => {
    if (rules.some((rule) => !rule.value)) {
      toast.error('Please fill in all rule values before generating messages');
      return;
    }

    try {
      await toast.promise(
        (async () => {
          const generatedMessages = await generateMessageSuggestions(rules);
          if (generatedMessages.length === 0) {
            throw new Error('No messages generated');
          }

          setMessages(generatedMessages);
          setSelectedMessage(generatedMessages[0] || '');
          return generatedMessages;
        })(),
        {
          loading: 'Generating message suggestions...',
          success: 'Message suggestions generated successfully',
          error: (err: unknown) => {
            const error = err as Error;
            return error.message === 'No messages generated' 
              ? 'No messages generated. Try adjusting the rules.' 
              : 'Failed to generate message suggestions';
          }
        }
      );
    } catch (error) {
      console.log(error);     
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
      console.log(error);     
    }
  };
  const saveSegment = async () => {
    if (!name || rules.some((rule) => !rule.value)) {
      toast.error('Please fill in all fields');
      return false;
    }

    try {
      return await toast.promise(
        (async () => {
          // Save segment
          const segmentResponse = await fetch('/api/segments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, rules, audienceSize, message: selectedMessage }),
          });

          if (!segmentResponse.ok) {
            throw new Error('Failed to create segment');
          }

          const segment = await segmentResponse.json();

          // Initiate campaign
          const campaignResponse = await fetch('/api/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              segmentId: segment._id, 
              name: `Campaign for ${name}`, 
              message: selectedMessage 
            }),
          });

          if (!campaignResponse.ok) {
            throw new Error('Failed to initiate campaign');
          }

          return true;
        })(),
        {
          loading: 'Creating segment and initiating campaign...',
          success: 'Segment created and campaign initiated successfully!',
          error: 'Failed to save segment or initiate campaign'
        }
      );
    } catch (error) {
      console.log(error);
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
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Segment</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="name">Segment Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., High Value Customers"
              required
            />
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Rules</h3>
            {rules.map((rule, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Select
                  value={rule.field}
                  onValueChange={(value) => updateRule(index, 'field', value)}
                >
                  <SelectTrigger className="w-40">
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
                >
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={rule.value}
                  onChange={(e) => updateRule(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="w-32"
                />
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
                  variant="destructive"
                  size="sm"
                  onClick={() => removeRule(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addRule}>
              Add Rule
            </Button>
          </div>
          <div>
            <Label htmlFor="messages">Message Suggestions</Label>
            <div className="space-y-2">
              <Button type="button" onClick={generateMessages}>
                Generate Messages
              </Button>
              {messages.length > 0 && (
                <Select
                  value={selectedMessage}
                  onValueChange={setSelectedMessage}
                >
                  <SelectTrigger>
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
          <div className="flex space-x-4">
            <Button type="button" onClick={previewAudience}>
              Preview Audience
            </Button>
            <Button type="submit">Save Segment</Button>
          </div>
          {audienceSize !== null && (
            <p className="text-sm text-gray-500">Audience Size: {audienceSize} customers</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}