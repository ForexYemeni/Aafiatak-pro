'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { usePathname } from 'next/navigation';

function NavProgressInner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  const complete = useCallback(() => {
    setWidth(100);
    setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 350);
  }, []);

  useEffect(() => {
    complete();
  }, [pathname, complete]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (
        link &&
        link.href &&
        !link.href.includes('#') &&
        !link.href.startsWith('mailto:') &&
        !link.href.startsWith('tel:') &&
        !link.href.startsWith('whatsapp:') &&
        link.hostname === window.location.hostname &&
        link.pathname !== window.location.pathname
      ) {
        setVisible(true);
        setWidth(15);
        const t1 = setTimeout(() => setWidth(40), 150);
        const t2 = setTimeout(() => setWidth(65), 500);
        const t3 = setTimeout(() => setWidth(80), 1200);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  if (!visible && width === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none">
      <div
        style={{
          width: `${width}%`,
          opacity: visible ? 1 : 0,
          transition: width === 100
            ? 'width 300ms ease-out, opacity 350ms ease 300ms'
            : 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="h-full bg-primary shadow-[0_0_8px_0px] shadow-primary/60 rounded-r-full"
      />
    </div>
  );
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <NavProgressInner />
    </Suspense>
  );
}
