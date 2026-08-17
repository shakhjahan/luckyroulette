// Chess game in plain JavaScript (no libraries) with single-player AI
// Board coordinates: rows 0..7 (0 = rank 8), cols 0..7 (0 = file a)
// White pieces start at rows 7 (back rank) and 6 (pawns). White moves "up" (row - 1).

const PIECE_SYMBOLS = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟"
};

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const moveListEl = document.getElementById("moveList");
const undoBtn = document.getElementById("undoBtn");
const resetBtn = document.getElementById("resetBtn");
const modeSelect = document.getElementById("modeSelect");
const aiSideSelect = document.getElementById("aiSideSelect");
const aiLevelSelect = document.getElementById("aiLevelSelect");

let state = null;
let selected = null;
let legalTargets = [];

// Game mode / AI settings
let gameMode = modeSelect.value; // "pvp" or "ai"
let aiSide = aiSideSelect.value; // "w" or "b"
let aiLevel = aiLevelSelect.value; // easy/medium/hard
let aiThinking = false;

modeSelect.addEventListener("change", ()=> { gameMode = modeSelect.value; maybeTriggerAIMove(); });
aiSideSelect.addEventListener("change", ()=> { aiSide = aiSideSelect.value; maybeTriggerAIMove(); });
aiLevelSelect.addEventListener("change", ()=> { aiLevel = aiLevelSelect.value; });

// Initialize a fresh game state
function newGame() {
  const board = [
    ["bR","bN","bB","bQ","bK","bB","bN","bR"],
    ["bP","bP","bP","bP","bP","bP","bP","bP"],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ["wP","wP","wP","wP","wP","wP","wP","wP"],
    ["wR","wN","wB","wQ","wK","wB","wN","wR"]
  ];
  return {
    board,
    turn: "w",
    castling: { wK:true, wQ:true, bK:true, bQ:true },
    enPassant: null, // {r,c} or null
    history: []
  };
}

// Clone helper
function cloneState(s) {
  return {
    board: s.board.map(r => r.slice()),
    turn: s.turn,
    castling: Object.assign({}, s.castling),
    enPassant: s.enPassant ? {r:s.enPassant.r, c:s.enPassant.c} : null,
    history: s.history.slice()
  };
}

// Board helpers
function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
function pieceAt(s,r,c){ return s.board[r][c]; }
function colorOf(piece){ return piece ? piece[0] : null; }
function typeOf(piece){ return piece ? piece[1] : null; }

// Render board
function render() {
  boardEl.innerHTML = "";
  for (let r=0;r<8;r++){
    for (let c=0;c<8;c++){
      const sq = document.createElement("div");
      sq.className = "square " + (((r+c)%2) ? "dark":"light");
      sq.dataset.r = r; sq.dataset.c = c;
      const piece = state.board[r][c];
      if (piece) {
        sq.textContent = PIECE_SYMBOLS[piece];
      } else {
        sq.textContent = "";
      }
      // add rank/file labels on larger screens
      if (c===0) {
        const rank = document.createElement("div");
        rank.className = "rank-label";
        rank.textContent = 8 - r;
        sq.appendChild(rank);
      }
      if (r===7) {
        const file = document.createElement("div");
        file.className = "file-label";
        file.textContent = String.fromCharCode(97 + c);
        sq.appendChild(file);
      }

      sq.addEventListener("click", onSquareClick);
      boardEl.appendChild(sq);
    }
  }
  clearHighlights();
  if (selected) highlightSquare(selected.r, selected.c, "selected");
  for (const t of legalTargets){
    highlightSquare(t.r, t.c, t.capture ? "capture" : "highlight");
  }
  updateStatus();
  renderMoveList();
  maybeTriggerAIMove();
}

function highlightSquare(r,c,cls){
  const idx = r*8 + c;
  const el = boardEl.children[idx];
  if (!el) return;
  if (cls === "highlight") el.classList.add("highlight");
  if (cls === "capture") el.classList.add("capture");
  if (cls === "selected") el.style.outline = "3px solid rgba(59,130,246,0.8)";
}

function clearHighlights(){
  for (const el of boardEl.children){
    el.classList.remove("highlight","capture");
    el.style.outline = "";
  }
}

// Coordinate helpers
function coordToAlgebraic(r,c){
  return String.fromCharCode(97+c) + (8 - r);
}

