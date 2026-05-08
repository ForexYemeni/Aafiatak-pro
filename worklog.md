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
