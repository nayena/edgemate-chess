// rules.js — the only place chess rules are written. Hand-written, no chess library.
// Shared by hot-seat, vs-computer, and the online server so all three modes provably
// agree on what's legal. Board: flat 64-array, index = rank * 8 + file, rank 0 = rank 1
// (White's back rank), file 0 = the a-file. Pieces: 'P N B R Q K' = White, lowercase = Black.

const FILES = 'abcdefgh';

export function squareName(sq) {
  const file = sq % 8;
  const rank = Math.floor(sq / 8);
  return FILES[file] + (rank + 1);
}

export function parseSquare(name) {
  const file = FILES.indexOf(name[0]);
  const rank = Number(name[1]) - 1;
  return rank * 8 + file;
}

function fileOf(sq) {
  return sq % 8;
}

function rankOf(sq) {
  return Math.floor(sq / 8);
}

function onBoard(file, rank) {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

function sq(file, rank) {
  return rank * 8 + file;
}

function isWhitePiece(piece) {
  return piece != null && piece === piece.toUpperCase();
}

function pieceColor(piece) {
  if (piece == null) return null;
  return isWhitePiece(piece) ? 'w' : 'b';
}

const KNIGHT_OFFSETS = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

const KING_OFFSETS = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];

const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const QUEEN_DIRS = [...BISHOP_DIRS, ...ROOK_DIRS];

const CASTLE_RIGHTS_FOR_SQUARE = {
  [sq(4, 0)]: ['K', 'Q'],
  [sq(0, 0)]: ['Q'],
  [sq(7, 0)]: ['K'],
  [sq(4, 7)]: ['k', 'q'],
  [sq(0, 7)]: ['q'],
  [sq(7, 7)]: ['k'],
};

export function createInitialState() {
  const board = new Array(64).fill(null);
  const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let file = 0; file < 8; file++) {
    board[sq(file, 0)] = backRank[file];
    board[sq(file, 1)] = 'P';
    board[sq(file, 6)] = 'p';
    board[sq(file, 7)] = backRank[file].toLowerCase();
  }
  return {
    board,
    turn: 'w',
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: null,
  };
}

function cloneState(state) {
  return {
    board: state.board.slice(),
    turn: state.turn,
    castling: { ...state.castling },
    enPassant: state.enPassant,
  };
}

function findKing(board, color) {
  const king = color === 'w' ? 'K' : 'k';
  for (let s = 0; s < 64; s++) {
    if (board[s] === king) return s;
  }
  return -1;
}

// Is `square` attacked by any piece of `byColor`? Used for check detection and for
// verifying a king doesn't castle through or into an attacked square.
function isSquareAttacked(board, square, byColor) {
  const file = fileOf(square);
  const rank = rankOf(square);

  const pawnDir = byColor === 'w' ? -1 : 1; // where an attacking pawn would stand, relative to square
  const pawn = byColor === 'w' ? 'P' : 'p';
  for (const df of [-1, 1]) {
    const f = file + df;
    const r = rank + pawnDir;
    if (onBoard(f, r) && board[sq(f, r)] === pawn) return true;
  }

  const knight = byColor === 'w' ? 'N' : 'n';
  for (const [df, dr] of KNIGHT_OFFSETS) {
    const f = file + df;
    const r = rank + dr;
    if (onBoard(f, r) && board[sq(f, r)] === knight) return true;
  }

  const king = byColor === 'w' ? 'K' : 'k';
  for (const [df, dr] of KING_OFFSETS) {
    const f = file + df;
    const r = rank + dr;
    if (onBoard(f, r) && board[sq(f, r)] === king) return true;
  }

  const bishop = byColor === 'w' ? 'B' : 'b';
  const rook = byColor === 'w' ? 'R' : 'r';
  const queen = byColor === 'w' ? 'Q' : 'q';
  for (const [df, dr] of QUEEN_DIRS) {
    let f = file + df;
    let r = rank + dr;
    const isDiagonal = df !== 0 && dr !== 0;
    while (onBoard(f, r)) {
      const piece = board[sq(f, r)];
      if (piece != null) {
        if (piece === queen || (isDiagonal && piece === bishop) || (!isDiagonal && piece === rook)) {
          return true;
        }
        break;
      }
      f += df;
      r += dr;
    }
  }

  return false;
}