// Move generation (pseudo-legal then filtered)
function generateLegalMoves(s, r, c) {
  const piece = pieceAt(s,r,c);
  if (!piece) return [];
  const me = colorOf(piece);
  if (me !== s.turn) return [];
  let moves = generatePseudoMoves(s, r, c);
  // filter moves that leave own king in check
  const legal = [];
  for (const m of moves){
    const s2 = cloneState(s);
    const moveObj = {
      from:{r,c},
      to:{r:m.r,c:m.c},
      promotion: m.promotion,
      isEnPassant: m.isEnPassant,
      isCastling: m.isCastling
    };
    applyMoveToState(s2, moveObj);
    if (!isKingInCheck(s2, me)) legal.push(Object.assign({}, m, {from:{r,c}}));
  }
  return legal;
}

function generatePseudoMoves(s, r, c){
  const piece = pieceAt(s,r,c);
  if (!piece) return [];
  const me = colorOf(piece);
  const t = typeOf(piece);
  const moves = [];
  if (t === "P"){ // pawn
    const dir = me === "w" ? -1 : 1;
    const startRow = me === "w" ? 6 : 1;
    // forward one
    const fr = r + dir, fc = c;
    if (inBounds(fr,fc) && !pieceAt(s,fr,fc)) {
      moves.push({r:fr,c:fc});
      // two squares
      const fr2 = r + dir*2;
      if (r === startRow && !pieceAt(s,fr2,fc)) {
        moves.push({r:fr2,c:fc, double:true});
      }
    }
    // captures
    for (const dc of [-1,1]){
      const cr = r + dir, cc = c + dc;
      if (inBounds(cr,cc)) {
        const target = pieceAt(s,cr,cc);
        if (target && colorOf(target) !== me) moves.push({r:cr,c:cc, capture:true});
        // en passant
        if (s.enPassant && s.enPassant.r === cr && s.enPassant.c === cc) {
          moves.push({r:cr,c:cc, capture:true, isEnPassant:true});
        }
      }
    }
    // promotions handled at application time (when r reaches 0 or 7)
  } else if (t === "N"){
    const deltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr,dc] of deltas){
      const nr = r+dr, nc = c+dc;
      if (!inBounds(nr,nc)) continue;
      const target = pieceAt(s,nr,nc);
      if (!target || colorOf(target) !== me) moves.push({r:nr,c:nc, capture: !!target});
    }
  } else if (t === "B" || t === "R" || t === "Q"){
    const dirs = [];
    if (t==="B" || t==="Q") dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
    if (t==="R" || t==="Q") dirs.push([-1,0],[1,0],[0,-1],[0,1]);
    for (const [dr,dc] of dirs){
      let nr=r+dr, nc=c+dc;
      while(inBounds(nr,nc)){
        const target = pieceAt(s,nr,nc);
        if (!target) {
          moves.push({r:nr,c:nc});
        } else {
          if (colorOf(target)!==me) moves.push({r:nr,c:nc, capture:true});
          break;
        }
        nr+=dr; nc+=dc;
      }
    }
  } else if (t === "K"){
    for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++){
      if (dr===0 && dc===0) continue;
      const nr=r+dr, nc=c+dc;
      if (!inBounds(nr,nc)) continue;
      const target = pieceAt(s,nr,nc);
      if (!target || colorOf(target)!==me) moves.push({r:nr,c:nc, capture:!!target});
    }
    // castling (pseudo-checks here; final legality checked later)
    if (me === "w"){
      if (s.castling.wK && !pieceAt(s,7,5) && !pieceAt(s,7,6)) moves.push({r:7,c:6,isCastling:true});
      if (s.castling.wQ && !pieceAt(s,7,1) && !pieceAt(s,7,2) && !pieceAt(s,7,3)) moves.push({r:7,c:2,isCastling:true});
    } else {
      if (s.castling.bK && !pieceAt(s,0,5) && !pieceAt(s,0,6)) moves.push({r:0,c:6,isCastling:true});
      if (s.castling.bQ && !pieceAt(s,0,1) && !pieceAt(s,0,2) && !pieceAt(s,0,3)) moves.push({r:0,c:2,isCastling:true});
    }
  }
  return moves;
}

