# TRA Implementation Plan: Integration Test Coverage

**Agent:** TRA (Work Planner)
**Scale:** Large
**Date:** 2026-02-04
**Branch:** migration

---

## Summary

This plan covers test implementation for three integrations with zero existing coverage: Spotify (service + store + 7 UI components), Discord (service + store + 20 UI components), and Chrome/Code-Server (shell launch + service expansion + DevelopmentScreen consumer). The plan produces 28 task units across 3 integrations and 3 layers (service, store, UI).

---

## Stop Points

| # | Stop Point | When | Purpose |
|---|-----------|------|---------|
| 1 | Requirements | Before starting | Confirm scope: all 3 integrations, service+store+UI layers |
| 2 | Design | After Task 3 | Review mock factories and shared test utilities before bulk work |
| 3 | Plan | After Task 10 | Validate Spotify + Discord service/store tests pass before UI layer |
| 4 | Final | After Task 28 | Full suite review, coverage check, CI validation |

---

## Task List

### Phase A: Shared Test Infrastructure (Tasks 1-3)

#### Task 1: Spotify mock factories
- **ID:** 1
- **Description:** Add mock factory functions for Spotify types: `createMockSpotifyTrack`, `createMockSpotifyPlaybackState`, `createMockSpotifyPlaylist` to `tests/mocks/factories.ts`
- **Module:** `tests/mocks/factories.ts`
- **Dependencies:** []
- **Complexity:** 2/10 (Low)
- **Estimated Time:** 15min
- **BAS Gates:** [lint, build]
- **Parallelizable:** true

#### Task 2: Discord mock factories
- **ID:** 2
- **Description:** Add mock factory functions for Discord types: `createMockDiscordUser`, `createMockDiscordGuild`, `createMockDiscordChannel`, `createMockDiscordDMChannel`, `createMockDiscordMessage`, `createMockDiscordThread`, `createMockDiscordEmoji`, `createMockDiscordSticker`, `createMockDiscordStickerPack`, `createMockDiscordPoll` to `tests/mocks/factories.ts`
- **Module:** `tests/mocks/factories.ts`
- **Dependencies:** []
- **Complexity:** 3/10 (Low)
- **Estimated Time:** 25min
- **BAS Gates:** [lint, build]
- **Parallelizable:** true

#### Task 3: Shared fetch/IPC mock helpers
- **ID:** 3
- **Description:** Create `tests/mocks/fetch-helpers.ts` with reusable `createMockFetchResponse(status, body, headers?)` and `createMockFetchError(status, statusText)` helpers. Both Spotify and Discord services use global `fetch` heavily; centralizing mock response creation prevents duplication across 50+ test cases.
- **Module:** `tests/mocks/fetch-helpers.ts`
- **Dependencies:** []
- **Complexity:** 2/10 (Low)
- **Estimated Time:** 15min
- **BAS Gates:** [lint, build]
- **Parallelizable:** true

---

### Phase B: Spotify Service Tests (Tasks 4-6)

#### Task 4: SpotifyService - connection and auth flow tests
- **ID:** 4
- **Description:** Test `initialize`, `isConnected`, `startAuthFlow`, `disconnect`, and the private `getValidToken`/`refreshAccessToken`/`storeTokens` flow (tested indirectly through public methods). Mock: `secureStorage` (getItem/setItem/removeItem), `database.getSetting`, `fetch` (for token exchange), `shell.openExternal`, `http.createServer` (callback server). Test cases: (a) isConnected returns true when refresh token exists, (b) isConnected returns false when no token, (c) startAuthFlow throws when no clientId, (d) startAuthFlow opens browser with correct PKCE params, (e) disconnect clears all tokens, (f) token refresh on expired token, (g) token refresh failure clears tokens and throws, (h) 60-second buffer on token expiry check.
- **Module:** `tests/main/services/spotify.service.test.ts`
- **Dependencies:** [1, 3]
- **Complexity:** 7/10 (High)
- **Estimated Time:** 90min
- **BAS Gates:** [lint, build, test, coverage]
- **Parallelizable:** false

#### Task 5: SpotifyService - playback control and library tests
- **ID:** 5
- **Description:** Test all playback methods: `getPlaybackState`, `play`, `pause`, `next`, `previous`, `seek`, `setShuffle`, `setVolume`. Also test library methods: `saveTrack`, `removeTrack`, `isTrackSaved`. Test the private `apiRequest` 401-retry logic and `mapTrack` mapping (indirectly through `getPlaybackState`). Mock: `fetch` responses. Test cases: (a) getPlaybackState returns mapped state, (b) getPlaybackState returns null on empty/204, (c) play with uri, (d) play with contextUri, (e) play with no args (resume), (f) pause calls PUT, (g) next calls POST, (h) previous calls POST, (i) seek rounds to integer, (j) setVolume clamps 0-100, (k) 401 triggers token refresh and retry, (l) 401 retry only once (no infinite loop), (m) saveTrack sends PUT with ids, (n) removeTrack sends DELETE with ids, (o) isTrackSaved returns boolean from array.
- **Module:** `tests/main/services/spotify.service.test.ts`
- **Dependencies:** [4]
- **Complexity:** 6/10 (Medium)
- **Estimated Time:** 75min
- **BAS Gates:** [lint, build, test, coverage]
- **Parallelizable:** false

