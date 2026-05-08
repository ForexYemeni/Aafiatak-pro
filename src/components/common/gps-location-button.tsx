'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Loader2, CheckCircle2, AlertCircle, Navigation } from 'lucide-react';
import { useGeolocation, type LocationData } from '@/hooks/use-geolocation';
import { Button } from '@/components/ui/button';

interface GpsLocationButtonProps {
  onLocationDetected: (location: LocationData) => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showDetails?: boolean;
  label?: string;
}

export function GpsLocationButton({
  onLocationDetected,
  variant = 'outline',
  size = 'default',
  className = '',
  showDetails = true,
  label = 'تحديد موقعي تلقائياً',
}: GpsLocationButtonProps) {
  const { location, isDetecting, error, detectLocation, clearError } = useGeolocation();
  const [detected, setDetected] = useState(false);

  const handleDetect = useCallback(async () => {
    clearError();
    setDetected(false);
    
    const result = await detectLocation();
    if (result) {
      setDetected(true);
      onLocationDetected(result);
      
      // Reset detected state after 3 seconds
      setTimeout(() => setDetected(false), 3000);
    }
  }, [detectLocation, onLocationDetected, clearError]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={`gap-2 ${className}`}
        onClick={handleDetect}
        disabled={isDetecting}
      >
        <AnimatePresence mode="wait">
          {isDetecting ? (
            <motion.div
              key="loading"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="flex items-center gap-2"
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
              className="flex items-center gap-2 text-emerald-600"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تم التحديد بنجاح!</span>
            </motion.div>
          ) : (
            <motion.div
              key="default"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="flex items-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              <span>{label}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

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

      {/* Location details */}
      <AnimatePresence>
        {showDetails && location && detected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-3 space-y-1"
          >
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
              <MapPin className="w-3.5 h-3.5" />
              <span>تم تحديد موقعك</span>
            </div>
            {location.governorate && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400/80">
                المحافظة: {location.governorate}
              </p>
            )}
            {location.district && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400/80">
                المنطقة: {location.district}
              </p>
            )}
            {location.address && (
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60 truncate">
                {location.address}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