// Apply move object to a state (mutates)
// move: { from:{r,c}, to:{r,c}, promotion?, isEnPassant?, isCastling? }
function applyMoveToState(s, move) {
  const fr = move.from.r, fc = move.from.c;
  const tr = move.to.r, tc = move.to.c;
  const piece = s.board[fr][fc];
  const me = colorOf(piece);
  const pt = typeOf(piece);

  // determine captured piece (if any) before moving
  let captured = null;
  if (move.isEnPassant) {
    const capR = me === "w" ? tr+1 : tr-1;
    captured = s.board[capR][tc];
  } else {
    captured = s.board[tr][tc];
  }

  // handle en passant capture removal
  if (move.isEnPassant) {
    const capR = me === "w" ? tr+1 : tr-1;
    s.board[capR][tc] = null;
  }

  // move piece
  s.board[tr][tc] = piece;
  s.board[fr][fc] = null;

  // handle castling rook movement
  if (move.isCastling) {
    if (me === "w") {
      if (tc === 6) { // king-side
        s.board[7][5] = s.board[7][7];
        s.board[7][7] = null;
      } else if (tc === 2) { // queen-side
        s.board[7][3] = s.board[7][0];
        s.board[7][0] = null;
      }
      s.castling.wK = s.castling.wQ = false;
    } else {
      if (tc === 6) {
        s.board[0][5] = s.board[0][7];
        s.board[0][7] = null;
      } else if (tc === 2) {
        s.board[0][3] = s.board[0][0];
        s.board[0][0] = null;
      }
      s.castling.bK = s.castling.bQ = false;
    }
  }

  // update castling rights if king or rook moved/captured
  if (pt === "K") {
    if (me === "w"){ s.castling.wK = s.castling.wQ = false; }
    else { s.castling.bK = s.castling.bQ = false; }
  }
  if (pt === "R") {
    if (me === "w") {
      if (fr === 7 && fc === 0) s.castling.wQ = false;
      if (fr === 7 && fc === 7) s.castling.wK = false;
    } else {
      if (fr === 0 && fc === 0) s.castling.bQ = false;
      if (fr === 0 && fc === 7) s.castling.bK = false;
    }
  }
  // if rook captured, update opponent castling flags
  if (captured && typeOf(captured) === "R") {
    const opp = colorOf(captured);
    if (opp === "w") {
      if (tr === 7 && tc === 0) s.castling.wQ = false;
      if (tr === 7 && tc === 7) s.castling.wK = false;
    } else {
      if (tr === 0 && tc === 0) s.castling.bQ = false;
      if (tr === 0 && tc === 7) s.castling.bK = false;
    }
  }

  // promotion
  if (pt === "P" && (tr === 0 || tr === 7)) {
    const prom = move.promotion || "Q";
    s.board[tr][tc] = me + prom;
  }

  // set en passant target AFTER move (depends on the moving pawn)
  if (pt === "P" && Math.abs(tr - fr) === 2) {
    s.enPassant = { r: (fr + tr) / 2, c: fc };
  } else {
    s.enPassant = null;
  }

  // push history (we save minimal info)
  s.history.push({
    from: {r:fr,c:fc},
    to: {r:tr,c:tc},
    piece,
    capturedPiece: captured || null,
    castling: JSON.parse(JSON.stringify(s.castling)),
    enPassantBefore: s.enPassant ? {r:s.enPassant.r,c:s.enPassant.c} : null
  });

  // switch turn
  s.turn = s.turn === "w" ? "b" : "w";
}

// Check detection: is color's king in check?
function isKingInCheck(s, color) {
  // find king
  let kr=-1,kc=-1;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++){
    const p = s.board[r][c];
    if (p === color + "K"){ kr=r; kc=c; }
  }
  if (kr === -1) return true; // king not found -> in check (shouldn't happen)
  return isSquareAttacked(s, kr, kc, color === "w" ? "b" : "w");
}

