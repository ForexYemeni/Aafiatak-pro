/**
 * Leaflet icon fix for webpack/Next.js
 *
 * The default Leaflet marker icons don't load properly with webpack
 * because Leaflet uses relative URL paths that break during bundling.
 * This module fixes that by explicitly setting the icon paths.
 *
 * Must be called before any Leaflet map is rendered.
 */

import L from 'leaflet';

// Fix default marker icon paths for webpack
// Leaflet internal API requires casting to any to delete _getIconUrl
delete (L.Icon.Default.prototype as Record<string, unknown>)['_getIconUrl'];

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom nurse marker icon (blue)
export const nurseIcon = L.divIcon({
  html: `
    <div style="position:relative;width:40px;height:40px;">
      <div style="
        position:absolute;
        width:40px;
        height:40px;
        border-radius:50%;
        background:rgba(14,165,233,0.2);
        animation:nursePulse 2s ease-in-out infinite;
      "></div>
      <div style="
        position:absolute;
        top:6px;
        left:6px;
        width:28px;
        height:28px;
        border-radius:50%;
        background:linear-gradient(135deg,#0ea5e9,#0284c7);
        border:3px solid white;
        box-shadow:0 2px 8px rgba(14,165,233,0.4);
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-size:14px;
      ">🩺</div>
    </div>
    <style>
      @keyframes nursePulse {
        0%, 100% { transform:scale(1); opacity:1; }
        50% { transform:scale(1.4); opacity:0.4; }
      }
    </style>
  `,
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

// Custom beneficiary marker icon (purple)
export const beneficiaryIcon = L.divIcon({
  html: `
    <div style="position:relative;width:40px;height:40px;">
      <div style="
        position:absolute;
        width:40px;
        height:40px;
        border-radius:50%;
        background:rgba(168,85,247,0.15);
      "></div>
      <div style="
        position:absolute;
        top:6px;
        left:6px;
        width:28px;
        height:28px;
        border-radius:50%;
        background:linear-gradient(135deg,#a855f7,#9333ea);
        border:3px solid white;
        box-shadow:0 2px 8px rgba(168,85,247,0.4);
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-size:14px;
      ">👤</div>
    </div>
  `,
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

// Custom emergency marker icon (red pulsing)
export const emergencyIcon = L.divIcon({
  html: `
    <div style="position:relative;width:48px;height:48px;">
      <div style="
        position:absolute;
        width:48px;
        height:48px;
        border-radius:50%;
        background:rgba(239,68,68,0.3);
        animation:emergencyPulse 1.2s ease-in-out infinite;
      "></div>
      <div style="
        position:absolute;
        width:48px;
        height:48px;
        border-radius:50%;
        background:rgba(239,68,68,0.15);
        animation:emergencyPulse 1.2s ease-in-out infinite 0.4s;
      "></div>
      <div style="
        position:absolute;
        top:8px;
        left:8px;
        width:32px;
        height:32px;
        border-radius:50%;
        background:linear-gradient(135deg,#ef4444,#dc2626);
        border:3px solid white;
        box-shadow:0 2px 12px rgba(239,68,68,0.5);
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-size:16px;
        font-weight:bold;
      ">🚨</div>
    </div>
    <style>
      @keyframes emergencyPulse {
        0%, 100% { transform:scale(1); opacity:1; }
        50% { transform:scale(1.5); opacity:0; }
      }
    </style>
  `,
  className: '',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -24],
});

// Nurse direction indicator icon (with heading arrow)
export function createNurseHeadingIcon(heading: number | null): L.DivIcon {
  const rotation = heading !== null ? heading : 0;
  return L.divIcon({
    html: `
      <div style="position:relative;width:44px;height:44px;">
        <div style="
          position:absolute;
          width:44px;
          height:44px;
          border-radius:50%;
          background:rgba(14,165,233,0.2);
          animation:nursePulse 2s ease-in-out infinite;
        "></div>
        <div style="
          position:absolute;
          top:8px;
          left:8px;
          width:28px;
          height:28px;
          border-radius:50%;
          background:linear-gradient(135deg,#0ea5e9,#0284c7);
          border:3px solid white;
          box-shadow:0 2px 8px rgba(14,165,233,0.4);
          display:flex;
          align-items:center;
          justify-content:center;
        ">
          <div style="
            width:0;
            height:0;
            border-left:5px solid transparent;
            border-right:5px solid transparent;
            border-bottom:10px solid white;
            transform:rotate(${rotation}deg);
            transform-origin:center center;
          "></div>
        </div>
      </div>
      <style>
        @keyframes nursePulse {
          0%, 100% { transform:scale(1); opacity:1; }
          50% { transform:scale(1.3); opacity:0.4; }
        }
      </style>
    `,
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
}
