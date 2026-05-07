'use client';

/**
 * عافيتك (Aafiatak) - Maps & Tracking Demo Page
 *
 * Showcases the complete Maps & Tracking system with:
 * - Interactive map with OpenStreetMap
 * - Nurse, Beneficiary, Emergency markers
 * - Route lines with distance/ETA
 * - Geolocation support
 * - Full screen mode
 * - All text in Arabic with RTL support
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Navigation,
  Stethoscope,
  User,
  AlertTriangle,
  Clock,
  Route,
  Wifi,
  WifiOff,
  Crosshair,
  Layers,
  ChevronDown,
  Heart,
  Phone,
} from 'lucide-react';
import { TrackingMap } from '@/components/maps/tracking-map';
import type { NurseLocationData } from '@/components/maps/nurse-marker';
import type { BeneficiaryLocationData } from '@/components/maps/beneficiary-marker';
import type { EmergencyLocationData } from '@/components/maps/emergency-marker';
import { DEFAULT_LOCATION, formatDistance, formatETA, haversineDistance } from '@/lib/utils/location';
import type { LatLng } from '@/lib/utils/location';

// ============================================================================
// Demo Data
// ============================================================================

const DEMO_NURSES: NurseLocationData[] = [
  {
    id: 'nurse-1',
    name: 'أحمد محمد الحداد',
    position: { lat: 15.3780, lng: 44.1950 },
    isOnline: true,
    isAvailable: true,
    heading: 45,
    speed: 25,
    lastUpdate: new Date(),
    rating: 4.8,
    specializations: ['تمريض عام', 'رعاية منزلية'],
  },
  {
    id: 'nurse-2',
    name: 'فاطمة علي الشميري',
    position: { lat: 15.3650, lng: 44.1830 },
    isOnline: true,
    isAvailable: false,
    heading: null,
    speed: null,
    lastUpdate: new Date(Date.now() - 300000),
    rating: 4.6,
    specializations: ['علاج طبيعي'],
  },
  {
    id: 'nurse-3',
    name: 'محمد عبدالله القاضي',
    position: { lat: 15.3580, lng: 44.1990 },
    isOnline: false,
    isAvailable: false,
    heading: null,
    speed: null,
    lastUpdate: new Date(Date.now() - 3600000),
    rating: 4.9,
    specializations: ['رعاية مسنين'],
  },
];

const DEMO_BENEFICIARIES: BeneficiaryLocationData[] = [
  {
    id: 'ben-1',
    name: 'خديجة سالم النعمان',
    position: { lat: 15.3720, lng: 44.1880 },
    address: 'شارع الزبيري، صنعاء',
    serviceName: 'تمريض منزلي',
    serviceStatus: 'in_progress',
  },
  {
    id: 'ben-2',
    name: 'عبدالرحمن يحيى المتوكل',
    position: { lat: 15.3620, lng: 44.1960 },
    address: 'حي الأصبحي، صنعاء',
    serviceName: 'علاج طبيعي',
    serviceStatus: 'pending',
  },
];

const DEMO_EMERGENCIES: EmergencyLocationData[] = [
  {
    id: 'em-1',
    position: { lat: 15.3690, lng: 44.1790 },
    type: 'heart',
    priority: 'critical',
    description: 'ألم حاد في الصدر - يحتاج تدخل فوري',
    beneficiaryName: 'سارة أحمد',
    createdAt: new Date(Date.now() - 600000),
    status: 'dispatched',
    assignedNurseName: 'أحمد محمد الحداد',
    estimatedArrival: 8,
  },
];

// ============================================================================
// Map Control Panel
// ============================================================================

interface ControlPanelProps {
  showRoutes: boolean;
  showLegend: boolean;
  showStats: boolean;
  autoFit: boolean;
  onToggleRoutes: () => void;
  onToggleLegend: () => void;
  onToggleStats: () => void;
  onToggleAutoFit: () => void;
  onCenterOnLocation: () => void;
}

function ControlPanel({
  showRoutes,
  showLegend,
  showStats,
  autoFit,
  onToggleRoutes,
  onToggleLegend,
  onToggleStats,
  onToggleAutoFit,
  onCenterOnLocation,
}: ControlPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-20 right-4 z-[1001]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="mb-3 glass-strong rounded-xl p-3 space-y-2 min-w-[180px]"
          >
            <div className="text-xs font-semibold text-foreground mb-2">خيارات الخريطة</div>

            <button
              type="button"
              onClick={onToggleRoutes}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-xs"
            >
              <Route className="w-3.5 h-3.5 text-nurse" />
              <span className="flex-1 text-right">المسارات</span>
              <div className={`w-7 h-4 rounded-full transition-colors ${showRoutes ? 'bg-nurse' : 'bg-muted'}`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${showRoutes ? 'translate-x-3.5' : 'translate-x-0.5'} mt-0.5`} />
              </div>
            </button>

            <button
              type="button"
              onClick={onToggleLegend}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-xs"
            >
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              <span className="flex-1 text-right">الدليل</span>
              <div className={`w-7 h-4 rounded-full transition-colors ${showLegend ? 'bg-purple-500' : 'bg-muted'}`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${showLegend ? 'translate-x-3.5' : 'translate-x-0.5'} mt-0.5`} />
              </div>
            </button>

            <button
              type="button"
              onClick={onToggleStats}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-xs"
            >
              <Clock className="w-3.5 h-3.5 text-admin" />
              <span className="flex-1 text-right">الإحصائيات</span>
              <div className={`w-7 h-4 rounded-full transition-colors ${showStats ? 'bg-admin' : 'bg-muted'}`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${showStats ? 'translate-x-3.5' : 'translate-x-0.5'} mt-0.5`} />
              </div>
            </button>

            <button
              type="button"
              onClick={onToggleAutoFit}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-xs"
            >
              <Crosshair className="w-3.5 h-3.5 text-green-500" />
              <span className="flex-1 text-right">ملاءمة تلقائية</span>
              <div className={`w-7 h-4 rounded-full transition-colors ${autoFit ? 'bg-green-500' : 'bg-muted'}`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${autoFit ? 'translate-x-3.5' : 'translate-x-0.5'} mt-0.5`} />
              </div>
            </button>

            <button
              type="button"
              onClick={onCenterOnLocation}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-xs"
            >
              <Crosshair className="w-3.5 h-3.5 text-blue-500" />
              <span className="flex-1 text-right">موقعي الحالي</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="glass-strong rounded-full p-3 hover:bg-muted/50 transition-colors shadow-lg"
      >
        <ChevronDown className={`w-5 h-5 text-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}

// ============================================================================
// Sidebar Info Panel
// ============================================================================

interface InfoPanelProps {
  nurses: NurseLocationData[];
  beneficiaries: BeneficiaryLocationData[];
  emergencies: EmergencyLocationData[];
  userLocation: LatLng | null;
}

function InfoPanel({ nurses, beneficiaries, emergencies, userLocation }: InfoPanelProps) {
  const onlineNurses = nurses.filter(n => n.isOnline).length;
  const activeEmergencies = emergencies.filter(e => e.status !== 'resolved' && e.status !== 'cancelled').length;

  return (
    <div className="space-y-4 p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-nurse rounded-xl p-3 text-center">
          <Stethoscope className="w-5 h-5 text-nurse mx-auto mb-1" />
          <div className="text-lg font-bold text-nurse">{nurses.length}</div>
          <div className="text-xs text-muted-foreground">ممرض</div>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Wifi className="w-3 h-3 text-green-500" />
            <span className="text-[10px] text-green-600">{onlineNurses} متصل</span>
          </div>
        </div>

        <div className="glass-beneficiary rounded-xl p-3 text-center">
          <User className="w-5 h-5 text-beneficiary mx-auto mb-1" />
          <div className="text-lg font-bold text-beneficiary">{beneficiaries.length}</div>
          <div className="text-xs text-muted-foreground">مستفيد</div>
        </div>

        <div className="col-span-2 glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-semibold">الطوارئ النشطة</span>
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{activeEmergencies}</span>
          </div>
          {emergencies.length > 0 ? (
            <div className="space-y-2">
              {emergencies.map(em => (
                <div key={em.id} className="bg-red-50 dark:bg-red-950/20 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-red-700 dark:text-red-400">
                      {em.type === 'heart' ? 'مشكلة قلب' : em.type === 'breathing' ? 'مشكلة تنفس' : 'طوارئ'}
                    </span>
                    <span className="text-[10px] text-red-500">
                      {em.priority === 'critical' ? 'حرجة' : em.priority === 'high' ? 'عالية' : 'متوسطة'}
                    </span>
                  </div>
                  {em.assignedNurseName && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      🩺 {em.assignedNurseName} • ⏱️ {em.estimatedArrival} د
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">
              لا توجد حالات طوارئ نشطة
            </div>
          )}
        </div>
      </div>

      {/* Nurses List */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-nurse" />
          الممرضون
        </h3>
        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
          {nurses.map(nurse => {
            const dist = userLocation
              ? haversineDistance(userLocation, nurse.position)
              : null;
            return (
              <div key={nurse.id} className="glass rounded-lg p-2.5 flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-sm">
                    🩺
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${nurse.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{nurse.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] ${nurse.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                      {nurse.isOnline ? (nurse.isAvailable ? 'متاح' : 'مشغول') : 'غير متصل'}
                    </span>
                    {nurse.speed !== null && nurse.speed > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {nurse.speed.toFixed(0)} كم/س
                      </span>
                    )}
                    {dist !== null && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistance(dist)}
                      </span>
                    )}
                  </div>
                </div>
                {nurse.rating !== undefined && (
                  <div className="text-[10px] text-admin font-medium">⭐ {nurse.rating}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Beneficiaries List */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <User className="w-4 h-4 text-beneficiary" />
          المستفيدون
        </h3>
        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
          {beneficiaries.map(ben => {
            const nearestNurse = nurses
              .filter(n => n.isOnline)
              .sort((a, b) =>
                haversineDistance(a.position, ben.position) - haversineDistance(b.position, ben.position)
              )[0];
            const dist = nearestNurse
              ? haversineDistance(nearestNurse.position, ben.position)
              : null;
            const eta = dist !== null && nearestNurse && (nearestNurse.speed ?? 40) > 0
              ? formatETA((dist / (nearestNurse.speed ?? 40)) * 60)
              : null;

            return (
              <div key={ben.id} className="glass rounded-lg p-2.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-sm">
                  👤
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{ben.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {ben.address || 'لا يوجد عنوان'}
                  </div>
                  {dist !== null && eta !== null && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-nurse">{formatDistance(dist)}</span>
                      <span className="text-[10px] text-muted-foreground">•</span>
                      <span className="text-[10px] text-nurse">{eta}</span>
                    </div>
                  )}
                </div>
                {ben.serviceName && (
                  <div className="text-[10px] text-purple-600 font-medium bg-purple-50 dark:bg-purple-950/20 px-2 py-0.5 rounded-full">
                    {ben.serviceName}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* User Location */}
      {userLocation && (
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-nurse" />
            <span className="text-xs font-semibold">موقعي الحالي</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function MapsTrackingPage() {
  const [showRoutes, setShowRoutes] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [autoFit, setAutoFit] = useState(true);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [showPanel, setShowPanel] = useState(true);

  // Simulate nurse movement for demo
  const [nurses, setNurses] = useState<NurseLocationData[]>(DEMO_NURSES);

  useEffect(() => {
    const interval = setInterval(() => {
      setNurses(prev =>
        prev.map(nurse => {
          if (!nurse.isOnline || nurse.heading === null) return nurse;
          // Small random movement simulation
          const latDelta = (Math.random() - 0.5) * 0.0005;
          const lngDelta = (Math.random() - 0.5) * 0.0005;
          return {
            ...nurse,
            position: {
              lat: nurse.position.lat + latDelta,
              lng: nurse.position.lng + lngDelta,
            },
            lastUpdate: new Date(),
            speed: 15 + Math.random() * 20,
            heading: ((nurse.heading + (Math.random() - 0.5) * 30) + 360) % 360,
          };
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Get user location
  const handleCenterOnLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setUserLocation(DEFAULT_LOCATION);
        }
      );
    }
  }, []);

  return (
    <div className="min-h-screen bg-background" dir="rtl" lang="ar">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-strong border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-nurse to-sky-600 flex items-center justify-center text-white">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg">تتبع الخرائط</h1>
              <p className="text-[10px] text-muted-foreground">عافيتك - نظام تتبع الممرضين والطوارئ</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Panel toggle */}
            <button
              type="button"
              onClick={() => setShowPanel(prev => !prev)}
              className="glass rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors hidden md:flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              {showPanel ? 'إخفاء اللوحة' : 'عرض اللوحة'}
            </button>
            {/* Phone support */}
            <a
              href="tel:+967XXXXXXXX"
              className="glass rounded-lg p-2 hover:bg-muted/50 transition-colors"
              aria-label="اتصل بالدعم"
            >
              <Phone className="w-4 h-4 text-muted-foreground" />
            </a>
            {/* Emergency button */}
            <button
              type="button"
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              طوارئ
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row">
          {/* Map Area */}
          <div className="flex-1 relative">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="relative"
              style={{ height: 'calc(100vh - 56px)' }}
            >
              <TrackingMap
                nurses={nurses}
                beneficiaries={DEMO_BENEFICIARIES}
                emergencies={DEMO_EMERGENCIES}
                center={DEFAULT_LOCATION}
                zoom={14}
                showRoutes={showRoutes}
                autoFit={autoFit}
                showLegend={showLegend}
                showStats={showStats}
                className="w-full h-full"
              />

              {/* Map Controls */}
              <ControlPanel
                showRoutes={showRoutes}
                showLegend={showLegend}
                showStats={showStats}
                autoFit={autoFit}
                onToggleRoutes={() => setShowRoutes(prev => !prev)}
                onToggleLegend={() => setShowLegend(prev => !prev)}
                onToggleStats={() => setShowStats(prev => !prev)}
                onToggleAutoFit={() => setAutoFit(prev => !prev)}
                onCenterOnLocation={handleCenterOnLocation}
              />
            </motion.div>
          </div>

          {/* Side Panel */}
          <AnimatePresence>
            {showPanel && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="hidden lg:block border-r border-border/50 overflow-hidden"
                style={{ maxHeight: 'calc(100vh - 56px)' }}
              >
                <div className="h-full overflow-y-auto custom-scrollbar">
                  <InfoPanel
                    nurses={nurses}
                    beneficiaries={DEMO_BENEFICIARIES}
                    emergencies={DEMO_EMERGENCIES}
                    userLocation={userLocation}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Info Panel (below map on small screens) */}
        <div className="lg:hidden">
          <InfoPanel
            nurses={nurses}
            beneficiaries={DEMO_BENEFICIARIES}
            emergencies={DEMO_EMERGENCIES}
            userLocation={userLocation}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Heart className="w-3 h-3 text-red-500" />
            <span>عافيتك - منصة الرعاية الصحية المنزلية</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            صنعاء، اليمن • {new Date().toLocaleDateString('ar')}
          </div>
        </div>
      </footer>
    </div>
  );
}