// is square attacked by color 'att'?
function isSquareAttacked(s, r, c, att) {
  // pawns
  const dir = att === "w" ? -1 : 1;
  for (const dc of [-1,1]){
    const pr = r + dir, pc = c + dc;
    if (inBounds(pr,pc)) {
      const p = s.board[pr][pc];
      if (p === att + "P") return true;
    }
  }
  // knights
  const nd = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr,dc] of nd){
    const nr = r+dr, nc = c+dc;
    if (!inBounds(nr,nc)) continue;
    const p = s.board[nr][nc];
    if (p === att + "N") return true;
  }
  // sliding: rook/queen (orthogonal)
  const orth = [[-1,0],[1,0],[0,-1],[0,1]];
  for (const [dr,dc] of orth){
    let nr=r+dr, nc=c+dc;
    while(inBounds(nr,nc)){
      const p = s.board[nr][nc];
      if (p){
        const t = typeOf(p);
        const col = colorOf(p);
        if (col === att && (t === "R" || t === "Q")) return true;
        break;
      }
      nr+=dr; nc+=dc;
    }
  }
  // sliding: bishop/queen (diagonal)
  const diag = [[-1,-1],[-1,1],[1,-1],[1,1]];
  for (const [dr,dc] of diag){
    let nr=r+dr, nc=c+dc;
    while(inBounds(nr,nc)){
      const p = s.board[nr][nc];
      if (p){
        const t = typeOf(p);
        const col = colorOf(p);
        if (col === att && (t === "B" || t === "Q")) return true;
        break;
      }
      nr+=dr; nc+=dc;
    }
  }
  // king adjacency
  for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++){
    if (dr===0 && dc===0) continue;
    const nr=r+dr, nc=c+dc;
    if (!inBounds(nr,nc)) continue;
    const p = s.board[nr][nc];
    if (p === att + "K") return true;
  }
  return false;
}

// click handler
function onSquareClick(ev){
  if (aiThinking) return; // block user input while AI thinking
  const el = ev.currentTarget;
  const r = Number(el.dataset.r), c = Number(el.dataset.c);
  const piece = pieceAt(state,r,c);
  const turn = state.turn;

  // if selecting own piece
  if (!selected) {
    if (piece && colorOf(piece) === turn){
      const moves = generateLegalMoves(state, r, c);
      if (moves.length === 0) return;
      selected = {r,c};
      legalTargets = moves.map(m => Object.assign({}, m, {from:{r,c}}));
      render();
    }
  } else {
    // clicking a highlighted target?
    const target = legalTargets.find(t => t.r === r && t.c === c);
    if (target) {
      // prepare move object
      const move = {
        from: {r: selected.r, c: selected.c},
        to: {r: r, c: c},
        isEnPassant: !!target.isEnPassant,
        isCastling: !!target.isCastling,
        capturedPiece: pieceAt(state, r, c)
      };
      // if capture and captured is null but enPassant, set capturedPiece accordingly
      if (!move.capturedPiece && move.isEnPassant) {
        const capR = state.turn === "w" ? r+1 : r-1;
        move.capturedPiece = pieceAt(state, capR, c);
      }
      // promotion handling
      const movingPiece = pieceAt(state, selected.r, selected.c);
      if (typeOf(movingPiece) === "P" && (r === 0 || r === 7)) {
        const choice = prompt("Promote to (Q,R,B,N). Default Q:", "Q");
        const prom = (choice && ["Q","R","B","N"].includes(choice.toUpperCase())) ? choice.toUpperCase() : "Q";
        move.promotion = prom;
      }
      applyMoveToState(state, move);
      // after move, clear selection and legal targets
      selected = null;
      legalTargets = [];
      // check game end conditions
      checkGameEnd();
      render();
    } else {
      // clicked elsewhere: if clicked own piece, switch selection; otherwise clear selection
      if (piece && colorOf(piece) === turn) {
        selected = {r,c};
        legalTargets = generateLegalMoves(state, r, c).map(m => Object.assign({}, m, {from:{r,c}}));
      } else {
        selected = null;
        legalTargets = [];
      }
      render();
    }
  }
}

// Checkmate / stalemate detection
function checkGameEnd() {
  // see if current player (after move) is in checkmate or stalemate; we evaluate for side to move
  const side = state.turn;
  // find any legal move for side
  let anyLegal = false;
  for (let r=0;r<8 && !anyLegal;r++) for (let c=0;c<8 && !anyLegal;c++){
    const p = pieceAt(state,r,c);
    if (p && colorOf(p) === side) {
      const legal = generateLegalMoves(state, r, c);
      if (legal.length > 0) anyLegal = true;
    }
  }
  if (!anyLegal) {
    // if in check -> checkmate else stalemate
    if (isKingInCheck(state, side)) {
      statusEl.textContent = (side === "w" ? "Black wins by checkmate" : "White wins by checkmate");
    } else {
      statusEl.textContent = "Stalemate — draw";
    }
  }
}

