import { useEffect, useRef } from 'react';
import { Bold, Eraser, Heading2, Italic, Link, List, ListOrdered } from 'lucide-react';

type RichTextEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'P', 'BR', 'UL', 'OL', 'LI', 'A', 'H2', 'H3']);

function sanitizeRichHtml(html: string) {
  if (typeof window === 'undefined') return html;
  const template = document.createElement('template');
  template.innerHTML = html
    .replace(/\s*\\+\s*/g, '<br>')
    .replace(/\r?\n/g, '<br>')
    .replace(/(<br>\s*){3,}/g, '<br><br>');

  template.content.querySelectorAll('*').forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    Array.from(node.attributes).forEach((attribute) => {
      const allowedHref = node.tagName === 'A' && attribute.name === 'href';
      if (!allowedHref) node.removeAttribute(attribute.name);
    });

    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) {
        node.removeAttribute('href');
      } else {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noreferrer');
      }
    }
  });

  return template.innerHTML.trim();
}

export function RichTextEditor({ label, value, onChange }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current || editorRef.current.innerHTML === value) return;
    editorRef.current.innerHTML = value || '';
  }, [value]);

  function run(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(sanitizeRichHtml(editorRef.current?.innerHTML || ''));
  }

  function addLink() {
    const href = window.prompt('Paste link URL');
    if (!href) return;
    run('createLink', href);
  }

  function update() {
    onChange(sanitizeRichHtml(editorRef.current?.innerHTML || ''));
  }

  function pastePlainText(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData
      .getData('text/plain')
      .replace(/\s*\\+\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
    document.execCommand('insertText', false, text);
    update();
  }

  return (
    <label className="rich-editor-field">
      <span>{label}</span>
      <div className="rich-toolbar">
        <button type="button" onClick={() => run('formatBlock', 'h2')} title="Heading"><Heading2 size={16} /></button>
        <button type="button" onClick={() => run('bold')} title="Bold"><Bold size={16} /></button>
        <button type="button" onClick={() => run('italic')} title="Italic"><Italic size={16} /></button>
        <button type="button" onClick={() => run('insertUnorderedList')} title="Bullet list"><List size={16} /></button>
        <button type="button" onClick={() => run('insertOrderedList')} title="Numbered list"><ListOrdered size={16} /></button>
        <button type="button" onClick={addLink} title="Link"><Link size={16} /></button>
        <button type="button" onClick={() => run('removeFormat')} title="Clear formatting"><Eraser size={16} /></button>
      </div>
      <div
        ref={editorRef}
        className="rich-editor"
        contentEditable
        role="textbox"
        aria-multiline="true"
        onInput={update}
        onBlur={update}
        onPaste={pastePlainText}
        suppressContentEditableWarning
      />
    </label>
  );
}
