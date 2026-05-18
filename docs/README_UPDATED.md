# AI Debate Arena - Updated Features

## New Features

### 1. 🎲 Auto-Debate Mode (Default in Debate Mode)
- **What it does**: Automatically picks a random AI model to debate itself (both sides)
- **Why it's cool**: See how an AI argues against its own reasoning!
- **How to use**: Just enter a topic and press Enter - the system randomly picks GPT, Claude, or Gemini
- **Switch to manual**: Click the "🎲 Auto • Click to pick models" button to manually choose which AIs debate

### 2. 💬 Discussion Mode
- Three AIs (GPT-5, Claude, Gemini) discuss a topic collaboratively
- They try to reach consensus through discussion
- If they agree, a summary is generated
- If they disagree after 15 messages, judges vote on the best perspective

## Three Modes Available

### Mode 1: Auto-Debate (Default)
1. Toggle to "🎭 Debate Mode"
2. Enter your topic
3. Press Enter or click the arrow button
4. A random AI will debate itself!

### Mode 2: Manual Debate
1. Toggle to "🎭 Debate Mode"
2. Click the "🎲 Auto" button to switch to manual selection
3. Choose which models debate (e.g., OpenAI vs Claude)
4. Enter your topic and start

### Mode 3: Discussion Panel
1. Toggle to "💬 Discussion Mode"
2. Enter your topic
3. Watch all three AIs discuss and try to reach consensus

## Troubleshooting

### Issue: Nothing happens when pressing Enter
**Fixes applied:**
- Added console logging to debug the issue
- Fixed the `runDebate` function to properly handle both auto and manual modes
- Added separate logging for button clicks

**How to check if it's working:**
1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Type a topic and press Enter
4. You should see logs like:
   - "Key pressed: Enter"
   - "runDebate called"
   - "Auto-debate selected model: openai" (or anthropic/gemini)

### Issue: Server not responding
**Make sure:**
1. The backend is running: `npm run serve` (from main directory)
2. The frontend is running: `npm run dev` (from debate-ui directory)
3. The server shows: "Debate API running on http://localhost:5050"

## Running the Application

### Terminal 1 - Backend:
```bash
npm run serve
```

### Terminal 2 - Frontend:
```bash
cd debate-ui
npm run dev
```

Then open: http://localhost:5173

## What's Different from Before

### Debate Mode Changes:
- ✅ **Now**: Auto-debate by default (one AI debates itself)
- ✅ **Before**: Had to manually select two AIs
- ✅ **Option**: Can still manually select two different AIs if you click the Auto button

### New Features:
- ✅ Discussion mode with 3 AIs
- ✅ Console logging for debugging
- ✅ Better error handling
- ✅ Auto-mode button to toggle between auto and manual model selection

## Tips

### For Auto-Debate:
- Try philosophical questions: "Is free will real?"
- Watch the AI contradict its own arguments!
- Each run picks a different random model

### For Discussion Mode:
- Ask factual questions: "What are the best programming languages for beginners?"
- Watch AIs build on each other's ideas
- See if they can reach consensus or need judges

### For Manual Debate:
- Compare different AIs: "OpenAI vs Claude on ethical AI"
- See which model is more persuasive
- Test controversial topics where models might differ