#### Task 6: SpotifyService - playlists, search, queue, cleanup tests
- **ID:** 6
- **Description:** Test `getPlaylists`, `playPlaylist`, `search`, `addToQueue`, `cleanup`. Test cases: (a) getPlaylists maps items correctly, (b) getPlaylists returns empty array on null items, (c) playPlaylist sends context_uri, (d) search sends correct params, (e) search maps tracks via mapTrack, (f) addToQueue encodes URI, (g) cleanup closes callback server, (h) cleanup is idempotent when no server.
- **Module:** `tests/main/services/spotify.service.test.ts`
- **Dependencies:** [5]
- **Complexity:** 4/10 (Medium)
- **Estimated Time:** 45min
- **BAS Gates:** [lint, build, test, coverage]
- **Parallelizable:** false

---

### Phase C: Spotify Store Tests (Tasks 7-8)

#### Task 7: useSpotifyStore - connection and playback actions
- **ID:** 7
- **Description:** Test store actions: `checkConnection`, `startAuth` (with polling mock), `disconnect`, `fetchPlayback`, `play`, `pause`, `next`, `previous`, `toggleShuffle`. Mock: IPC client (`ipc.invoke`). Test cases: (a) checkConnection sets connected=true on success, (b) checkConnection sets connected=false on error, (c) startAuth sets loading=true, starts polling, (d) startAuth clears polling after connection, (e) disconnect resets all state, (f) fetchPlayback updates playback and lastFetchedAt, (g) fetchPlayback silently fails on error, (h) play calls IPC and triggers fetchPlayback after 300ms, (i) pause calls IPC and triggers fetchPlayback, (j) previous seeks to 0 when progress > 3s, (k) previous goes to previous track when progress <= 3s, (l) toggleShuffle inverts current state.
- **Module:** `tests/renderer/stores/useSpotifyStore.test.ts`
- **Dependencies:** [1]
- **Complexity:** 6/10 (Medium)
- **Estimated Time:** 75min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** false

#### Task 8: useSpotifyStore - volume, playlists, search, library, interpolation
- **ID:** 8
- **Description:** Test: `setVolume` (debounced 150ms IPC call, immediate UI update), `fetchPlaylists`, `playPlaylist`, `search` (empty query returns []), `addToQueue`, `saveTrack`, `removeTrack`, `isTrackSaved`, `setActiveTab`, `setSearchQuery`, `getInterpolatedProgress`. Use `vi.useFakeTimers` for debounce and interpolation tests. Test cases: (a) setVolume updates playback.volumePercent immediately, (b) setVolume debounces IPC call 150ms, (c) rapid setVolume calls only send one IPC call, (d) fetchPlaylists populates playlists, (e) search with empty string clears results, (f) search populates searchResults, (g) getInterpolatedProgress returns 0 when no playback, (h) getInterpolatedProgress returns progressMs when paused, (i) getInterpolatedProgress adds elapsed time when playing, (j) getInterpolatedProgress caps at track duration.
- **Module:** `tests/renderer/stores/useSpotifyStore.test.ts`
- **Dependencies:** [7]
- **Complexity:** 6/10 (Medium)
- **Estimated Time:** 60min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** false

---

### Phase D: Discord Service Tests (Tasks 9-12)

#### Task 9: DiscordService - connection, auth, and token management
- **ID:** 9
- **Description:** Test `initialize`, `isConnected`, `connect`, `disconnect`, and private `getToken`/`apiRequest`/`apiRequestWithToken` (indirectly). Mock: `secureStorage`, `database.getSetting`, `fetch`. Test cases: (a) isConnected returns true when SecureStorage has token, (b) isConnected syncs from database to SecureStorage when SecureStorage empty, (c) isConnected returns false when both empty, (d) connect validates token via /users/@me, (e) connect throws when no token anywhere, (f) connect stores valid token in SecureStorage, (g) disconnect removes token, (h) getToken fallback from SecureStorage to database, (i) rate limit 429 retry with Retry-After header, (j) rate limit max 3 retries, (k) cleanup is no-op.
- **Module:** `tests/main/services/discord.service.test.ts`
- **Dependencies:** [2, 3]
- **Complexity:** 7/10 (High)
- **Estimated Time:** 90min
- **BAS Gates:** [lint, build, test, coverage]
- **Parallelizable:** false

#### Task 10: DiscordService - guilds, channels, DMs, users
- **ID:** 10
- **Description:** Test `getUser`, `getGuilds`, `getGuildChannels`, `getGuildEmojis`, `getDMChannels`, `getChannel`, `createDM`. Verify correct API paths and response mapping including `mapUser`, `mapChannel`. Test cases: (a) getUser returns mapped user, (b) getUser returns null on error, (c) getGuilds maps guild array, (d) getGuildChannels maps channels with availableTags, (e) getGuildEmojis maps with guildId, (f) getDMChannels maps recipients, (g) getChannel maps single channel, (h) createDM sends recipient_id.
- **Module:** `tests/main/services/discord.service.test.ts`
- **Dependencies:** [9]
- **Complexity:** 5/10 (Medium)
- **Estimated Time:** 60min
- **BAS Gates:** [lint, build, test, coverage]
- **Parallelizable:** false

