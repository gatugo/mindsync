# Progress Notes - Jan 21, 2026

## AI Coach Enhancements & UI Polish

### Achieved
1.  **Mobile DatePicker Fix**: Resolved layout issues on mobile devices by centering the calendar modal.
2.  **User Personalization**:
    -   Added `UserPreferences` (Hobbies, Interests, Passions) to `useStore`.
    -   Integrated preferences into the AI Coach's system prompt context.
    -   AI now tailors advice based on these psychological "Child" needs.
3.  **Explicit Communication**:
    -   Updated `COACH_SYSTEM_PROMPT` to explicitly confirm scheduled dates and times in natural language responses.
4.  **UI/UX Improvements**:
    -   **Send Button**: Replaced with a branded, gradient-styled button using the Lucide `Send` icon. Matches the app's indigo-purple theme.
    -   **Chat Input**: Made the input always active. Clicking it automatically switches the mode to 'Chat', removing friction.
    -   **Alignment**: Fixed vertical alignment issues between the input field and the send button (`h-14`).
5.  **Anonymization**:
    -   Replaced personal user data in `src/store/useStore.ts` with generic placeholders (Reading, Hiking, etc.) to prepare the codebase for public repository sharing.
    -   **Local Override**: Configured the app to read personal preferences from `.env.local` (specifically `NEXT_PUBLIC_USER_HOBBIES`, etc.). This allows you to keep your personal context active locally while pushing safe, generic code to GitHub.

### Jan 24, 2026 - AI Coach Intelligence Overhaul & Date Fixes

#### 1. AI Coach Intelligence & Specificity
*   **Overhauled Prompts**: Updated `COACH_SYSTEM_PROMPT` to demand **Authoritative & Specific** advice. The Coach now prescribes concrete tasks with specific durations and times instead of generic suggestions.
*   **Context Filtering**: Fixed a major bug where the AI was receiving the *entire* task history as "Today's Tasks". It now strictly receives only the current local day's tasks, making its insights much sharper.
*   **Conflict Resolution**: Improved `calculateFreeSlots` and AI instructions to better resolve scheduling conflicts based on the user's "Available Slots".

#### 2. Robust Date/Time Parsing & Display
*   **Timezone Fix**: Resolved a critical bug where "Detected" dates (like "tomorrow") were shown as the previous day in Western timezones (PST). Dates are now interpreted as **Local Midday** for display.
*   **Unified Action Blocks**: Standardized the `[ACTION: CREATE_TASK]` format across all AI modes to include `Date` (YYYY-MM-DD), ensuring tasks are added to the correct day regardless of the conversation context.
*   **Case-Insensitive Parsing**: Added robustness to the frontend parsing logic to handle diverse AI output formats (e.g., `[action: create_task]`).

#### 3. Infrastructure & Tools
*   **Browser Agent Fix**: Diagnosed and applied a fix for the browser tool's environment (setting `$HOME`).
*   **Build Verification**: Verified all changes with `npm run build`.

### Jan 23, 2026 - AI Sync & Polish
- **Time Awareness**: AI now knows the exact local time for relative scheduling.
- **Streaming**: AI responses now stream word-by-word.
- **Mobile Header**: Fixed crowding by compacting buttons.
- **Security**: Secured data import/export behind a login-gated modal.

### Future Plans / Next Steps
*   **Persist Rate Limits**: Move from in-memory (Map) to Redis (Upstash) for production robustness.
*   **E2E Testing**: Fix the browser agent environment permanently and add core flow tests.
*   **PWA**: Finalize service worker and manifest for installation.