// status & moves UI
function updateStatus(){
  const side = state.turn === "w" ? "White" : "Black";
  if (isKingInCheck(state, state.turn)) {
    statusEl.textContent = `${side} to move — CHECK`;
  } else {
    statusEl.textContent = `${side} to move`;
  }
}

function renderMoveList(){
  moveListEl.innerHTML = "";
  let i = 0;
  for (const h of state.history){
    i++;
    const li = document.createElement("li");
    const from = coordToAlgebraic(h.from.r,h.from.c);
    const to = coordToAlgebraic(h.to.r,h.to.c);
    const text = `${i}. ${from}-${to}${h.capturedPiece ? " x" : ""}`;
    li.textContent = text;
    moveListEl.appendChild(li);
  }
}

// undo last move (simple single-step undo)
function undo() {
  if (aiThinking) return;
  if (state.history.length === 0) return;
  // recreate initial state and replay all but last move
  const lastCount = state.history.length;
  const movesToReplay = state.history.slice(0, lastCount - 1);
  state = newGame();
  for (const m of movesToReplay){
    // construct move object
    const move = {
      from: m.from,
      to: m.to,
      promotion: null,
      isEnPassant: false,
      isCastling: false
    };
    // detect if last was castling by king move distances
    const piece = m.piece;
    if (typeOf(piece) === "K" && Math.abs(m.to.c - m.from.c) === 2) move.isCastling = true;
    // detect en passant: captured piece present and columns differ and captured not at to
    if (m.capturedPiece && typeOf(m.capturedPiece) === "P" && m.from.c !== m.to.c && !state.board[m.to.r][m.to.c]) move.isEnPassant = true;
    applyMoveToState(state, move);
  }
  selected = null; legalTargets = [];
  render();
}

// Reset
function reset() {
  if (aiThinking) return;
  state = newGame();
  selected = null; legalTargets = [];
  render();
}

// --- AI / engine ---

// gather all legal moves for the current state (returns array of move objects compatible with applyMoveToState)
function getAllLegalMoves(s) {
  const moves = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++){
    const p = pieceAt(s,r,c);
    if (!p || colorOf(p) !== s.turn) continue;
    const lm = generateLegalMoves(s,r,c);
    for (const m of lm){
      const move = {
        from: {r,c},
        to: {r:m.r, c:m.c},
        isEnPassant: !!m.isEnPassant,
        isCastling: !!m.isCastling,
        promotion: m.promotion || null
      };
      moves.push(move);
    }
  }
  return moves;
}

// evaluation function: positive favors White
function evaluatePosition(s) {
  // piece values
  const PV = { P:100, N:320, B:330, R:500, Q:900, K:20000 };
  let score = 0;
  let whiteMoves = 0, blackMoves = 0;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++){
    const p = s.board[r][c];
    if (!p) continue;
    const val = PV[typeOf(p)] || 0;
    score += (colorOf(p) === "w") ? val : -val;
  }
  // mobility small bonus
  const saveTurn = s.turn;
  s.turn = "w";
  whiteMoves = countAllLegalMoves(s);
  s.turn = "b";
  blackMoves = countAllLegalMoves(s);
  s.turn = saveTurn;
  score += 10 * (whiteMoves - blackMoves) * 0.1;

  // checkmate detection
  // if side to move has no legal move:
  const side = s.turn;
  let anyLegal = false;
  for (let r=0;r<8 && !anyLegal;r++) for (let c=0;c<8 && !anyLegal;c++){
    const p = pieceAt(s,r,c);
    if (p && colorOf(p) === side) {
      const legal = generateLegalMoves(s, r, c);
      if (legal.length > 0) anyLegal = true;
    }
  }
  if (!anyLegal) {
    if (isKingInCheck(s, side)) {
      // side is checkmated: very bad for side
      return side === "w" ? -100000 : 100000;
    } else {
      return 0; // stalemate
    }
  }
  return score;
}

function countAllLegalMoves(s) {
  let cnt = 0;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++){
    const p = pieceAt(s,r,c);
    if (p && colorOf(p) === s.turn) {
      cnt += generateLegalMoves(s,r,c).length;
    }
  }
  return cnt;
}