#### Task 11: DiscordService - messages, reactions, attachments, typing, pins
- **ID:** 11
- **Description:** Test `getMessages`, `sendMessage`, `editMessage`, `deleteMessage`, `addReaction`, `removeReaction`, `triggerTyping`, `getPinnedMessages`, `sendMessageWithAttachments`. Verify `mapMessage` handles nested referenced_message, attachments, embeds, reactions, sticker_items, poll. Test cases: (a) getMessages with pagination (before param), (b) sendMessage with reply, (c) editMessage calls PATCH, (d) deleteMessage calls DELETE, (e) addReaction URL-encodes emoji, (f) removeReaction uses apiDeleteNoBody, (g) sendMessageWithAttachments uses FormData, (h) sendMessageWithAttachments retries on 429, (i) mapMessage handles referenced_message recursion, (j) mapAttachment/mapEmbed/mapReaction null safety.
- **Module:** `tests/main/services/discord.service.test.ts`
- **Dependencies:** [10]
- **Complexity:** 7/10 (High)
- **Estimated Time:** 90min
- **BAS Gates:** [lint, build, test, coverage]
- **Parallelizable:** false

#### Task 12: DiscordService - forums, threads, GIFs, stickers, polls
- **ID:** 12
- **Description:** Test `getForumThreads` (with fallback to active threads), `createForumThread`, `getThreadMessages`, `sendThreadMessage`, `searchGifs`, `getTrendingGifs`, `getStickerPacks`, `getGuildStickers`, `sendSticker`, `createPoll`. Test cases: (a) getForumThreads primary path with sort/filter/offset, (b) getForumThreads fallback to guild active threads, (c) getForumThreads double-fallback returns empty, (d) createForumThread with appliedTags, (e) getThreadMessages delegates to getMessages, (f) sendThreadMessage delegates to sendMessage, (g) searchGifs maps response, (h) searchGifs returns [] on error, (i) getTrendingGifs maps response, (j) getStickerPacks maps nested stickers, (k) getGuildStickers maps array, (l) sendSticker sends sticker_ids, (m) createPoll sends poll object with correct structure.
- **Module:** `tests/main/services/discord.service.test.ts`
- **Dependencies:** [11]
- **Complexity:** 6/10 (Medium)
- **Estimated Time:** 75min
- **BAS Gates:** [lint, build, test, coverage]
- **Parallelizable:** false

---

### Phase E: Discord Store Tests (Tasks 13-16)

#### Task 13: useDiscordStore - connection and guild/DM fetching
- **ID:** 13
- **Description:** Test `checkConnection`, `connect`, `disconnect`, `fetchGuilds`, `fetchGuildChannels`, `fetchGuildEmojis`, `fetchDMChannels`. Mock: IPC client. Test cases: (a) checkConnection fetches user when connected, (b) checkConnection resets user when not connected, (c) connect sets connected+user+loading, (d) connect sets error on failure, (e) disconnect resets all state, (f) fetchGuilds populates guilds, (g) fetchGuildChannels merges into guildChannels record, (h) fetchGuildEmojis merges into guildEmojis record, (i) fetchDMChannels populates dmChannels.
- **Module:** `tests/renderer/stores/useDiscordStore.test.ts`
- **Dependencies:** [2]
- **Complexity:** 5/10 (Medium)
- **Estimated Time:** 60min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** false

#### Task 14: useDiscordStore - message operations
- **ID:** 14
- **Description:** Test `fetchMessages`, `loadMoreMessages`, `sendMessage`, `editMessage`, `deleteMessage`, `addReaction`, `removeReaction`, `sendMessageWithAttachments`, `triggerTyping`, `fetchPinnedMessages`. Test cases: (a) fetchMessages replaces messages array, (b) loadMoreMessages appends to messages, (c) loadMoreMessages no-op when no channel, (d) sendMessage prepends new message, (e) editMessage updates in-place, (f) deleteMessage filters out message, (g) addReaction calls IPC, (h) sendMessageWithAttachments prepends message, (i) triggerTyping silently fails, (j) fetchPinnedMessages populates pinnedMessages.
- **Module:** `tests/renderer/stores/useDiscordStore.test.ts`
- **Dependencies:** [13]
- **Complexity:** 5/10 (Medium)
- **Estimated Time:** 60min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** false

#### Task 15: useDiscordStore - stickers, GIFs, polls
- **ID:** 15
- **Description:** Test `fetchStickerPacks`, `fetchGuildStickers`, `sendSticker`, `searchGifs`, `getTrendingGifs`, `createPoll`. Test cases: (a) fetchStickerPacks populates stickerPacks, (b) fetchGuildStickers merges into guildStickers record, (c) sendSticker prepends message, (d) searchGifs returns array, (e) searchGifs returns [] on error, (f) getTrendingGifs returns array, (g) createPoll prepends message.
- **Module:** `tests/renderer/stores/useDiscordStore.test.ts`
- **Dependencies:** [14]
- **Complexity:** 4/10 (Medium)
- **Estimated Time:** 40min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** false

