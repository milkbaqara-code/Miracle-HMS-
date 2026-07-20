# ZONE 07: MASTER COMMAND GRID ARCHITECTURE

## STRICT DIRECTIVES FOR ALL DEVELOPERS

Any developer modifying Zone 7 (Master Command Grid) MUST strictly adhere to these architectural laws. Failure to do so will result in broken data pipelines and degraded UI aesthetics.

### 1. Data Pipeline & Mapping
- **Asset Classes:** The fallback types and UI tabs rely on exact string matching. Any change to a tab label (e.g., changing "MARINE" to "CRUISE") **must** include an explicit mapper in the `filteredRooms` logic. Never rely on the UI label matching the backend database `assetClass` if they differ.
- **Room IDs:** The grid runs on the new 7-star ID system (`RS-01`, `OB-01`, etc.). Backend tables (`guest_folios`, `asset_grid`, etc.) must use these exact strings. Old designations (like `O-01`) will disconnect the signals.
- **Caching:** The grid is a live system. The Next.js fetch calls in `fetchSafe` MUST use `cache: 'no-store'` to bypass aggressive caching, ensuring live signals (like 'IN_HOUSE' and 'DIRTY') reflect instantly.

### 2. The Sovereign Holographic Overlay (CSS Requirements)
- **The Wrapper:** The main `div` in `page.tsx` must ALWAYS have the `sovereign-data-grid` class.
- **Mix-Blend-Mode:** The holographic background grid is injected via `.sovereign-data-grid::after`. It uses `mix-blend-mode: screen`.
- **Opacity Law:** Because the page background is pitch black (`#080808`), the grid lines `rgba(255, 255, 255, X)` must have an opacity `X` of **at least 0.08**. Anything lower (like 0.015) will render the grid completely invisible to the human eye due to the screen blending math.

### 3. Flowing Data Pulses (The Green Neon Dots)
- The grid is ALIVE. It features flowing neon dots that travel across the X and Y axes of the grid.
- These are powered by the `.data-pulse-x` and `.data-pulse-y` classes.
- **Color Directive:** The pulses MUST be bright neon green (`#00FF88`), NOT cyan or blue, to maintain the correct visual identity.
- **Glow Profile:** They must retain a noticeable, but slightly blurred `box-shadow` to simulate light emitting from within the dark void, not a flat shape.

**Violating any of these three core principles breaks Zone 7.**
