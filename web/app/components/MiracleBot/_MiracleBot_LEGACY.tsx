// ============================================================
// _MiracleBot_LEGACY.tsx  —  ARCHIVED SOVEREIGN MONOLITH  V3.1
// ============================================================
//
// This file is a MARKER. The original 2,550-line MiracleBot.tsx
// (V3.1) has been superseded by the V4.0 modular architecture
// in the MiracleBot/ directory.
//
// ARCHIVE DATE  : 2026-06-17
// ORIGINAL SIZE : 2,550 lines / 119,910 bytes
// REASON        : Enterprise refactor — monolith → 19-file
//                 modular architecture (V4.0 Sovereign Kernel)
//
// RECOVERY      : The full original source is preserved in git
//                 history under the path:
//                   web/app/components/MiracleBot.tsx
//                 (commit before V4.0 migration)
//
// NEW ENTRYPOINT: web/app/components/MiracleBot/index.tsx
//
// STRUCTURE OF NEW ARCHITECTURE (V4.0):
// ─────────────────────────────────────
// MiracleBot/
// ├── index.tsx                         ← Sovereign Root Orchestrator
// ├── lib/
// │   ├── types.ts                      ← Shared TypeScript interfaces
// │   ├── constants.ts                  ← Zone IDs, API URLs, limits
// │   ├── zoneResolver.ts               ← Path → ZoneInfo mapping
// │   ├── speechCleaner.ts              ← Phonetic TTS sanitizer
// │   ├── sessionUtils.ts               ← UUID / session helpers
// │   ├── lexicon.ts                    ← Local Brain interceptors
// │   └── ttsEngine.ts                  ← executiveSpeak() engine
// ├── hooks/
// │   ├── useMiracleSession.ts          ← Identity + auth state
// │   ├── useMiracleSpeech.ts           ← TTS + voice + mute
// │   ├── useMiracleSTT.ts              ← Speech recognition (STT)
// │   ├── useMiracleDrag.ts             ← Orb drag + ghost mode
// │   ├── useMiracleAlerts.ts           ← Polled alert monitor
// │   ├── useBrowserErrorMonitor.ts     ← JS error capture (Z-23)
// │   ├── useFeatureRequest.ts          ← Feature request form
// │   ├── useMiracleIntake.ts  [NEW]    ← Visitor intake dialog
// │   ├── useMiracleProposals.ts [NEW]  ← DB proposal hub
// │   └── useMiracleQuery.ts            ← Core AI query engine
// └── components/
//     ├── SovereignChartRenderer.tsx    ← json_chart code block renderer
//     ├── MiracleBotOrb.tsx             ← Floating flame orb
//     ├── MiracleBotPanel.tsx           ← Open chat panel shell
//     ├── MiracleBotMessages.tsx        ← Scrollable message list
//     ├── MiracleBotInput.tsx           ← Input bar + AGI chips
//     ├── MiracleBotProposalCard.tsx    ← Inline proposal card
//     ├── MiracleBotProposalHub.tsx     ← DB proposal tray [NEW]
//     └── MiracleBotIntakeDialog.tsx    ← Visitor intake overlay [NEW]
//
// ============================================================
export {};