// minimax with alpha-beta; maximizing = true if maximizing for 'w'
function minimax(s, depth, alpha, beta, maximizing) {
  if (depth === 0) {
    return evaluatePosition(s);
  }
  // generate moves and order captures first
  const moves = getAllLegalMoves(s);
  if (moves.length === 0) {
    // terminal handled in evaluatePosition
    return evaluatePosition(s);
  }
  // move ordering: prefer captures
  moves.sort((a,b) => {
    const aCap = pieceAt(s, a.to.r, a.to.c) ? 1 : 0;
    const bCap = pieceAt(s, b.to.r, b.to.c) ? 1 : 0;
    return bCap - aCap;
  });

  if (maximizing) {
    let maxEval = -Infinity;
    for (const mv of moves) {
      const clone = cloneState(s);
      applyMoveToState(clone, mv);
      const val = minimax(clone, depth-1, alpha, beta, false);
      maxEval = Math.max(maxEval, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const mv of moves) {
      const clone = cloneState(s);
      applyMoveToState(clone, mv);
      const val = minimax(clone, depth-1, alpha, beta, true);
      minEval = Math.min(minEval, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

// pick best move for current state; returns move object or null
function pickBestMove(s) {
  const moves = getAllLegalMoves(s);
  if (moves.length === 0) return null;
  if (aiLevel === "easy") {
    // random move
    return moves[Math.floor(Math.random() * moves.length)];
  }
  const depth = (aiLevel === "medium") ? 2 : 3; // medium=2, hard=3
  const maximizing = (s.turn === "w"); // maximize for white
  let bestVal = maximizing ? -Infinity : Infinity;
  let bestMove = null;

  // order captures first
  moves.sort((a,b) => {
    const aCap = pieceAt(s, a.to.r, a.to.c) ? 1 : 0;
    const bCap = pieceAt(s, b.to.r, b.to.c) ? 1 : 0;
    return bCap - aCap;
  });

  for (const mv of moves) {
    const clone = cloneState(s);
    applyMoveToState(clone, mv);
    const val = minimax(clone, depth-1, -Infinity, Infinity, !maximizing);
    if (maximizing) {
      if (val > bestVal) { bestVal = val; bestMove = mv; }
    } else {
      if (val < bestVal) { bestVal = val; bestMove = mv; }
    }
  }
  return bestMove || moves[0];
}

// Trigger AI move if appropriate
function maybeTriggerAIMove() {
  if (aiThinking) return;
  if (gameMode !== "ai") return;
  if (state.turn !== aiSide) return;
  // check if game over
  // see if side to move has any legal move
  let anyLegal = false;
  for (let r=0;r<8 && !anyLegal;r++) for (let c=0;c<8 && !anyLegal;c++){
    const p = pieceAt(state,r,c);
    if (p && colorOf(p) === state.turn) {
      const legal = generateLegalMoves(state, r, c);
      if (legal.length > 0) anyLegal = true;
    }
  }
  if (!anyLegal) return;

  aiThinking = true;
  statusEl.textContent = (state.turn === "w" ? "White" : "Black") + " (AI) thinking...";
  // small delay to keep UI responsive
  setTimeout(() => {
    const sClone = cloneState(state);
    const mv = pickBestMove(sClone);
    if (mv) {
      // if promotion, auto-queen for AI
      if (typeOf(sClone.board[mv.from.r][mv.from.c]) === "P" && (mv.to.r === 0 || mv.to.r === 7)) {
        mv.promotion = "Q";
      }
      applyMoveToState(state, mv);
      selected = null; legalTargets = [];
      checkGameEnd();
      render();
    }
    aiThinking = false;
  }, 150);
}

/* Notes on the engine:
 - Simple evaluation: material weights + mobility bonus. Positive score favors White.
 - Minimax depth: medium=2, hard=3. These are good compromises in JS for UI responsiveness.
 - Improvements: iterative deepening, quiescence search, transposition table, better evaluation (positional PSTs).
*/

// initial
state = newGame();
render();

undoBtn.addEventListener("click", () => { undo(); });
resetBtn.addEventListener("click", () => { if (confirm("Reset the game?")) reset(); });

/* Notes:
 - This implementation focuses on correctness and adds a playable AI.
 - If you want a much stronger AI, I can add iterative deepening + transposition table and increase depth.
 - I can also add a "Thinking..." spinner, limit thinking time, or let you choose exact depth.
 */
