# Debug Guide - Mode Switching Issue

## What Was Changed

### 1. Icon Changed
- **Old**: ⚙️ (gear icon)
- **New**: `vs` (text button)

### 2. Debug Logging Added
- State logs on every render
- Click logs when buttons are pressed
- Shows current mode and model selections

---

## How to Debug

### Step 1: Open Developer Console
Press **F12** in your browser, go to **Console** tab

### Step 2: Check Initial State
When you first load the page, you should see:
```javascript
Current state: {mode: "debate", advancedMode: false, singleModel: "openai", affModel: "openai", negModel: "anthropic"}
```

This means:
- ✅ In debate mode
- ✅ Simple mode (advancedMode: false)
- ✅ Single model: OpenAI
- ✅ Ready to toggle

### Step 3: Test Simple Mode
You should see:
```
┌────────────────────────────┐
│ [OpenAI ▼]  [vs]  ➤        │
└────────────────────────────┘
```

The `vs` button should be visible and clickable.

### Step 4: Click the "vs" Button
**Expected console output:**
```javascript
Switching to advanced mode
Current state: {mode: "debate", advancedMode: true, ...}
```

**Expected UI change:**
```
Before: [OpenAI ▼]  [vs]  ➤
After:  [OpenAI ▼] vs [Claude ▼]  [✕]  ➤
```

### Step 5: Click the "✕" Button
**Expected console output:**
```javascript
Switching back to simple mode
Current state: {mode: "debate", advancedMode: false, ...}
```

**Expected UI change:**
```
Before: [OpenAI ▼] vs [Claude ▼]  [✕]  ➤
After:  [OpenAI ▼]  [vs]  ➤
```

---

## Troubleshooting

### Problem: Can't see the "vs" button

**Check console for:**
```javascript
Current state: {mode: "debate", advancedMode: false, ...}
```

If `mode` is NOT "debate" or `advancedMode` is true, the button won't show.

**Possible causes:**
1. Mode is set to "discussion" instead of "debate"
2. advancedMode is somehow stuck at true
3. CSS might be hiding the button

**Fixes:**
1. Click "🎭 Debate Mode" tab to ensure you're in debate mode
2. Refresh the page (Ctrl+Shift+R) to reset state
3. Check if button exists in DOM: Right-click → Inspect, search for "vs"

### Problem: Button exists but doesn't toggle

**Check console when you click:**
- Should see: `Switching to advanced mode`
- Should see state change: `advancedMode: true`

**If you see the log but UI doesn't change:**
- React rendering issue
- Check browser console for React errors
- Try refreshing the page

**If you don't see the log:**
- Button click not registering
- Check if button is disabled (`loading` state)
- Check if onClick handler is attached

### Problem: Toggles to advanced mode but shows nothing

**Check console:**
```javascript
Current state: {mode: "debate", advancedMode: true, affModel: "openai", negModel: "anthropic"}
```

If `advancedMode` is true but you don't see two dropdowns:
1. Check if both conditional blocks are working
2. Look for React rendering errors in console
3. Verify the JSX conditions: `{mode === 'debate' && advancedMode && (...)}`

---

## What to Look For in Console

### Good State (Simple Mode):
```javascript
Current state: {
  mode: "debate",
  advancedMode: false,
  singleModel: "openai",
  affModel: "openai",
  negModel: "anthropic"
}
```

### Good State (Advanced Mode):
```javascript
Current state: {
  mode: "debate",
  advancedMode: true,
  singleModel: "openai",
  affModel: "openai",
  negModel: "anthropic"
}
```

### Bad State Examples:

**Stuck in wrong mode:**
```javascript
Current state: {
  mode: "discussion",  // ❌ Should be "debate"
  advancedMode: false,
  ...
}
```

**Advanced mode stuck:**
```javascript
Current state: {
  mode: "debate",
  advancedMode: true,  // ❌ If you're seeing simple UI, this is wrong
  ...
}
```

---

## Manual Test Checklist

- [ ] Load page, see console log with state
- [ ] In debate mode, see one dropdown + "vs" button
- [ ] Click "vs" button
- [ ] See console log: "Switching to advanced mode"
- [ ] See state change: advancedMode: true
- [ ] See two dropdowns + "✕" button appear
- [ ] Click "✕" button
- [ ] See console log: "Switching back to simple mode"
- [ ] See state change: advancedMode: false
- [ ] See one dropdown + "vs" button again

---

## Common Issues & Solutions

### Issue: "vs" button too small or hidden
**Solution**: Button now has padding: `px-3 py-1.5` and is styled clearly

### Issue: Can't tell if it's clickable
**Solution**: Button has hover effect: `hover:bg-gray-200`

### Issue: Disabled state
**Check**: Button has `disabled={loading}` - make sure no debate is running

### Issue: Button click does nothing
**Debug**:
1. Open React DevTools (F12 → Components tab)
2. Find the button component
3. Check if onClick is attached
4. Check if advancedMode state exists and updates

---

## Quick Debug Commands

Run these in the browser console:

```javascript
// Check if React is rendering
document.querySelector('button[title="Pick different models for each side"]')

// Check if advanced mode elements exist
document.querySelector('button[title="Back to simple mode"]')

// Force check current mode
console.log('Debate mode:', document.querySelector('[class*="Debate Mode"]'))
```

---

## Expected Console Flow

### Full successful toggle cycle:
```
1. Page load:
   Current state: {mode: "debate", advancedMode: false, ...}

2. Click "vs":
   Switching to advanced mode
   Current state: {mode: "debate", advancedMode: true, ...}

3. Click "✕":
   Switching back to simple mode
   Current state: {mode: "debate", advancedMode: false, ...}
```

---

## Next Steps if Still Not Working

1. **Take a screenshot** of the UI
2. **Copy the console logs** showing the state
3. **Check Network tab** for any failed requests
4. **Check for JavaScript errors** in console
5. **Try in incognito mode** (clear cache issues)
6. **Check React DevTools** for component state

The debug logs will tell us exactly where the issue is!