#### Task 16: useDiscordStore - navigation state machine and forum actions
- **ID:** 16
- **Description:** Test all navigation actions: `selectGuild`, `selectDMs`, `openChannel`, `openForumChannel`, `openThread`, `goBack`. Test forum actions: `fetchForumThreads` (initial + load more), `loadMoreForumThreads`, `setForumSort`, `toggleForumTag`, `createForumThread`. Test cases: (a) selectGuild sets view='server' + fetches channels, (b) selectDMs sets view='dms' + fetches DMs, (c) openChannel sets view='messages' + fetches messages, (d) openForumChannel resolves availableTags from guildChannels, (e) openThread sets view='thread' + fetches messages, (f) goBack from thread returns to forum, (g) goBack from messages returns to server, (h) goBack from messages with no guild returns to dms, (i) fetchForumThreads replaces on offset=0, (j) fetchForumThreads appends on offset>0, (k) setForumSort clears threads and re-fetches, (l) toggleForumTag adds/removes tag and re-fetches, (m) createForumThread refreshes thread list.
- **Module:** `tests/renderer/stores/useDiscordStore.test.ts`
- **Dependencies:** [15]
- **Complexity:** 7/10 (High)
- **Estimated Time:** 90min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** false

---

### Phase F: Code-Server Service Tests - Expansion (Tasks 17-18)

#### Task 17: CodeServerService - JSONC parser and settings sync edge cases
- **ID:** 17
- **Description:** Expand existing `tests/main/services/code-server.service.test.ts` with additional coverage. Test `stripJsonc` (private, tested indirectly through `syncVSCodeSettings`): line comments, block comments, trailing commas, comments inside strings (should be preserved), nested block comments. Test `syncVSCodeSettings` edge cases: host file with JSONC, existing code-server settings override host, required overrides always win, terminal profile injection. Test cases: (a) JSONC with line comments parses correctly, (b) JSONC with block comments parses correctly, (c) trailing commas are stripped, (d) comments inside string values are preserved, (e) required overrides (workspace trust, git) always applied, (f) terminal profile for cola-bash injected, (g) existing code-server theme preserved over host theme.
- **Module:** `tests/main/services/code-server.service.test.ts`
- **Dependencies:** []
- **Complexity:** 5/10 (Medium)
- **Estimated Time:** 60min
- **BAS Gates:** [lint, build, test, coverage]
- **Parallelizable:** true

#### Task 18: CodeServerService - start lifecycle, stop, waitForReady
- **ID:** 18
- **Description:** Test `start` (concurrent start guard, running state guard, full lifecycle), `stop` (graceful + force fallback), `waitForReady` (polling with timeout). Mock: `net.createServer` for findFreePort, `fetch` for healthz, `execFileAsync` for docker commands. Test cases: (a) start calls checkDockerAvailable, (b) start finds free port, (c) start syncs settings + creates gitconfig + creates bashrc, (d) start builds correct docker run args, (e) start waits for health check, (f) start sets running/port/containerName state, (g) concurrent start waits for in-progress, (h) start stops existing container first, (i) stop graceful then force fallback, (j) stop resets state, (k) stop no-op when no container, (l) waitForReady retries on connection refused, (m) waitForReady throws after 60 attempts.
- **Module:** `tests/main/services/code-server.service.test.ts`
- **Dependencies:** [17]
- **Complexity:** 7/10 (High)
- **Estimated Time:** 90min
- **BAS Gates:** [lint, build, test, coverage]
- **Parallelizable:** false

---

### Phase G: Spotify UI Component Tests (Tasks 19-21)

#### Task 19: SpotifyConnect and SpotifyPlayer component tests
- **ID:** 19
- **Description:** Test `SpotifyConnect`: renders auth button, shows loading state during auth, displays error messages. Test `SpotifyPlayer`: renders popover trigger, checks connection on mount, starts 3s polling when open+connected, stops polling on close, renders tab navigation, renders disconnect button when connected, shows SpotifyConnect when disconnected. Mock: `useSpotifyStore` via Zustand setState. Use `vi.useFakeTimers` for polling interval.
- **Module:** `tests/renderer/components/spotify/SpotifyPlayer.test.tsx`
- **Dependencies:** [1, 8]
- **Complexity:** 6/10 (Medium)
- **Estimated Time:** 75min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** true

#### Task 20: PlaybackControls and NowPlaying component tests
- **ID:** 20
- **Description:** Test `PlaybackControls`: renders play/pause button based on isPlaying, calls play/pause/next/previous/toggleShuffle on click, shuffle button active state. Test `NowPlaying`: displays track name and artists, shows album art, renders progress bar with interpolated progress, calls PlaybackControls and VolumeControl. Mock store state with playback data from factories.
- **Module:** `tests/renderer/components/spotify/PlaybackControls.test.tsx`
- **Dependencies:** [1, 8]
- **Complexity:** 5/10 (Medium)
- **Estimated Time:** 60min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** true

#### Task 21: VolumeControl, PlaylistPanel, SearchPanel component tests
- **ID:** 21
- **Description:** Test `VolumeControl`: renders volume slider, mute button toggles volume 0/previous, slider onChange calls setVolume. Test `PlaylistPanel`: fetches playlists on mount, renders playlist items, click calls playPlaylist. Test `SearchPanel`: renders search input, typing calls search (or setSearchQuery), results render track items, play/queue/save buttons call correct actions. Mock store.
- **Module:** `tests/renderer/components/spotify/VolumeAndPanels.test.tsx`
- **Dependencies:** [1, 8]
- **Complexity:** 5/10 (Medium)
- **Estimated Time:** 60min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** true

