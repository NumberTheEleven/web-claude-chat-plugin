const { parseContentBlocks, splitDecisions, parseTable, findNextNonEmpty, simpleMarkdownInline, escapeHtml, generateThinkingSummary } = require('../web/js/parser-utils.js');
const assert = require('assert');

// TC-008: Table parsing
const tableInput = '| Name | Value |\n|------|-------|\n| foo  | bar   |';
const tableResult = parseContentBlocks(tableInput);
assert(tableResult.length > 0, 'TC-008 FAIL: Table should produce output');
assert(tableResult[0].type === 'table', 'TC-008 FAIL: First block should be a table');
assert(tableResult[0].header.length === 2, 'TC-008 FAIL: Table should have 2 header columns');
assert(tableResult[0].rows.length === 1, 'TC-008 FAIL: Table should have 1 data row');
assert(tableResult[0].rows[0][0] === 'foo', 'TC-008 FAIL: First cell should be foo');
console.log('TC-008 PASS: Table parsing');

// TC-009: List parsing
const ulInput = '- item1\n- item2';
const ulResult = parseContentBlocks(ulInput);
const ulBlock = ulResult.find(b => b.type === 'ulist');
assert(ulBlock, 'TC-009 FAIL: Should find unordered list');
assert(ulBlock.items.length === 2, 'TC-009 FAIL: Unordered list should have 2 items');

const olInput = '1. first\n2. second';
const olResult = parseContentBlocks(olInput);
const olBlock = olResult.find(b => b.type === 'olist');
assert(olBlock, 'TC-009 FAIL: Should find ordered list');
assert(olBlock.items.length === 2, 'TC-009 FAIL: Ordered list should have 2 items');
console.log('TC-009 PASS: List parsing');

// TC-010: Blockquote
const quoteInput = '> quoted text';
const quoteResult = parseContentBlocks(quoteInput);
assert(quoteResult[0].type === 'blockquote', 'TC-010 FAIL: Should detect blockquote');
assert(quoteResult[0].content === 'quoted text', 'TC-010 FAIL: Should strip >');
console.log('TC-010 PASS: Blockquote');

// TC-011: Heading
const headingInput = '## My Heading';
const headingResult = parseContentBlocks(headingInput);
assert(headingResult[0].type === 'heading', 'TC-011 FAIL: Should detect heading');
assert(headingResult[0].level === 2, 'TC-011 FAIL: Should be h2');
assert(headingResult[0].content === 'My Heading', 'TC-011 FAIL: Should extract content');
console.log('TC-011 PASS: Heading');

// TC-012: splitDecisions
const decisionInput = "I'll use React for the frontend.\nThis keeps it consistent.";
const decResult = splitDecisions(decisionInput);
assert(decResult.length > 0, 'TC-012 FAIL: splitDecisions should produce output');
const decBlock = decResult.find(s => s.type === 'decision');
assert(decBlock, 'TC-012 FAIL: Should find a decision segment');
console.log('TC-012 PASS: splitDecisions');

// TC-013: escapeHtml
assert(escapeHtml('<script>') === '&lt;script&gt;', 'TC-013 FAIL: Should escape HTML');
assert(escapeHtml('foo & bar') === 'foo &amp; bar', 'TC-013 FAIL: Should escape ampersand');
console.log('TC-013 PASS: escapeHtml');

// TC-014: simpleMarkdownInline
assert(simpleMarkdownInline('**bold**').includes('strong'), 'TC-014 FAIL: Should handle bold');
assert(simpleMarkdownInline('*italic*').includes('em'), 'TC-014 FAIL: Should handle italic');
assert(simpleMarkdownInline('`code`').includes('code'), 'TC-014 FAIL: Should handle inline code');
console.log('TC-014 PASS: simpleMarkdownInline');

// TC-015: findNextNonEmpty
assert(findNextNonEmpty(['', '', 'hello'], 0) === 2, 'TC-015 FAIL: Should skip empty lines');
assert(findNextNonEmpty(['', ''], 0) === -1, 'TC-015 FAIL: Should return -1 when all empty');
assert(findNextNonEmpty(['a', 'b'], 0) === 0, 'TC-015 FAIL: Should return first if non-empty');
console.log('TC-015 PASS: findNextNonEmpty');

// TC-016: generateThinkingSummary
assert(generateThinkingSummary('') === '(思考中)', 'TC-016 FAIL: Empty string');
assert(generateThinkingSummary(null) === '(思考中)', 'TC-016 FAIL: Null input');
assert(generateThinkingSummary('Short summary') === 'Short summary', 'TC-016 FAIL: Short text');
assert(generateThinkingSummary('A'.repeat(100)).endsWith('...'), 'TC-016 FAIL: Long text should truncate');
console.log('TC-016 PASS: generateThinkingSummary');

// TC-017: parseTable standalone
const rawTableLines = ['| A | B |', '|-----|-----|', '| 1 | 2 |'];
const parsedTable = parseTable(rawTableLines);
assert(parsedTable[0].type === 'table', 'TC-017 FAIL: Standalone table parse');
assert(parsedTable[0].header[0] === 'A', 'TC-017 FAIL: Standalone table header');
assert(parsedTable[0].rows[0][0] === '1', 'TC-017 FAIL: Standalone table row');
console.log('TC-017 PASS: parseTable standalone');

console.log('\nAll parser tests passed!');
