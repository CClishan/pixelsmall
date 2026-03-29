import { useRef, useState } from "react";
import { Plus } from "lucide-react";

interface FileDropzoneProps {
  title: string;
  subtitle: string;
  accept: string;
  hint: string;
  compact?: boolean;
  onFiles: (files: FileList) => void;
}

export function FileDropzone({ title, subtitle, accept, hint, compact = false, onFiles }: FileDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    onFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <section
      aria-label={title}
      onClick={() => fileInputRef.current?.click()}
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={`dropzone-surface group ${compact ? "dropzone-surface--compact" : ""} ${isDragging ? "dropzone-surface--active" : ""}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept={accept}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <div className="dropzone-grid" />
      <div className={`dropzone-content ${compact ? "dropzone-content--compact" : ""}`}>
        <div className="dropzone-orb">
          <Plus className="h-4 w-4" />
        </div>
        <p className="dropzone-title">{title}</p>
        {!compact ? <p className="dropzone-copy">{subtitle}</p> : null}
        <p className={`dropzone-hint ${compact ? "dropzone-hint--compact" : ""}`}>{hint}</p>
      </div>
    </section>
  );
}