---

### Phase H: Discord UI Component Tests (Tasks 22-27)

#### Task 22: DiscordClient and DiscordConnect component tests
- **ID:** 22
- **Description:** Test `DiscordClient`: renders popover trigger, checks connection on open, fetches guilds+DMs when connected, shows DiscordConnect when disconnected, renders ServerList+ChannelList/DMList+MessageList layout based on view state, disconnect button visible when connected. Test `DiscordConnect`: renders token input prompt, validates token on submit, shows loading and error states. Mock: `useDiscordStore`.
- **Module:** `tests/renderer/components/discord/DiscordClient.test.tsx`
- **Dependencies:** [2, 16]
- **Complexity:** 6/10 (Medium)
- **Estimated Time:** 75min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** false

#### Task 23: ServerList, ChannelList, DMList component tests
- **ID:** 23
- **Description:** Test `ServerList`: renders guild icons, DM button, click calls selectGuild/selectDMs, active state highlighting. Test `ChannelList`: renders categories with collapsible sections, channel type icons (text/voice/forum), click calls openChannel/openForumChannel, back button. Test `DMList`: renders user avatars and names, group DM count, click calls openChannel with type 'dm'.
- **Module:** `tests/renderer/components/discord/Navigation.test.tsx`
- **Dependencies:** [2, 16]
- **Complexity:** 5/10 (Medium)
- **Estimated Time:** 60min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** true

#### Task 24: MessageList, MessageItem, MessageInput component tests
- **ID:** 24
- **Description:** Test `MessageList`: renders messages in order, 10s polling interval, scroll to bottom on new message, load more on scroll up, pinned messages toggle. Test `MessageItem`: renders author avatar and name, timestamp formatting, message content, system message variants, edit/delete/reply action buttons, referenced message display. Test `MessageInput`: auto-expanding textarea, send on Enter, shift+Enter for newline, file upload trigger, typing indicator (triggerTyping), edit mode, reply mode.
- **Module:** `tests/renderer/components/discord/Messages.test.tsx`
- **Dependencies:** [2, 16]
- **Complexity:** 8/10 (High)
- **Estimated Time:** 120min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** false

#### Task 25: ForumThreadList and CreatePollModal component tests
- **ID:** 25
- **Description:** Test `ForumThreadList`: renders thread cards, sort dropdown, tag filter buttons, create thread button, load more pagination, click opens thread. Test `CreatePollModal`: renders question input, dynamic answer fields (add/remove), duration selector, multiselect toggle, validation (min 2 answers, non-empty question), submit calls createPoll.
- **Module:** `tests/renderer/components/discord/ForumAndPoll.test.tsx`
- **Dependencies:** [2, 16]
- **Complexity:** 6/10 (Medium)
- **Estimated Time:** 75min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** true

#### Task 26: EmojiPicker, GifPicker, StickerPicker, PickerPanel component tests
- **ID:** 26
- **Description:** Test `PickerPanel`: renders tabs for emoji/gif/sticker, switches active picker. Test `EmojiPicker`: renders categories, search filters emojis, custom emoji section from guild, recent emojis, click selects emoji. Test `GifPicker`: shows trending on open, search replaces with results, click selects GIF. Test `StickerPicker`: guild stickers section, sticker packs, search filters, click sends sticker.
- **Module:** `tests/renderer/components/discord/Pickers.test.tsx`
- **Dependencies:** [2, 16]
- **Complexity:** 6/10 (Medium)
- **Estimated Time:** 75min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** true

#### Task 27: Renderers (EmbedRenderer, AttachmentRenderer, PollRenderer, DiscordMarkdown, ReactionBar) component tests
- **ID:** 27
- **Description:** Test `EmbedRenderer`: renders title/description/fields/author/footer/thumbnail/image, GIFV auto-play, video embed. Test `AttachmentRenderer`: image preview, video player, audio player, file download link. Test `PollRenderer`: vote bars with percentages, finalized results, vote button. Test `DiscordMarkdown`: bold, italic, code blocks, inline code, custom emotes, mentions, timestamps, URL auto-linking. Test `ReactionBar`: renders reaction counts, toggle own reaction, custom emoji rendering.
- **Module:** `tests/renderer/components/discord/Renderers.test.tsx`
- **Dependencies:** [2]
- **Complexity:** 7/10 (High)
- **Estimated Time:** 90min
- **BAS Gates:** [lint, test, coverage]
- **Parallelizable:** true

---

### Phase I: Chrome/Shell Integration Tests (Task 28)

#### Task 28: Shell launch-app and Chrome button tests
- **ID:** 28
- **Description:** Test the `shell:launch-app` IPC handler behavior for whitelisted apps (chrome, spotify, discord). Test the AppBar Chrome button: renders chrome icon, click invokes `ipc.invoke('shell:launch-app', 'chrome')`. Test rejection of non-whitelisted app names. Mock: `child_process.exec` for the `start chrome` command on Windows. Component test: render AppBar with chrome button, fireEvent.click, verify IPC call.
- **Module:** `tests/renderer/components/layout/ChromeButton.test.tsx` + `tests/main/ipc/shell-launch.test.ts`
- **Dependencies:** [3]
- **Complexity:** 3/10 (Low)
- **Estimated Time:** 30min
- **BAS Gates:** [lint, build, test, coverage]
- **Parallelizable:** true

