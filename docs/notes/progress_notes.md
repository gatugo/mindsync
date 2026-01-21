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

### Future Plans / Next Steps
*   **AI <-> Kanban/Timeline Integration**:
    *   **Goal**: Allow the AI to directly modify the board state (move cards, create complex tasks with sub-steps).
    *   **Status**: Awaiting specific user examples/use-cases to design the interaction model.
    *   **Tech**: Will likely involve expanding the `[ACTION: CREATE_TASK]` parsing logic in `AICoachModal` or a dedicated middleware.
*   **Optimization**:
    *   Refine the prompt further based on real-world usage to prevent "hallucinations" of completed tasks.
