# Single Kernel Sync: Inventory, Images, and Billing Alignment

This plan outlines the complete resolution for the missing POS images, the broken department mappings across Z-26 to Z-29, the Guest APK display bugs, and the critical double-accounting flaw in the billing engine.

## User Review Required

> [!WARNING]
> **Billing Ledger Change**: This plan modifies the core double-entry accounting logic in `billing.py` to prevent POS revenue from being double-counted when a guest checks out. Please review the "Accounting Fix" section closely to ensure it aligns with your financial rules.

## Proposed Changes

We will execute this sync in 4 targeted phases to ensure the Guest APK, POS, and Backend APIs align perfectly.

### Phase 1: Fixing Missing Images (Google Drive Referrer Policy)

**Problem:** Google Drive blocks image requests from the Guest APK because the `<img>` tags are sending the local host origin in the request headers, resulting in a `403 Forbidden` error.
**Solution:** Apply the correct React security attributes to bypass the CORS block.

#### [MODIFY] [guest/order/page.tsx](file:///d:/Vigilant%20IT%20Solutions/Miracle_Os_Master/web/app/guest/order/page.tsx)
- Update all `<img src={item.img} ... />` tags to include `referrerPolicy="no-referrer"` and `crossOrigin="anonymous"`.
- Add an `onError` fallback to load a default placeholder image if the URL is completely broken.
- Repeat this for any other Guest APK pages displaying inventory (e.g., `guest/hub/page.tsx`).

### Phase 2: Resolving the POS Department Misalignment (Orphaned Items)

**Problem:** The backend vault normalizes departments to strings like `RS-RESTAURANT`, while the POS UI hardcodes its tabs to `Z-29-GASTRONOMY`. The regex filter fails to match them, so your items are hidden in the POS UI.
**Solution:** Align the POS terminal filters to map standard Z-Zones back to the raw database strings.

#### [MODIFY] [pos/page.tsx](file:///d:/Vigilant%20IT%20Solutions/Miracle_Os_Master/web/app/dashboard/pos/page.tsx)
- Rewrite the `deptMatch` filtering logic to cross-reference `TERMINALS` to DB strings. E.g., if the tab is `Z-29-GASTRONOMY`, it should allow `RS-RESTAURANT`, `RS-COFFEE`, etc.
- Fix the "sacrificial" hidden password input to fully prevent Chrome/Edge from hijacking the POS search bar with "ADMIN" autofills.

### Phase 3: The Double-Accounting & Billing Flaw

**Problem:** When a guest charges a POS order to their room, the system debits Accounts Receivable and credits F&B Revenue. However, when they finally check out via `billing.py`, it credits the *entire* grand total to Room Revenue. This double-counts the POS revenue and leaves the Accounts Receivable hanging permanently.
**Solution:** The checkout ledger must dynamically split the payment.

#### [MODIFY] [billing.py](file:///d:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/billing.py)
- Update the physical checkout transaction logic.
- Instead of crediting `4000 (Room Revenue)` for the `grand_total`, it will:
  1. Credit `1200 (Accounts Receivable)` for the exact amount of accumulated POS Folio charges.
  2. Credit `4000 (Room Revenue)` for the remaining balance (the actual room rate and taxes).
  3. Debit `1000 (Cash/Bank)` for the full `grand_total` paid.

### Phase 4: Guest APK Zero COGS & Service Routing

**Problem:** Guest orders currently record `0.0` for COGS because the backend looks for a `.cost` property instead of the actual `.pp` (purchase price) property in the DB. Additionally, "SERVICE" orders from the Guest APK default to the `RS` radar instead of their specific departments.
**Solution:** Fix property mapping and Z-07 ticket routing.

#### [MODIFY] [guest_api.py](file:///d:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/guest_api.py)
- Change `getattr(db_item, 'cost', 0.0)` to `getattr(db_item, 'pp', 0.0)` when mapping POS cart items.

#### [MODIFY] [pos_router.py](file:///d:/Vigilant%20IT%20Solutions/Miracle_Os_Master/backend_api/app/routers/pos_router.py)
- Enhance the `SolveMission` generation for "SERVICE" items to extract the correct radar zone (e.g., `SPA` or `HK`) rather than defaulting to the raw `dept`.

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
1. Open the POS UI and verify that items instantly populate under Gastronomy, Boutique, and Spa.
2. Open the Guest APK (locally or via live server) and verify Google Drive images load without broken icons.
3. Perform a test Room Charge in the POS, followed by a Checkout in the Billing module, and verify the General Ledger in Zone 18 shows a perfectly balanced AR clearing.
