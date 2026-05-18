# Debug Guide - White Screen Issues

## What Was Fixed

1. **SSE Streaming**: Replaced the blocking fetch call with Server-Sent Events (SSE) to stream progress updates in real-time
2. **Progress Indicators**: Added visual feedback showing which stage of the debate is running
3. **Live Message Display**: Messages now appear as they're generated during the debate
4. **Chat-Style UI**: Updated the UI with color-coded messages (green=affirmative, red=negative, purple=moderator)

## How to Test

1. **Start the API server:**
   ```powershell
   cd "C:\Users\andre\Documents\AI Debate Bot\debate-arena"
   npm run serve
   ```
   - Should show: "Debate API running on http://localhost:5050"

2. **Start the UI (in a new terminal):**
   ```powershell
   cd "C:\Users\andre\Documents\AI Debate Bot\debate-arena\debate-ui"
   npm run dev
   ```
   - Should show: "Local: http://localhost:5173"

3. **Open browser and check console:**
   - Go to http://localhost:5173
   - Press F12 to open Developer Tools
   - Click on the "Console" tab
   - Try running a debate with a simple topic like "Cats are better than dogs"

## Debugging White Screen

If you still see a white screen, check:

### 1. Browser Console Errors
Look for:
- **CORS errors**: Should be fixed with the Access-Control headers in server.ts
- **Network errors**: Check if the API server is running on port 5050
- **React errors**: Look for any red error messages

### 2. Network Tab
- Open Developer Tools → Network tab
- Try running a debate
- Look for the `/run-debate-stream` request
- Check if it's showing status 200 and streaming data

### 3. Common Issues

**Issue**: "Failed to fetch" or "Network error"
- **Fix**: Make sure the API server is running on port 5050

**Issue**: White screen with no errors
- **Fix**: Check if there's a build issue. Try:
  ```powershell
  cd "C:\Users\andre\Documents\AI Debate Bot\debate-arena\debate-ui"
  npm run build
  ```

**Issue**: CORS error
- **Fix**: Already added CORS headers to the SSE endpoint. If still seeing this, make sure you're using the `/run-debate-stream` endpoint, not `/run-debate`

## What You Should See Now

1. **Before clicking "Run Debate"**: Empty form with topic input and model selectors
2. **After clicking**: 
   - Blue progress box showing current status (e.g., "Round 1: Affirmative opening")
   - Messages appearing in real-time below as they're generated
   - Animated spinner in the progress box
3. **After completion**: 
   - Full transcript in a scrollable chat-style view
   - Judge verdicts in cards at the bottom

## New Features

### Progress Indicators
Shows exactly what's happening:
- "Round 1: Affirmative opening"
- "Round 1: Negative opening"
- "Round 2: Affirmative rebuttal"
- "Moderator analyzing debate"
- "Judges deliberating"

### Live Streaming
Messages appear as they're generated, so you can read the debate while it's happening.

### Chat-Style UI
- ✓ Green for Affirmative arguments
- ✗ Red for Negative arguments  
- ⚖ Purple for Moderator analysis
- Gradient backgrounds and hover effects
- Scrollable transcript