---

## Execution Sequence

```
Phase A (parallel):  [1, 2, 3]          -- Mock factories + helpers
   |
   STOP POINT 2: Design Review
   |
Phase B (sequential): 4 -> 5 -> 6      -- Spotify service
Phase C (sequential): 7 -> 8           -- Spotify store
Phase D (sequential): 9 -> 10 -> 11 -> 12  -- Discord service
Phase E (sequential): 13 -> 14 -> 15 -> 16 -- Discord store
Phase F (sequential): 17 -> 18         -- Code-server service expansion
   |
   (B, C, D, E, F can run in parallel across integrations)
   |
   STOP POINT 3: Plan Checkpoint -- Validate service+store tests pass
   |
Phase G (parallel):  [19, 20, 21]       -- Spotify UI
Phase H:             22 -> [23, 25, 26, 27] -> 24  -- Discord UI
Phase I (parallel):  [28]               -- Chrome/shell
   |
   STOP POINT 4: Final Review
```

---

## Parallel Groups

| Group | Task IDs | Rationale |
|-------|----------|-----------|
| PG-1 | [1, 2, 3] | Independent mock factories, no shared state |
| PG-2 | [4-6] and [9-12] and [17-18] | Service tests across different integrations are independent |
| PG-3 | [7-8] and [13-16] | Store tests across different integrations are independent |
| PG-4 | [19, 20, 21] | Independent Spotify UI components |
| PG-5 | [23, 25, 26, 27] | Independent Discord UI components (after DiscordClient test) |
| PG-6 | [28] | Shell tests independent of other UI tests |

---

## Timeline

| Phase | Tasks | Sequential Time | With Parallelization |
|-------|-------|----------------|---------------------|
| A: Mock infrastructure | 1, 2, 3 | 55min | 25min |
| B: Spotify service | 4, 5, 6 | 210min | 210min |
| C: Spotify store | 7, 8 | 135min | 135min |
| D: Discord service | 9, 10, 11, 12 | 315min | 315min |
| E: Discord store | 13, 14, 15, 16 | 250min | 250min |
| F: Code-server expansion | 17, 18 | 150min | 150min |
| G: Spotify UI | 19, 20, 21 | 195min | 75min |
| H: Discord UI | 22, 23, 24, 25, 26, 27 | 495min | 345min |
| I: Chrome/shell | 28 | 30min | 30min |
| **Totals** | **28 tasks** | **1,835min (~30.6h)** | **~1,535min (~25.6h)** |

### Critical Path

```
3 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 22 -> 24
```

**Critical path time:** 25 + 90 + 60 + 90 + 75 + 60 + 60 + 40 + 90 + 75 + 120 = **785min (~13.1h)**

### BAS Gate Time
- **Per task:** ~5-7 minutes (lint + build + test + coverage)
- **Total BAS overhead:** ~28 x 6min = **168min (~2.8h)**

---

## BAS Configuration

```json
{
  "basConfiguration": {
    "linting": {
      "tool": "ESLint + Prettier",
      "autoFix": true
    },
    "coverage": {
      "threshold": 80,
      "metric": "lines and branches",
      "perFile": true
    },
    "testing": {
      "framework": "Vitest",
      "parallel": true,
      "shards": 2,
      "environment": {
        "services": "node",
        "stores": "jsdom",
        "components": "jsdom"
      }
    }
  }
}
```

---

## TRA Handoff JSON

