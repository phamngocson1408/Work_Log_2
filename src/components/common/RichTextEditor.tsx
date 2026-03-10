import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { uploadImage } from '../../lib/uploadImage';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const ToolbarButton: React.FC<{
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, active, title, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`p-1.5 rounded text-xs transition-colors ${
      active
        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
    }`}
  >
    {children}
  </button>
);

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write something…',
  minHeight = 90,
}) => {
  const fromEditorRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({
        autolink: true,
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      fromEditorRef.current = true;
      const html = editor.isEmpty ? '' : editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'rich-editor focus:outline-none',
        style: `min-height:${minHeight}px`,
      },
      // Handle paste: intercept image files from clipboard
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;
            setUploading(true);
            uploadImage(file).then((src) => {
              view.dispatch(
                view.state.tr.replaceSelectionWith(
                  view.state.schema.nodes.image
                    ? view.state.schema.nodes.image.create({ src })
                    : view.state.schema.text('')
                )
              );
            }).finally(() => setUploading(false));
            return true;
          }
        }
        return false;
      },
      // Handle drag-drop of image files
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'));
        if (!imageFile) return false;
        event.preventDefault();
        const coords = { left: event.clientX, top: event.clientY };
        const pos = view.posAtCoords(coords);
        setUploading(true);
        uploadImage(imageFile).then((src) => {
          const node = view.state.schema.nodes.image?.create({ src });
          if (!node) return;
          const transaction = view.state.tr.insert(pos?.pos ?? 0, node);
          view.dispatch(transaction);
        }).finally(() => setUploading(false));
        return true;
      },
    },
  }, []);

  // Sync external value changes
  useEffect(() => {
    if (!editor) return;
    if (fromEditorRef.current) {
      fromEditorRef.current = false;
      return;
    }
    const currentHTML = editor.isEmpty ? '' : editor.getHTML();
    if (currentHTML !== value) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  const insertImageFromFile = useCallback(
    async (file: File) => {
      if (!editor) return;
      setUploading(true);
      try {
        const src = await uploadImage(file);
        editor.chain().focus().setImage({ src }).run();
      } finally {
        setUploading(false);
      }
    },
    [editor]
  );

  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const existing = editor.getAttributes('link').href as string | undefined;
    setLinkUrl(existing ?? '');
    setLinkDialogOpen(true);
  }, [editor]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
      editor.chain().focus().setLink({ href, target: '_blank' }).run();
    }
    setLinkDialogOpen(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) insertImageFromFile(file);
    e.target.value = '';
  };

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <s>S</s>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Inline code"
        >
          {'</>'}
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          ≡
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          1.
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Blockquote"
        >
          "
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Link button */}
        <ToolbarButton
          onClick={openLinkDialog}
          active={editor.isActive('link')}
          title="Insert / edit link"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Image upload button */}
        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          title="Insert image"
        >
          {uploading ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Link dialog */}
      {linkDialogOpen && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60">
          <input
            autoFocus
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
              if (e.key === 'Escape') { setLinkDialogOpen(false); }
            }}
            placeholder="https://example.com"
            className="flex-1 text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={applyLink}
            className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {linkUrl.trim() ? 'Apply' : 'Remove'}
          </button>
          <button
            type="button"
            onClick={() => setLinkDialogOpen(false)}
            className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-700"
      />
    </div>
  );
};
