import { useState, useRef, useEffect, useCallback } from 'react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_COUNT = 5;

export default function MessageInput({ onSend, disabled, uploading }) {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]); // [{ file, previewUrl }, ...]
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    if (!disabled && !uploading) textareaRef.current?.focus();
  }, [disabled, uploading]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const adjustHeight = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  const addImageFiles = useCallback((files) => {
    setImages((prev) => {
      const remaining = MAX_IMAGE_COUNT - prev.length;
      if (remaining <= 0) {
        showToast(`最多只能添加 ${MAX_IMAGE_COUNT} 张图片`);
        return prev;
      }

      const newImages = [];
      let skippedSize = 0;
      let skippedType = 0;

      for (const file of files) {
        if (newImages.length >= remaining) break;
        if (!file || !file.type.startsWith('image/')) { skippedType++; continue; }
        if (file.size > MAX_FILE_SIZE) { skippedSize++; continue; }
        newImages.push({ file, previewUrl: URL.createObjectURL(file) });
      }

      if (skippedSize > 0) showToast(`${skippedSize} 个文件超过 10MB 限制，已跳过`);
      else if (skippedType > 0) showToast(`${skippedType} 个非图片文件已跳过`);
      else if (files.length > remaining + newImages.length) showToast(`最多 ${MAX_IMAGE_COUNT} 张，部分图片未添加`);

      return [...prev, ...newImages];
    });
  }, [showToast]);

  const removeImage = useCallback((index) => {
    setImages((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const clearImages = useCallback(() => {
    setImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if ((!trimmed && images.length === 0) || disabled || uploading) return;
    onSend(
      trimmed || (images.length === 1 ? '请分析这张图片' : `请分析这${images.length}张图片`),
      images.map((img) => img.file),
    );
    setText('');
    setImages([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        imageFiles.push(item.getAsFile());
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addImageFiles(imageFiles);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addImageFiles(Array.from(e.dataTransfer?.files || []));
  };

  const isDisabled = disabled || uploading;

  return (
    <div className="border-t border-border bg-zinc-950 px-4 py-3">
      <div className="max-w-3xl mx-auto">
        {/* Toast notification */}
        {toast && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs
                          animate-[fadeIn_0.2s_ease-out]">
            {toast}
          </div>
        )}

        {/* Image previews */}
        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 items-start">
            {images.map((img, i) => (
              <div key={i} className="relative inline-block group">
                <img
                  src={img.previewUrl}
                  alt={`Preview ${i + 1}`}
                  className="h-24 max-w-[160px] rounded-lg border border-border object-cover
                             transition-opacity group-hover:opacity-80"
                />
                <button
                  onClick={() => removeImage(i)}
                  disabled={isDisabled}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600
                             text-white text-xs flex items-center justify-center transition-colors cursor-pointer
                             opacity-0 group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="self-center flex items-center gap-2">
              <span className="text-xs text-zinc-500">{images.length}/{MAX_IMAGE_COUNT}</span>
              {images.length > 1 && (
                <button
                  onClick={clearImages}
                  disabled={isDisabled}
                  className="text-xs text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                >
                  清除全部
                </button>
              )}
            </div>
          </div>
        )}

        {/* Upload progress bar */}
        {uploading && (
          <div className="mb-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
              <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span>{uploading}</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300 animate-pulse"
                   style={{ width: '60%' }} />
            </div>
          </div>
        )}

        <div
          className={`flex items-end gap-2 bg-surface rounded-2xl border transition-colors px-4 py-2
            ${dragOver ? 'border-primary bg-primary/5' : 'border-border focus-within:border-primary/50'}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        >
          {/* Image upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            className="shrink-0 p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-hover
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer relative"
            title={`上传图片 (最多${MAX_IMAGE_COUNT}张, 单张≤10MB)`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {images.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px]
                               text-white flex items-center justify-center font-medium">
                {images.length}
              </span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              addImageFiles(Array.from(e.target.files || []));
              e.target.value = '';
            }}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => { setText(e.target.value); adjustHeight(); }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={uploading ? '图片上传中...' : isDisabled ? '等待回复中...' : '输入消息... (Ctrl+V 粘贴截图)'}
            disabled={isDisabled}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-zinc-100
                       placeholder-zinc-600 py-1.5 max-h-[200px]"
          />

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={isDisabled || (!text.trim() && images.length === 0)}
            className="shrink-0 p-2 rounded-lg bg-primary hover:bg-primary-hover
                       disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors cursor-pointer"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19V5m0 0l-7 7m7-7l7 7" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-2">
          Powered by Cursor CLI &middot; 支持粘贴截图 (最多{MAX_IMAGE_COUNT}张, ≤10MB)
        </p>
      </div>
    </div>
  );
}
