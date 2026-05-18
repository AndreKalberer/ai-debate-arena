# Discussion Mode Feature

## Overview
The AI Debate Arena now has two modes:

### 1. **Debate Mode** (Original)
- Two AI models debate opposite sides of a topic
- Affirmative vs Negative format
- Multiple rounds of arguments and rebuttals
- Moderator provides analysis
- Three judges vote on the winner

### 2. **Discussion Mode** (New)
- Three AI models (ChatGPT-5, Claude 4.5 Sonnet, Gemini 2.5) discuss a topic collaboratively
- Models participate in round-robin fashion
- They attempt to reach consensus through discussion
- Maximum of 15 messages (5 per model)
- If they agree, a consensus summary is generated
- If they disagree after 15 messages, judges vote on which perspective is most convincing

## How Discussion Mode Works

1. **Round-Robin Discussion**
   - ChatGPT-5 starts the discussion
   - Claude 4.5 Sonnet responds
   - Gemini 2.5 adds their perspective
   - Pattern repeats up to 5 messages per model

2. **Consensus Detection**
   - After every 3 messages (one full round), the system checks for consensus
   - Uses keyword analysis to detect agreement/disagreement
   - If consensus is reached, a summary is generated and discussion ends

3. **Judge Intervention**
   - If no consensus after 15 messages, judges step in
   - Each judge (OpenAI, Claude, Gemini) evaluates all three perspectives
   - Judges vote on which model had the most convincing stance
   - Results show which model's reasoning won each judge's vote

## UI Features

### Mode Selector
- Toggle between "🎭 Debate Mode" and "💬 Discussion Mode" at the bottom of the screen
- In Debate Mode: Choose which models debate (affirmative vs negative)
- In Discussion Mode: All three models automatically participate

### Message Display
- Each model has a distinct color:
  - ChatGPT-5: Blue
  - Claude 4.5: Orange
  - Gemini 2.5: Green
- Messages show model name and message number

### Results
- **Consensus Reached**: Green success box with consensus summary
- **No Consensus**: Yellow warning box followed by judge verdicts
- Judges indicate which model's perspective they found most convincing

## API Endpoints

### `/run-discussion-stream` (POST)
- **Request Body**: `{ topic: string }`
- **Response**: Server-Sent Events (SSE) stream
- **Events**:
  - `progress`: Status updates
  - `message`: New discussion message from a model
  - `complete`: Discussion result with consensus or verdicts
  - `error`: Error message

## File Structure

### Backend
- `src/lib/debate/discussion-controller.ts` - Core discussion logic
- `src/server.ts` - Added `/run-discussion-stream` endpoint

### Frontend
- `debate-ui/src/App.tsx` - Updated with mode selector and discussion UI

## Example Usage

### Consensus Reached
**Topic**: "What is the capital of France?"

All three models quickly agree it's Paris, and a consensus summary is generated.

### No Consensus - Judges Decide
**Topic**: "Is pineapple an acceptable pizza topping?"

Models debate this controversial topic for 15 messages without agreement. Judges then evaluate which model made the most compelling argument about pizza toppings.

## Configuration

The discussion mode uses:
- **MAX_MESSAGES**: 15 (5 per model)
- **Consensus check**: Every 3 messages (after each full round)
- **Same judges**: OpenAI, Claude, Gemini (from original debate mode)

## Running the Application

1. Start the backend:
   ```bash
   npm run serve
   ```

2. Start the frontend (in another terminal):
   ```bash
   cd debate-ui
   npm run dev
   ```

3. Open http://localhost:5173 in your browser
4. Toggle to "Discussion Mode" using the mode selector
5. Enter a topic and watch the AIs discuss!
