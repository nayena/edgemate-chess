import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  applyMove,
  generateLegalMoves,
  getGameStatus,
  perft,
  parseSquare,
} from './rules.js';

test('perft from the starting position matches known-correct counts', () => {
  const state = createInitialState();
  assert.equal(perft(state, 1), 20);
  assert.equal(perft(state, 2), 400);
  assert.equal(perft(state, 3), 8902);
});

function move(state, from, to, promotion = null) {
  const legal = generateLegalMoves(state);
  const found = legal.find((m) => m.from === parseSquare(from) && m.to === parseSquare(to) &&
    (promotion == null || m.promotion?.toUpperCase() === promotion));
  assert.ok(found, `expected ${from}-${to} to be legal`);
  return applyMove(state, found);
}

test("Fool's Mate ends in checkmate", () => {
  let state = createInitialState();
  state = move(state, 'f2', 'f3');
  state = move(state, 'e7', 'e5');
  state = move(state, 'g2', 'g4');
  state = move(state, 'd8', 'h4');
  assert.equal(getGameStatus(state), 'checkmate');
});

test("Scholar's Mate ends in checkmate", () => {
  let state = createInitialState();
  state = move(state, 'e2', 'e4');
  state = move(state, 'e7', 'e5');
  state = move(state, 'f1', 'c4');
  state = move(state, 'b8', 'c6');
  state = move(state, 'd1', 'h5');
  state = move(state, 'g8', 'f6');
  state = move(state, 'h5', 'f7');
  assert.equal(getGameStatus(state), 'checkmate');
});

test('a simple stalemate position is detected', () => {
  // White king a1, Black king a3, Black queen b3 — Black to move stalemates White... but we
  // need White stalemated with White to move. King on a1, no other White pieces, Black king
  // c2 and queen b3: White has no legal move and is not in check.
  const board = new Array(64).fill(null);
  board[parseSquare('a1')] = 'K';
  board[parseSquare('c2')] = 'k';
  board[parseSquare('b3')] = 'q';
  const state = { board, turn: 'w', castling: { K: false, Q: false, k: false, q: false }, enPassant: null };
  assert.equal(getGameStatus(state), 'stalemate');
});

test('castling: white kingside castle moves king and rook together', () => {
  const board = new Array(64).fill(null);
  board[parseSquare('e1')] = 'K';
  board[parseSquare('h1')] = 'R';
  board[parseSquare('e8')] = 'k';
  const state = { board, turn: 'w', castling: { K: true, Q: false, k: false, q: false }, enPassant: null };
  const next = move(state, 'e1', 'g1');
  assert.equal(next.board[parseSquare('g1')], 'K');
  assert.equal(next.board[parseSquare('f1')], 'R');
  assert.equal(next.board[parseSquare('e1')], null);
  assert.equal(next.board[parseSquare('h1')], null);
});

test('castling is illegal while in check or through an attacked square', () => {
  const board = new Array(64).fill(null);
  board[parseSquare('e1')] = 'K';
  board[parseSquare('h1')] = 'R';
  board[parseSquare('e8')] = 'k';
  board[parseSquare('f8')] = 'r'; // attacks f1, the square the king passes through
  const state = { board, turn: 'w', castling: { K: true, Q: false, k: false, q: false }, enPassant: null };
  const legal = generateLegalMoves(state);
  assert.ok(!legal.some((m) => m.flag === 'castleK'));
});

test('en passant capture removes the correct pawn', () => {
  let state = createInitialState();
  state = move(state, 'e2', 'e4');
  state = move(state, 'a7', 'a6');
  state = move(state, 'e4', 'e5');
  state = move(state, 'd7', 'd5'); // black double-move sets en passant target d6
  const next = move(state, 'e5', 'd6');
  assert.equal(next.board[parseSquare('d5')], null);
  assert.equal(next.board[parseSquare('d6')], 'P');
});

test('pawn promotion offers a choice of piece', () => {
  const board = new Array(64).fill(null);
  board[parseSquare('a7')] = 'P';
  board[parseSquare('e1')] = 'K';
  board[parseSquare('e8')] = 'k';
  const state = { board, turn: 'w', castling: { K: false, Q: false, k: false, q: false }, enPassant: null };
  const legal = generateLegalMoves(state).filter((m) => m.from === parseSquare('a7') && m.to === parseSquare('a8'));
  const promotions = legal.map((m) => m.promotion).sort();
  assert.deepEqual(promotions, ['B', 'N', 'Q', 'R']);
});

test('illegal moves are never generated: a pinned piece cannot move off the pin line', () => {
  const board = new Array(64).fill(null);
  board[parseSquare('e1')] = 'K';
  board[parseSquare('e4')] = 'N'; // pinned by rook on e8
  board[parseSquare('e8')] = 'r';
  board[parseSquare('h8')] = 'k';
  const state = { board, turn: 'w', castling: { K: false, Q: false, k: false, q: false }, enPassant: null };
  const legal = generateLegalMoves(state);
  assert.ok(!legal.some((m) => m.from === parseSquare('e4')));
});
