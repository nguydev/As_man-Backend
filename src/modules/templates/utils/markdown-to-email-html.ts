/** Escape HTML then apply a small markdown subset for email HTML bodies. */
function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inline(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(
      /`([^`]+)`/g,
      '<code style="font-family:ui-monospace,monospace;font-size:0.9em">$1</code>',
    );
}

export function markdownToEmailHtml(markdown: string) {
  const escaped = escapeHtml(markdown);
  const lines = escaped.replaceAll('\r\n', '\n').split('\n');
  const html: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      html.push('<br/>');
      continue;
    }

    if (/^###\s+/.test(line)) {
      closeList();
      html.push(
        `<h3 style="margin:16px 0 8px;font-size:16px">${inline(line.replace(/^###\s+/, ''))}</h3>`,
      );
      continue;
    }
    if (/^##\s+/.test(line)) {
      closeList();
      html.push(
        `<h2 style="margin:20px 0 8px;font-size:18px">${inline(line.replace(/^##\s+/, ''))}</h2>`,
      );
      continue;
    }
    if (/^#\s+/.test(line)) {
      closeList();
      html.push(
        `<h1 style="margin:8px 0 12px;font-size:22px">${inline(line.replace(/^#\s+/, ''))}</h1>`,
      );
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html.push('<ul style="margin:8px 0;padding-left:20px">');
        inList = true;
      }
      html.push(
        `<li style="margin:4px 0">${inline(line.replace(/^[-*]\s+/, ''))}</li>`,
      );
      continue;
    }

    closeList();
    html.push(
      `<p style="margin:6px 0;line-height:1.5;font-size:14px">${inline(line)}</p>`,
    );
  }

  closeList();
  return `<div style="font-family:system-ui,-apple-system,sans-serif;color:#18181b">${html.join('')}</div>`;
}
