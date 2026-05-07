'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FloatingChatBubbleProps {
  unreadCount?: number;
  onClick?: () => void;
  className?: string;
}

export function FloatingChatBubble({
  unreadCount = 0,
  onClick,
  className,
}: FloatingChatBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else {
      setIsExpanded((prev) => !prev);
    }
  }, [onClick]);

  return (
    <div className={cn('fixed bottom-24 md:bottom-6 left-4 z-40', className)}>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute bottom-16 left-0 w-80 h-96 glass-strong rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-sm">المحادثات</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
              <p className="text-sm text-muted-foreground text-center py-8">
                لا توجد محادثات حالياً
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow touch-target"
      >
        <MessageCircle className="w-6 h-6" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-[10px]"
          >
            {unreadCount > 99 ? '٩٩+' : unreadCount}
          </Badge>
        )}
      </motion.button>
    </div>
  );
}