```json
{
  "agent": "TRA",
  "tasks": [
    {
      "id": 1,
      "description": "Spotify mock factories (createMockSpotifyTrack, createMockSpotifyPlaybackState, createMockSpotifyPlaylist)",
      "module": "tests/mocks/factories.ts",
      "dependencies": [],
      "complexity": "Low",
      "estimatedTime": "15min",
      "basGates": ["lint", "build"],
      "parallelizable": true
    },
    {
      "id": 2,
      "description": "Discord mock factories (10 factory functions for all Discord types)",
      "module": "tests/mocks/factories.ts",
      "dependencies": [],
      "complexity": "Low",
      "estimatedTime": "25min",
      "basGates": ["lint", "build"],
      "parallelizable": true
    },
    {
      "id": 3,
      "description": "Shared fetch mock helpers (createMockFetchResponse, createMockFetchError)",
      "module": "tests/mocks/fetch-helpers.ts",
      "dependencies": [],
      "complexity": "Low",
      "estimatedTime": "15min",
      "basGates": ["lint", "build"],
      "parallelizable": true
    },
    {
      "id": 4,
      "description": "SpotifyService - connection, auth flow, PKCE, token refresh (8 test cases)",
      "module": "tests/main/services/spotify.service.test.ts",
      "dependencies": [1, 3],
      "complexity": "High",
      "estimatedTime": "90min",
      "basGates": ["lint", "build", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 5,
      "description": "SpotifyService - playback controls, library, 401 retry (15 test cases)",
      "module": "tests/main/services/spotify.service.test.ts",
      "dependencies": [4],
      "complexity": "Medium",
      "estimatedTime": "75min",
      "basGates": ["lint", "build", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 6,
      "description": "SpotifyService - playlists, search, queue, cleanup (8 test cases)",
      "module": "tests/main/services/spotify.service.test.ts",
      "dependencies": [5],
      "complexity": "Medium",
      "estimatedTime": "45min",
      "basGates": ["lint", "build", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 7,
      "description": "useSpotifyStore - connection, playback actions, polling (12 test cases)",
      "module": "tests/renderer/stores/useSpotifyStore.test.ts",
      "dependencies": [1],
      "complexity": "Medium",
      "estimatedTime": "75min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 8,
      "description": "useSpotifyStore - volume debounce, playlists, search, interpolation (10 test cases)",
      "module": "tests/renderer/stores/useSpotifyStore.test.ts",
      "dependencies": [7],
      "complexity": "Medium",
      "estimatedTime": "60min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 9,
      "description": "DiscordService - connection, auth, token management, rate limiting (11 test cases)",
      "module": "tests/main/services/discord.service.test.ts",
      "dependencies": [2, 3],
      "complexity": "High",
      "estimatedTime": "90min",
      "basGates": ["lint", "build", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 10,
      "description": "DiscordService - guilds, channels, DMs, users, response mapping (8 test cases)",
      "module": "tests/main/services/discord.service.test.ts",
      "dependencies": [9],
      "complexity": "Medium",
      "estimatedTime": "60min",
      "basGates": ["lint", "build", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 11,
      "description": "DiscordService - messages, reactions, attachments, typing, pins (10 test cases)",
      "module": "tests/main/services/discord.service.test.ts",
      "dependencies": [10],
      "complexity": "High",
      "estimatedTime": "90min",
      "basGates": ["lint", "build", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 12,
      "description": "DiscordService - forums, threads, GIFs, stickers, polls (13 test cases)",
      "module": "tests/main/services/discord.service.test.ts",
      "dependencies": [11],
      "complexity": "Medium",
      "estimatedTime": "75min",
      "basGates": ["lint", "build", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 13,
      "description": "useDiscordStore - connection, guild/DM fetching (9 test cases)",
      "module": "tests/renderer/stores/useDiscordStore.test.ts",
      "dependencies": [2],
      "complexity": "Medium",
      "estimatedTime": "60min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 14,
      "description": "useDiscordStore - message CRUD, reactions, attachments (10 test cases)",
      "module": "tests/renderer/stores/useDiscordStore.test.ts",
      "dependencies": [13],
      "complexity": "Medium",
      "estimatedTime": "60min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 15,
      "description": "useDiscordStore - stickers, GIFs, polls (7 test cases)",
      "module": "tests/renderer/stores/useDiscordStore.test.ts",
      "dependencies": [14],
      "complexity": "Medium",
      "estimatedTime": "40min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 16,
      "description": "useDiscordStore - navigation state machine, forum actions (13 test cases)",
      "module": "tests/renderer/stores/useDiscordStore.test.ts",
      "dependencies": [15],
      "complexity": "High",
      "estimatedTime": "90min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 17,
      "description": "CodeServerService - JSONC parser edge cases, settings sync expansion (7 test cases)",
      "module": "tests/main/services/code-server.service.test.ts",
      "dependencies": [],
      "complexity": "Medium",
      "estimatedTime": "60min",
      "basGates": ["lint", "build", "test", "coverage"],
      "parallelizable": true
    },
    {
      "id": 18,
      "description": "CodeServerService - start lifecycle, stop, waitForReady, concurrent guard (13 test cases)",
      "module": "tests/main/services/code-server.service.test.ts",
      "dependencies": [17],
      "complexity": "High",
      "estimatedTime": "90min",
      "basGates": ["lint", "build", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 19,
      "description": "SpotifyConnect + SpotifyPlayer component tests (rendering, polling, tabs)",
      "module": "tests/renderer/components/spotify/SpotifyPlayer.test.tsx",
      "dependencies": [1, 8],
      "complexity": "Medium",
      "estimatedTime": "75min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": true
    },
    {
      "id": 20,
      "description": "PlaybackControls + NowPlaying component tests (play/pause, progress, track display)",
      "module": "tests/renderer/components/spotify/PlaybackControls.test.tsx",
      "dependencies": [1, 8],
      "complexity": "Medium",
      "estimatedTime": "60min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": true
    },
    {
      "id": 21,
      "description": "VolumeControl + PlaylistPanel + SearchPanel component tests",
      "module": "tests/renderer/components/spotify/VolumeAndPanels.test.tsx",
      "dependencies": [1, 8],
      "complexity": "Medium",
      "estimatedTime": "60min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": true
    },
    {
      "id": 22,
      "description": "DiscordClient + DiscordConnect component tests (popover, auth, layout routing)",
      "module": "tests/renderer/components/discord/DiscordClient.test.tsx",
      "dependencies": [2, 16],
      "complexity": "Medium",
      "estimatedTime": "75min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 23,
      "description": "ServerList + ChannelList + DMList component tests (navigation, icons, collapsing)",
      "module": "tests/renderer/components/discord/Navigation.test.tsx",
      "dependencies": [2, 16],
      "complexity": "Medium",
      "estimatedTime": "60min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": true
    },
    {
      "id": 24,
      "description": "MessageList + MessageItem + MessageInput component tests (polling, scroll, edit/reply)",
      "module": "tests/renderer/components/discord/Messages.test.tsx",
      "dependencies": [2, 16],
      "complexity": "High",
      "estimatedTime": "120min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": false
    },
    {
      "id": 25,
      "description": "ForumThreadList + CreatePollModal component tests (sort, filter, validation)",
      "module": "tests/renderer/components/discord/ForumAndPoll.test.tsx",
      "dependencies": [2, 16],
      "complexity": "Medium",
      "estimatedTime": "75min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": true
    },
    {
      "id": 26,
      "description": "EmojiPicker + GifPicker + StickerPicker + PickerPanel component tests",
      "module": "tests/renderer/components/discord/Pickers.test.tsx",
      "dependencies": [2, 16],
      "complexity": "Medium",
      "estimatedTime": "75min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": true
    },
    {
      "id": 27,
      "description": "EmbedRenderer + AttachmentRenderer + PollRenderer + DiscordMarkdown + ReactionBar tests",
      "module": "tests/renderer/components/discord/Renderers.test.tsx",
      "dependencies": [2],
      "complexity": "High",
      "estimatedTime": "90min",
      "basGates": ["lint", "test", "coverage"],
      "parallelizable": true
    },
    {
      "id": 28,
      "description": "Shell launch-app IPC handler + AppBar Chrome button tests",
      "module": "tests/renderer/components/layout/ChromeButton.test.tsx",
      "dependencies": [3],
      "complexity": "Low",
      "estimatedTime": "30min",
      "basGates": ["lint", "build", "test", "coverage"],
      "parallelizable": true
    }
  ],
  "sequence": [[1, 2, 3], [4, 9, 17], [5, 10], [6, 11, 18], [7, 12, 13], [8, 14], [15], [16], [19, 20, 21, 22, 27, 28], [23, 25, 26], [24]],
  "parallelGroups": [[1, 2, 3], [4, 9, 17], [7, 13], [19, 20, 21], [23, 25, 26, 27], [28]],
  "stopPoints": ["requirements", "design", "plan", "final"],
  "timeline": {
    "totalEstimate": "1835min (~30.6h sequential, ~25.6h with parallelization)",
    "criticalPath": [3, 9, 10, 11, 12, 13, 14, 15, 16, 22, 24],
    "criticalPathTime": "785min (~13.1h)",
    "basGateTime": "6min per task (168min total)"
  },
  "basConfiguration": {
    "linting": { "tool": "ESLint + Prettier", "autoFix": true },
    "coverage": { "threshold": 80, "metric": "lines and branches" },
    "testing": { "framework": "Vitest", "parallel": true, "shards": 2 }
  }
}
```

