# Worklog - Aafiatak Healthcare Platform Fixes

## Date: 2024-03-05

### Task 1: Fix `awaiting_payment` status showing in English

#### 1a. `src/components/common/badge-status.tsx`
- Added `awaiting_payment` to the `BadgeStatusVariant` type union
- Added `awaiting_payment` entry to `statusConfig` with Arabic label `'بانتظار تأكيد الدفع'` and orange styling

#### 1b. `src/app/admin/orders/page.tsx`
- Added `awaiting_payment: 'بانتظار تأكيد الدفع'` to `statusLabels`
- Added `awaiting_confirmation: 'بانتظار التأكيد'` to `paymentStatusLabels`
- Added `{ value: 'awaiting_payment', label: 'بانتظار الدفع' }` tab to tabs array
- Added `hasPaymentProof` field to `OrderItem` interface
- In `OrderDetailView` Payment Info section:
  - Added display of `paymentMethod` (طريقة الدفع)
  - Added display of `hasPaymentProof` with green badge showing "مرفق" (attached)
- Updated search placeholder to include "أو رقم الطلب" (or order number)

#### 1c. `src/app/beneficiary/orders/page.tsx`
- Added `awaiting_payment: { label: 'بانتظار تأكيد الدفع', variant: 'pending' }` to `statusMap`
- Added `awaiting_payment` to active statuses in `statusMapByTab`: `'pending,assigned,accepted,in_progress,awaiting_payment'`

### Task 2: Fix admin notification bell

#### `src/components/layout/top-header.tsx`
- Added import: `import { NotificationBell } from '@/components/common/notification-bell'`
- Removed unused imports: `useCallback`, `Bell`, `useAuthFetch`, `Badge`
- Removed `getNotificationsPath` function
- Removed `unreadCount` state, `fetchUnreadCount` callback, and all 3 related useEffects (polling, focus, custom event)
- Replaced the entire Notifications Bell Button block with `<NotificationBell />`

### Task 3: Make WhatsApp order number copyable

#### `src/app/beneficiary/request/[serviceId]/page.tsx`
- Changed order number line to use WhatsApp monospace backticks for easy copying:
  - Before: `` `📋 *رقم الطلب:* #${orderId.slice(-6).toUpperCase()` ``
  - After: `` `📋 *رقم الطلب:* \`#${orderId.slice(-6).toUpperCase()}\`` ``
- Added full order ID on a separate line:
  - `` `🆔 *معرف الطلب:* \`${orderId}\`` ``

### Task 4: Admin order search by order number/ID

#### 4a. `src/app/api/admin/orders/route.ts`
- Added order ID search logic in the search block:
  - If search looks like a hex string (`/^[0-9a-fA-F]+$/`), validates as MongoDB ObjectId and adds to filter
  - Uses dynamic import `await import('mongoose')` to get `Types.ObjectId`
  - Also added `beneficiaryAddress` regex search to `$or` conditions

#### 4b. `src/app/admin/orders/page.tsx`
- Updated search placeholder from `"بحث بالاسم أو الهاتف..."` to `"بحث بالاسم أو الهاتف أو رقم الطلب..."`

### Verification
- Ran `bun run lint` - no new lint errors introduced in modified files
- Pre-existing lint errors (in data-table.tsx and socket-provider.tsx) are unrelated to these changes

---
Task ID: 2
Agent: full-stack-developer
Task: Redesign login/register pages with professional design

Work Log:
- Read and analyzed existing page.tsx (1496 lines), types/index.ts, and nurse registration API route
- Removed `confirmPassword` from both `nurseRegisterSchema` and `beneficiaryRegisterSchema` Zod schemas
- Removed `.refine()` password match validation from both schemas
- Removed `confirmPassword` from form default values for both nurse and beneficiary forms
- Removed `showConfirmPassword` state variable
- Removed all confirmPassword form fields from 4 locations (desktop beneficiary, desktop nurse, mobile beneficiary, mobile nurse)
- Added `address` field to `nurseRegisterSchema` with min 1 validation and message 'العنوان التفصيلي مطلوب'
- Added `address` to nurse form default values
- Added address input field with MapPin icon in both desktop and mobile nurse registration forms
- Added address auto-fill from GPS location detection in nurse forms
- Updated `onNurseRegister` to include `address: data.address` in the registerNurse call
- Changed nurse name label from "الاسم الكامل" to "الاسم الرباعي"
- Changed nurse name placeholder to "الاسم الرباعي (أربعة أجزاء)"
- Added custom validation: when nurse form submitted, if name has <4 words, triggers shake animation and warning message
- Implemented shake animation using framer-motion with x keyframes [0, -10, 10, -8, 8, -4, 4, 0] over 0.5s
- Added red border highlight during shake via conditional className
- Added `nurseNameShake` and `nurseNameWarning` state variables for controlling animation
- Replaced 10-item specializations array with expanded 25-item list
- Added `AlertTriangle` icon import from lucide-react for the name warning
- Created `PasswordStrengthBar` component with colored strength indicator (5 segments)
- Created `getPasswordStrength` helper function for calculating password strength
- Added password strength indicator below all password fields (login + register forms)
- Added `PasswordStrengthBar` watchers for all 3 form password values
- Professional design improvements:
  - Added gradient background sections for form field groups (personal, professional, location, security)
  - Each section has a colored header with icon and Arabic label
  - Improved register role toggle buttons with icon backgrounds that change based on selection
  - Added shadow effects to active role buttons
  - Added subtle scale-on-focus micro-interactions (focus:scale-[1.01]) to all input fields
  - Added transition-all duration-200 to input fields
  - Consistent rounded-xl styling across all inputs
  - Card-like grouping with gradient backgrounds and colored borders
- Added `address?: string` to `RegisterNurseRequest` interface in types/index.ts
- Updated nurse registration API route to destructure `address` from request body and include in Nurse.create() call
- Verified build succeeds with `npx next build`
- Ran ESLint on page.tsx - only pre-existing warning about react-hook-form watch() (not an error)

Stage Summary:
- All 7 required changes implemented successfully
- Build passes with no errors
- No new lint errors introduced
- Professional redesign includes gradient section grouping, password strength indicator, shake animation for name validation, expanded specializations, and address field for nurses
