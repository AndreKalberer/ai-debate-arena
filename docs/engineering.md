# Engineering notes

## Request and event flow

The browser posts to `/run-debate-stream` or `/run-discussion-stream`. Express sets `Content-Type: text/event-stream` and forwards controller progress callbacks:

- `chunk`: generated text and `msgIndex` for progressive rendering.
- `message`: a completed message with its model and turn metadata.
- `progress`: the current orchestration status.
- `complete`: the final result.
- `error`: an error after the stream has started.

Named events contain JSON data and a blank-line separator. The frontend buffers incomplete lines between network reads and accumulates text by message index.

## Engineering tradeoffs

**SSE:** updates travel from server to browser during a single request, so a bidirectional WebSocket is unnecessary for the current flow. Streaming changes perceived responsiveness; it does not guarantee faster completion.

**Provider adapters:** controllers use a common prompt-to-text or prompt-to-stream interface; each adapter handles its SDK's response format.

**Local history:** localStorage avoids database setup for this prototype. The tradeoff is device-local history, a 50-item retention limit, and no cross-device synchronization.

**Separate deployments:** a configured backend URL lets the React frontend and Express service deploy independently.

## Measuring streaming responsiveness

The previous README reported roughly 10–15 seconds for buffered responses versus 1–2 seconds for streamed output. No benchmark dataset or trace accompanies those figures, so they are not presented as a verified result.

To collect reproducible evidence:

1. Record the commit, provider/model, region, prompt, round count, and whether the backend is warm.
2. Record when the browser sends the POST, receives the first non-empty `chunk`, and receives `complete`.
3. Report time to first content separately from total completion time. Response headers and progress events are not generated content.
4. Repeat the same configuration at least 10 times. Separate cold starts and report the median, range, sample count, and failures.
5. For a buffered baseline, render the same response only at completion. Label this a rendering baseline unless a distinct buffered implementation was also run and recorded.

No new provider benchmark was run for this documentation/CI update.

## Verification boundaries

CI tests saved history, vote statistics, and Markdown exports, and compiles both applications. It does not call external providers or establish end-to-end streaming correctness. Real-provider and authenticated browser checks remain separate.
