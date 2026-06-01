/**
 * Pure parser utility functions — no DOM, no global state.
 * Loaded as a classic script BEFORE chat.js so all functions are globally available.
 * Also supports Node require() for unit testing.
 */

// ====== Decision extraction ======
function splitDecisions(text) {
  const decisionPatterns = [
    /^(I'll|I will|Let me|Let's)\s/,
    /^(The best|The right|The correct)\s/,
    /^(I recommend|I suggest|I propose)\s/,
    /^(The plan is|The approach is|We'll use)\s/,
    /^(I've decided|My decision|We should)\s/,
  ];

  const segments = [];
  const lines = text.split('\n');
  let currentText = '';
  let currentDecision = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let isDecision = false;
    for (const pat of decisionPatterns) {
      if (pat.test(line.trim())) {
        isDecision = true;
        break;
      }
    }

    if (isDecision && currentDecision === '') {
      if (currentText) {
        segments.push({ type: 'text', content: currentText });
        currentText = '';
      }
      currentDecision = line;
    } else if (isDecision && currentDecision) {
      currentDecision += '\n' + line;
    } else if (!isDecision && currentDecision) {
      if (line.trim() === '') {
        segments.push({ type: 'decision', content: currentDecision });
        currentDecision = '';
        currentText += '\n' + line;
      } else if (currentDecision.split('\n').length <= 3) {
        currentDecision += '\n' + line;
      } else {
        segments.push({ type: 'decision', content: currentDecision });
        currentDecision = '';
        currentText += line + '\n';
      }
    } else {
      currentText += (currentText ? '\n' : '') + line;
    }
  }

  if (currentDecision) {
    segments.push({ type: 'decision', content: currentDecision });
  }
  if (currentText) {
    segments.push({ type: 'text', content: currentText });
  }

  return segments;
}

// ====== Block-level content parser ======
function parseContentBlocks(text) {
  const lines = text.split('\n');
  const result = [];
  const buf = [];

  function flushBuf() {
    if (buf.length > 0) {
      result.push({ type: 'text', content: buf.join('\n') });
      buf.length = 0;
    }
  }

  function tryParseTable(i) {
    const line = lines[i];
    if (!/^\|.*\|$/.test(line.trim())) return -1;

    const nextNonEmpty = findNextNonEmpty(lines, i + 1);
    if (nextNonEmpty === -1 || !/^\|[\s\-:|]+\|$/.test(lines[nextNonEmpty].trim())) return -1;

    flushBuf();
    const tableLines = [line];
    i++;
    while (i < lines.length) {
      if (i === nextNonEmpty) {
        tableLines.push(lines[i]);
      } else if (/^\|.*\|$/.test(lines[i].trim())) {
        tableLines.push(lines[i]);
      } else if (lines[i].trim() === '') {
        break;
      }
      i++;
    }
    result.push(...parseTable(tableLines));
    return i;
  }

  function tryParseUnorderedList(i) {
    const line = lines[i];
    if (!/^[\-\*]\s/.test(line)) return -1;

    flushBuf();
    const items = [];
    while (i < lines.length && /^[\-\*]\s/.test(lines[i])) {
      items.push(lines[i].replace(/^[\-\*]\s+/, ''));
      i++;
    }
    result.push({ type: 'ulist', items: items });
    return i;
  }

  function tryParseOrderedList(i) {
    const line = lines[i];
    if (!/^\d+\.\s/.test(line)) return -1;

    flushBuf();
    const items = [];
    while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
      items.push(lines[i].replace(/^\d+\.\s+/, ''));
      i++;
    }
    result.push({ type: 'olist', items: items });
    return i;
  }

  function tryParseBlockquote(i) {
    const line = lines[i];
    if (!line.startsWith('>')) return -1;

    flushBuf();
    const quoteLines = [];
    while (i < lines.length && lines[i].startsWith('>')) {
      quoteLines.push(lines[i].replace(/^>\s?/, ''));
      i++;
    }
    result.push({ type: 'blockquote', content: quoteLines.join('\n') });
    return i;
  }

  function tryParseHeading(i) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{2,4})\s+(.+)/);
    if (!headingMatch) return -1;

    flushBuf();
    result.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] });
    return i + 1;
  }

  let i = 0;
  while (i < lines.length) {
    let advanced = false;

    let next = tryParseTable(i);
    if (next !== -1) { i = next; advanced = true; continue; }

    next = tryParseUnorderedList(i);
    if (next !== -1) { i = next; advanced = true; continue; }

    next = tryParseOrderedList(i);
    if (next !== -1) { i = next; advanced = true; continue; }

    next = tryParseBlockquote(i);
    if (next !== -1) { i = next; advanced = true; continue; }

    next = tryParseHeading(i);
    if (next !== -1) { i = next; advanced = true; continue; }

    if (!advanced) {
      buf.push(lines[i]);
      i++;
    }
  }

  flushBuf();
  return result;
}

// ====== Helper: find next non-empty line ======
function findNextNonEmpty(lines, start) {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim() !== '') return i;
  }
  return -1;
}

// ====== Table parser ======
function parseTable(lines) {
  if (lines.length < 2) return [{ type: 'text', content: lines.join('\n') }];

  const parseRow = (row) => {
    return row.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  };

  const header = parseRow(lines[0]);
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    if (/^\|.*\|$/.test(lines[i].trim())) {
      rows.push(parseRow(lines[i]));
    } else {
      const remaining = lines.slice(i).join('\n');
      return [{ type: 'table', header: header, rows: rows }, { type: 'text', content: remaining }];
    }
  }
  return [{ type: 'table', header: header, rows: rows }];
}

// ====== Inline markdown to HTML (simple, no block-level) ======
function simpleMarkdownInline(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--accent-light);padding:1px 5px;border-radius:3px;font-size:13px;">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}

// ====== Thinking summary ======
function generateThinkingSummary(text) {
  if (!text) return '(思考中)';
  const cleaned = text.replace(/^[\s\n]+/, '');
  const firstLine = cleaned.split('\n')[0];
  if (firstLine.length <= 80) return firstLine || '(思考中)';
  const truncated = firstLine.substring(0, 80);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 40 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

// ====== HTML escaping ======
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ====== Node.js CommonJS export (for unit testing) ======
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseContentBlocks,
    splitDecisions,
    parseTable,
    findNextNonEmpty,
    simpleMarkdownInline,
    escapeHtml,
    generateThinkingSummary
  };
}