---

## Mocking Strategy Reference

### Service Tests (Node environment)

```typescript
// Pattern: mock secureStorage, database, and global fetch
vi.mock('./secure-storage.service', () => ({
  secureStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('../database', () => ({
  database: { getSetting: vi.fn() },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
```

### Store Tests (jsdom environment)

```typescript
// Pattern: mock IPC client (matches existing useSettingsStore.test.ts)
const mockInvoke = vi.fn();
vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Reset store between tests
beforeEach(() => {
  useSpotifyStore.setState({ /* defaults */ });
  mockInvoke.mockReset();
});
```

### Component Tests (jsdom environment)

```typescript
// Pattern: mock store via Zustand setState, render with RTL
import { render, screen, fireEvent } from '@testing-library/react';

beforeEach(() => {
  useSpotifyStore.setState({
    connected: true,
    playback: createMockSpotifyPlaybackState(),
    // ...
  });
});
```

---

## Test File Structure

```
tests/
  mocks/
    factories.ts          (Tasks 1, 2 -- extend existing)
    fetch-helpers.ts      (Task 3 -- new)
  main/
    services/
      spotify.service.test.ts         (Tasks 4, 5, 6 -- new)
      discord.service.test.ts         (Tasks 9, 10, 11, 12 -- new)
      code-server.service.test.ts     (Tasks 17, 18 -- extend existing)
    ipc/
      shell-launch.test.ts            (Task 28 -- new)
  renderer/
    stores/
      useSpotifyStore.test.ts         (Tasks 7, 8 -- new)
      useDiscordStore.test.ts         (Tasks 13, 14, 15, 16 -- new)
    components/
      spotify/
        SpotifyPlayer.test.tsx        (Task 19 -- new)
        PlaybackControls.test.tsx     (Task 20 -- new)
        VolumeAndPanels.test.tsx      (Task 21 -- new)
      discord/
        DiscordClient.test.tsx        (Task 22 -- new)
        Navigation.test.tsx           (Task 23 -- new)
        Messages.test.tsx             (Task 24 -- new)
        ForumAndPoll.test.tsx         (Task 25 -- new)
        Pickers.test.tsx              (Task 26 -- new)
        Renderers.test.tsx            (Task 27 -- new)
      layout/
        ChromeButton.test.tsx         (Task 28 -- new)
```

**New files:** 16
**Extended files:** 2 (factories.ts, code-server.service.test.ts)
**Total test cases:** ~187

---

**TRA Plan Complete. Ready for EUS decomposition.**
