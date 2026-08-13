// api.js — talks directly to the Anthropic API using the user's own key.
const ClaudeAPI = (() => {
  const ENDPOINT = 'https://api.anthropic.com/v1/messages';

  async function callClaude({ system, messages, maxTokens = 2000, timeoutMs = 120000 }) {
    const settings = Storage.getSettings();
    if (!settings.apiKey) throw new Error('No API key set. Add one in Settings.');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: settings.model || 'claude-sonnet-5',
          max_tokens: maxTokens,
          system,
          messages,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new Error('The request timed out — your connection may be too slow or unstable. Try again on a stronger connection.');
      }
      throw new Error('Network request failed before reaching the API — check your internet connection and try again.');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    if (data.stop_reason === 'max_tokens') {
      throw new Error('The response was cut off before it finished (ran out of output room) — try again; longer or more eventful games may need a couple of tries.');
    }
    const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text);
    return textBlocks.join('\n');
  }

  function stripJsonFence(text) {
    return text.replace(/```json/gi, '').replace(/```/g, '').trim();
  }

  async function extractPGNFromImage(base64, mediaType) {
    const system = `You read screenshots of chess move-list histories (from sites like chess.com, lichess, or a scoresheet) and convert them into clean PGN movetext. Output ONLY a JSON object, no preamble, no markdown fences, matching this shape exactly:
{
  "pgn": "1. e4 e5 2. Nf3 ...",
  "whiteElo": number or null,
  "blackElo": number or null,
  "white": string or null,
  "black": string or null,
  "result": "1-0" | "0-1" | "1/2-1/2" | "*"
}
Read every move carefully, including captures (x), checks (+), checkmate (#), castling (O-O, O-O-O), and promotions (=Q). If a move is ambiguous or unreadable, make your best legal-chess-aware guess. Do not invent moves beyond what's visible.`;

    const resp = await callClaude({
      system,
      maxTokens: 1500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Extract the PGN move list from this screenshot.' },
        ],
      }],
    });

    return JSON.parse(stripJsonFence(resp));
  }

  const TIME_CONTROL_CONTEXT = {
    bullet: 'Bullet (under 3 minutes per side). Expect more time-pressure errors, less precise calculation, and generally lower play quality than the same player would show at longer controls — calibrate your Elo estimate accordingly, meaningfully lower than their rapid/classical level.',
    blitz: 'Blitz (3-10 minutes per side). Some time pressure, moderate calculation depth. Calibrate Elo estimate a bit below what the same player would show at rapid/classical.',
    rapid: 'Rapid (10-30 minutes per side). Reasonable time to think; play quality should be fairly representative of the player\'s true strength.',
    classical: 'Classical (30+ minutes per side, or a slow/correspondence/OTB game). Ample time to calculate; this is the player\'s clearest, most representative play quality — mistakes here are more meaningful and Elo estimates should be the most trustworthy.',
  };

  async function reviewGame(pgn, playerColor, timeControl) {
    const tcContext = TIME_CONTROL_CONTEXT[timeControl] || TIME_CONTROL_CONTEXT.rapid;

    const system = `You are a strong, encouraging but honest chess coach reviewing a game for a club-level player. You will be given a PGN and the time control it was played at. Analyze it move by move using your chess knowledge and produce a structured review.

Time control context: ${tcContext}

Output ONLY a JSON object, no preamble, no markdown fences, matching exactly this shape:
{
  "summary": "3-5 sentence natural-language overview of how the game went and the overall arc",
  "estimatedElo": number,
  "estimatedEloReasoning": "1-2 sentences on what specifically about the play (accuracy, tactical awareness, endgame technique, opening knowledge) led to this estimate, referencing the time control",
  "moves": [
    {
      "ply": number,
      "san": "the move in SAN as played",
      "fenBefore": "FEN before this move",
      "classification": "good" | "inaccuracy" | "mistake" | "blunder",
      "comment": "1-2 sentences on why, only for non-good moves; empty string for good moves",
      "betterMove": "SAN of the better move, empty string if move was good",
      "betterMoveExplanation": "1-2 sentences on why the better move was stronger; empty string if move was good",
      "category": "one of: hanging_piece, missed_tactic, opening_error, endgame_technique, weak_king_safety, poor_piece_activity, time_trouble_pattern, pawn_structure, missed_mate, other"
    }
  ],
  "topWeakness": "one sentence naming the single most important thing this player should work on before their next game, based on this game specifically"
}

For "estimatedElo": estimate the played-out strength (roughly a standard online rating, e.g. chess.com/lichess-style) of the player playing ${playerColor === 'w' ? 'White' : playerColor === 'b' ? 'Black' : 'the side in question'} in THIS game, based purely on the quality of moves shown — not on any rating text that might appear elsewhere. Base it on move accuracy, tactical misses, opening soundness, and endgame technique, and calibrate it using the time control context above. Give your honest best single-number estimate, not a range.

Only include entries in "moves" for moves that are inaccuracy/mistake/blunder (skip "good" moves entirely to keep the response focused — do not include good moves in the array at all). The player played ${playerColor === 'w' ? 'White' : playerColor === 'b' ? 'Black' : 'either side, infer from context'}. Focus your classifications on that player's moves only. Be specific and concrete — reference actual pieces and squares, not generic advice.`;

    const resp = await callClaude({
      system,
      maxTokens: 8000,
      messages: [{ role: 'user', content: `PGN:\n${pgn}\n\nTime control: ${timeControl}` }],
    });

    return JSON.parse(stripJsonFence(resp));
  }

  return { callClaude, extractPGNFromImage, reviewGame };
})();
