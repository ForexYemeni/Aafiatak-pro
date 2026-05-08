'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Loader2, CheckCircle2, AlertCircle, Navigation, ExternalLink } from 'lucide-react';
import { useGeolocation, type LocationData } from '@/hooks/use-geolocation';
import { Input } from '@/components/ui/input';

interface GpsLocationButtonProps {
  onLocationDetected: (location: LocationData) => void;
  /** Current address value to display */
  value?: string;
  /** Placeholder text */
  placeholder?: string;
  className?: string;
  label?: string;
}

export function GpsLocationButton({
  onLocationDetected,
  value = '',
  placeholder = 'اضغط "تحديد موقعي" لرفع موقعك الجغرافي',
  className = '',
  label = 'تحديد موقعي',
}: GpsLocationButtonProps) {
  const { location, isDetecting, error, detectLocation, onAddressEnriched, clearError } = useGeolocation();
  const [detected, setDetected] = useState(false);
  const [enrichedAddress, setEnrichedAddress] = useState('');

  // Listen for background address enrichment
  useEffect(() => {
    onAddressEnriched((loc) => {
      if (loc.address && loc.address !== `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`) {
        setEnrichedAddress(loc.address);
        // Also notify parent with enriched data
        onLocationDetected(loc);
      }
    });
  }, [onAddressEnriched, onLocationDetected]);

  const handleDetect = useCallback(async () => {
    clearError();
    setDetected(false);
    setEnrichedAddress('');
    
    const result = await detectLocation();
    if (result) {
      setDetected(true);
      onLocationDetected(result);
      
      // Keep success state for 5 seconds
      setTimeout(() => setDetected(false), 5000);
    }
  }, [detectLocation, onLocationDetected, clearError]);

  // Show enriched address if available, otherwise show value
  const displayValue = enrichedAddress || value;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {/* Location display field */}
        <div className="relative flex-1">
          <MapPin className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
            detected ? 'text-emerald-500' : isDetecting ? 'text-amber-500 animate-pulse' : 'text-muted-foreground'
          }`} />
          <Input
            value={displayValue}
            readOnly
            placeholder={placeholder}
            className={`pr-9 pl-3 text-sm transition-colors ${
              detected 
                ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20' 
                : isDetecting 
                  ? 'border-amber-400 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/10'
                  : ''
            }`}
          />
        </div>
        
        {/* Detect button */}
        <motion.button
          type="button"
          onClick={handleDetect}
          disabled={isDetecting}
          whileTap={{ scale: 0.95 }}
          className={`shrink-0 flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl text-sm font-medium transition-all ${
            detected
              ? 'bg-emerald-500 text-white'
              : isDetecting
                ? 'bg-amber-500 text-white'
                : 'bg-primary text-primary-foreground shadow-md hover:shadow-lg active:scale-95'
          } ${className}`}
        >
          <AnimatePresence mode="wait">
            {isDetecting ? (
              <motion.div
                key="loading"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex items-center gap-1.5"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارٍ التحديد...</span>
              </motion.div>
            ) : detected ? (
              <motion.div
                key="detected"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تم التحديد</span>
              </motion.div>
            ) : (
              <motion.div
                key="default"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex items-center gap-1.5"
              >
                <Navigation className="w-4 h-4" />
                <span>{label}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Map link */}
      {location && detected && (
        <a
          href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 mt-0.5"
        >
          <ExternalLink className="w-3 h-3" />
          عرض الموقع على الخريطة
        </a>
      )}

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 text-destructive text-xs bg-red-50 dark:bg-red-950/30 p-2 rounded-lg"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
