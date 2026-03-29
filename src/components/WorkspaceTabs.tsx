import type { WorkspaceKind } from "@/app-types";

interface WorkspaceTabsProps {
  activeWorkspace: WorkspaceKind;
  imageLabel: string;
  pdfLabel: string;
  getButtonClassName: (active: boolean) => string;
  onChange: (workspace: WorkspaceKind) => void;
}

const tabs = [{ id: "image" as const }, { id: "pdf" as const }];

export function WorkspaceTabs({
  activeWorkspace,
  imageLabel,
  pdfLabel,
  getButtonClassName,
  onChange,
}: WorkspaceTabsProps) {
  return (
    <div className="tabs-shell">
      <div className="tabs-strip">
        {tabs.map((tab) => {
          const isActive = tab.id === activeWorkspace;
          const label = tab.id === "image" ? imageLabel : pdfLabel;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={getButtonClassName(isActive)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