export function isInCheck(state, color) {
  const kingSq = findKing(state.board, color);
  const enemy = color === 'w' ? 'b' : 'w';
  return isSquareAttacked(state.board, kingSq, enemy);
}

const PROMOTION_PIECES = ['Q', 'R', 'B', 'N'];

function addPawnMoves(state, from, moves) {
  const { board, turn, enPassant } = state;
  const color = turn;
  const dir = color === 'w' ? 1 : -1;
  const startRank = color === 'w' ? 1 : 6;
  const promoteRank = color === 'w' ? 7 : 0;
  const file = fileOf(from);
  const rank = rankOf(from);

  const oneStep = sq(file, rank + dir);
  if (onBoard(file, rank + dir) && board[oneStep] == null) {
    pushPawnMove(moves, from, oneStep, null, promoteRank, rank + dir, color);
    const twoStep = sq(file, rank + 2 * dir);
    if (rank === startRank && board[twoStep] == null) {
      moves.push({ from, to: twoStep, piece: color === 'w' ? 'P' : 'p', captured: null, promotion: null, flag: 'double' });
    }
  }

  for (const df of [-1, 1]) {
    const f = file + df;
    const r = rank + dir;
    if (!onBoard(f, r)) continue;
    const target = sq(f, r);
    const targetPiece = board[target];
    if (targetPiece != null && pieceColor(targetPiece) !== color) {
      pushPawnMove(moves, from, target, targetPiece, promoteRank, r, color);
    } else if (target === enPassant) {
      moves.push({ from, to: target, piece: color === 'w' ? 'P' : 'p', captured: color === 'w' ? 'p' : 'P', promotion: null, flag: 'ep' });
    }
  }
}

function pushPawnMove(moves, from, to, captured, promoteRank, toRank, color) {
  const piece = color === 'w' ? 'P' : 'p';
  if (toRank === promoteRank) {
    for (const promo of PROMOTION_PIECES) {
      moves.push({ from, to, piece, captured, promotion: color === 'w' ? promo : promo.toLowerCase(), flag: 'promotion' });
    }
  } else {
    moves.push({ from, to, piece, captured, promotion: null, flag: captured ? 'capture' : 'normal' });
  }
}

function addOffsetMoves(state, from, offsets, pieceLetter, moves) {
  const { board, turn } = state;
  const file = fileOf(from);
  const rank = rankOf(from);
  for (const [df, dr] of offsets) {
    const f = file + df;
    const r = rank + dr;
    if (!onBoard(f, r)) continue;
    const to = sq(f, r);
    const target = board[to];
    if (target == null) {
      moves.push({ from, to, piece: pieceLetter, captured: null, promotion: null, flag: 'normal' });
    } else if (pieceColor(target) !== turn) {
      moves.push({ from, to, piece: pieceLetter, captured: target, promotion: null, flag: 'capture' });
    }
  }
}

function addSlidingMoves(state, from, dirs, pieceLetter, moves) {
  const { board, turn } = state;
  const file = fileOf(from);
  const rank = rankOf(from);
  for (const [df, dr] of dirs) {
    let f = file + df;
    let r = rank + dr;
    while (onBoard(f, r)) {
      const to = sq(f, r);
      const target = board[to];
      if (target == null) {
        moves.push({ from, to, piece: pieceLetter, captured: null, promotion: null, flag: 'normal' });
      } else {
        if (pieceColor(target) !== turn) {
          moves.push({ from, to, piece: pieceLetter, captured: target, promotion: null, flag: 'capture' });
        }
        break;
      }
      f += df;
      r += dr;
    }
  }
}

