# Debate Mode - Simple & Advanced

## How It Works Now

### Simple Mode (Default) ✨

**What you see**:
```
┌──────────────────────────────────────────┐
│  [Enter topic...]                        │
│         [OpenAI ▼]  ⚙️  ➤                │
└──────────────────────────────────────────┘
```

**What it does**:
- Pick ONE model from the dropdown (OpenAI, Claude, or Gemini)
- That model debates **against itself** (both affirmative and negative)
- Click the ⚙️ button to switch to advanced mode

**Example**:
1. Select "Claude" from dropdown
2. Type "Is pineapple good on pizza?"
3. Press Enter
4. Claude argues BOTH sides of the debate!

---

### Advanced Mode 🔧

**What you see**:
```
┌──────────────────────────────────────────┐
│  [Enter topic...]                        │
│    [OpenAI ▼] vs [Claude ▼]  ✕  ➤       │
└──────────────────────────────────────────┘
```

**What it does**:
- Pick TWO different models
- One argues affirmative, the other negative
- Click the ✕ button to go back to simple mode

**Example**:
1. Click ⚙️ to enter advanced mode
2. Select "OpenAI" for affirmative
3. Select "Claude" for negative
4. Type topic and press Enter
5. OpenAI vs Claude debate!

---

## Button Guide

### ⚙️ Settings Button (Simple Mode)
- **Location**: Next to the model dropdown
- **Action**: Switches to advanced mode (two model pickers)
- **Tooltip**: "Pick different models for each side"

### ✕ Close Button (Advanced Mode)
- **Location**: After the second model dropdown
- **Action**: Returns to simple mode (one model picker)
- **Tooltip**: "Back to simple mode"

---

## User Flow

### Simple Flow (Most Common):
```
1. Open app → See single dropdown (OpenAI selected by default)
2. Type topic
3. Press Enter
4. Watch OpenAI debate itself!
```

### Advanced Flow:
```
1. Open app → See single dropdown
2. Click ⚙️ button
3. Now see two dropdowns: [Model 1] vs [Model 2]
4. Pick different models
5. Type topic and press Enter
6. Watch them debate each other!
7. (Optional) Click ✕ to go back to simple mode
```

---

## Comparison

| Feature | Simple Mode | Advanced Mode |
|---------|------------|---------------|
| **Default** | ✅ Yes | ❌ No |
| **Number of pickers** | 1 | 2 |
| **Same AI both sides** | ✅ Yes | ❌ No |
| **Different AIs** | ❌ No | ✅ Yes |
| **Toggle button** | ⚙️ (go to advanced) | ✕ (back to simple) |
| **Use case** | See AI contradict itself | Compare different AIs |

---

## Visual States

### State 1: Simple Mode (Default)
```
┌────────────────────────────────────────────────────┐
│  🎭 Debate Mode  │  💬 Discussion Mode             │
├────────────────────────────────────────────────────┤
│  [Enter a debate topic...]                         │
│         [OpenAI ▼]  ⚙️  ➤                          │
│         └─one picker─┘                             │
└────────────────────────────────────────────────────┘
```

### State 2: Advanced Mode
```
┌────────────────────────────────────────────────────┐
│  🎭 Debate Mode  │  💬 Discussion Mode             │
├────────────────────────────────────────────────────┤
│  [Enter a debate topic...]                         │
│    [OpenAI ▼] vs [Claude ▼]  ✕  ➤                 │
│    └───two pickers───────┘                         │
└────────────────────────────────────────────────────┘
```

### State 3: Discussion Mode (Unchanged)
```
┌────────────────────────────────────────────────────┐
│  🎭 Debate Mode  │  💬 Discussion Mode             │
├────────────────────────────────────────────────────┤
│  [Enter a discussion topic...]                     │
│         GPT-5 • Claude • Gemini  ➤                 │
└────────────────────────────────────────────────────┘
```

---

## Console Logs

### Simple Mode:
```javascript
Simple mode: Using openai for both sides
Sending debate request {finalAffModel: "openai", finalNegModel: "openai"}
```

### Advanced Mode:
```javascript
Advanced mode: Affirmative: anthropic vs Negative: gemini
Sending debate request {finalAffModel: "anthropic", finalNegModel: "gemini"}
```

---

## Tips

### When to use Simple Mode:
- ✅ Want to see an AI argue against itself
- ✅ Philosophical debates (free will, consciousness)
- ✅ Testing consistency of reasoning
- ✅ Quick and easy debates

### When to use Advanced Mode:
- ✅ Compare different AI models
- ✅ See which AI is more persuasive
- ✅ Test different reasoning approaches
- ✅ More variety in arguments

---

## Quick Reference

**Simple Mode**:
- Pick 1 model → Debates itself
- Default state
- Click ⚙️ to expand

**Advanced Mode**:
- Pick 2 models → Debate each other
- Click ✕ to collapse back

**Discussion Mode**:
- All 3 AIs discuss together
- Try to reach consensus
