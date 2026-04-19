// components/UnsplashSelector.tsx
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface AIImageSelectorProps {
  prompt?: string;
}

// Separate component so useState works inside map
function BannerImage({ url, index }: { url: string; index: number }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="w-48 h-24 rounded-md border bg-gray-100 flex items-center justify-center relative overflow-hidden">
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      )}
      {error && (
        <span className="text-xs text-red-400 px-2 text-center">Failed to load</span>
      )}
      <img
        src={url}
        alt={`Generated Banner ${index + 1}`}
        className="w-48 h-24 object-cover rounded-md transition-opacity duration-300"
        style={{ opacity: loaded ? 1 : 0, display: error ? 'none' : 'block' }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

const UnsplashSelector: React.FC<AIImageSelectorProps> = ({ prompt }) => {
  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const fetchImages = async () => {
    if (!prompt) {
      toast.error('Please provide a campaign objective first.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/images-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageCount: 3 })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');

      setImages(data.images || []);
      setSelectedImage(null);
    } catch (error: any) {
      console.error('Error generating images:', error);
      toast.error(error.message || 'Failed to generate AI images');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start space-y-4">
      <Button
        type="button"
        className="transition-all hover:scale-105"
        onClick={fetchImages}
        disabled={loading}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? 'Generating AI Banner...' : 'Generate AI Banner'}
      </Button>

      {images.length > 0 && (
        <RadioGroup
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          value={selectedImage || ''}
          onValueChange={setSelectedImage}
        >
          {images.map((imgUrl, i) => (
            <div key={i} className="flex flex-col items-center space-y-2">
              <RadioGroupItem value={imgUrl} id={`img-${i}`} />
              <Label htmlFor={`img-${i}`} className="cursor-pointer">
                <BannerImage url={imgUrl} index={i} />
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {selectedImage && (
        <div className="text-sm text-green-600 font-medium">
          AI Banner selected!
        </div>
      )}
    </div>
  );
};

export default UnsplashSelector;