function addCastlingMoves(state, from, moves) {
  const { board, turn, castling } = state;
  const enemy = turn === 'w' ? 'b' : 'w';
  const rank = turn === 'w' ? 0 : 7;
  const kingsideRight = turn === 'w' ? 'K' : 'k';
  const queensideRight = turn === 'w' ? 'Q' : 'q';
  const rookLetter = turn === 'w' ? 'R' : 'r';

  if (isSquareAttacked(board, from, enemy)) return; // can't castle out of check

  if (castling[kingsideRight] && board[sq(7, rank)] === rookLetter) {
    const f1 = sq(5, rank);
    const g1 = sq(6, rank);
    if (board[f1] == null && board[g1] == null &&
        !isSquareAttacked(board, f1, enemy) && !isSquareAttacked(board, g1, enemy)) {
      moves.push({ from, to: g1, piece: turn === 'w' ? 'K' : 'k', captured: null, promotion: null, flag: 'castleK' });
    }
  }

  if (castling[queensideRight] && board[sq(0, rank)] === rookLetter) {
    const d1 = sq(3, rank);
    const c1 = sq(2, rank);
    const b1 = sq(1, rank);
    if (board[d1] == null && board[c1] == null && board[b1] == null &&
        !isSquareAttacked(board, d1, enemy) && !isSquareAttacked(board, c1, enemy)) {
      moves.push({ from, to: c1, piece: turn === 'w' ? 'K' : 'k', captured: null, promotion: null, flag: 'castleQ' });
    }
  }
}

function generatePseudoLegalMoves(state) {
  const { board, turn } = state;
  const moves = [];
  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (piece == null || pieceColor(piece) !== turn) continue;
    const type = piece.toUpperCase();
    if (type === 'P') {
      addPawnMoves(state, from, moves);
    } else if (type === 'N') {
      addOffsetMoves(state, from, KNIGHT_OFFSETS, piece, moves);
    } else if (type === 'B') {
      addSlidingMoves(state, from, BISHOP_DIRS, piece, moves);
    } else if (type === 'R') {
      addSlidingMoves(state, from, ROOK_DIRS, piece, moves);
    } else if (type === 'Q') {
      addSlidingMoves(state, from, QUEEN_DIRS, piece, moves);
    } else if (type === 'K') {
      addOffsetMoves(state, from, KING_OFFSETS, piece, moves);
      addCastlingMoves(state, from, moves);
    }
  }
  return moves;
}

export function applyMove(state, move) {
  const next = cloneState(state);
  const { board } = next;
  const color = state.turn;

  board[move.to] = move.promotion != null ? move.promotion : move.piece;
  board[move.from] = null;

  if (move.flag === 'ep') {
    const capturedSquare = sq(fileOf(move.to), rankOf(move.from));
    board[capturedSquare] = null;
  }

  if (move.flag === 'castleK') {
    const r = rankOf(move.from);
    board[sq(5, r)] = board[sq(7, r)];
    board[sq(7, r)] = null;
  } else if (move.flag === 'castleQ') {
    const r = rankOf(move.from);
    board[sq(3, r)] = board[sq(0, r)];
    board[sq(0, r)] = null;
  }

  next.enPassant = null;
  if (move.flag === 'double') {
    next.enPassant = sq(fileOf(move.from), (rankOf(move.from) + rankOf(move.to)) / 2);
  }

  if (CASTLE_RIGHTS_FOR_SQUARE[move.from]) {
    for (const right of CASTLE_RIGHTS_FOR_SQUARE[move.from]) next.castling[right] = false;
  }
  if (CASTLE_RIGHTS_FOR_SQUARE[move.to]) {
    for (const right of CASTLE_RIGHTS_FOR_SQUARE[move.to]) next.castling[right] = false;
  }

  next.turn = color === 'w' ? 'b' : 'w';
  return next;
}

export function generateLegalMoves(state) {
  const pseudoLegal = generatePseudoLegalMoves(state);
  const legal = [];
  for (const move of pseudoLegal) {
    const resulting = applyMove(state, move);
    if (!isInCheck(resulting, state.turn)) {
      legal.push(move);
    }
  }
  return legal;
}

export function getGameStatus(state) {
  const inCheck = isInCheck(state, state.turn);
  const hasMoves = generateLegalMoves(state).length > 0;
  if (!hasMoves) return inCheck ? 'checkmate' : 'stalemate';
  return inCheck ? 'check' : 'ongoing';
}

export function perft(state, depth) {
  if (depth === 0) return 1;
  const moves = generateLegalMoves(state);
  if (depth === 1) return moves.length;
  let count = 0;
  for (const move of moves) {
    count += perft(applyMove(state, move), depth - 1);
  }
  return count;
}
