import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Lock, Sparkles, CheckCircle2 } from 'lucide-react';

export interface FolderMetric {
  label: string;
  value: string;
  sub?: string;
}

export interface FolderShortcut {
  label: string;
  action: () => void;
}

export interface FolderData {
  id: string;
  title: string;
  tabLabel: string;
  subtitle: string;
  category: string;
  tag: string;
  color: string;      // Main brand / accent color
  tabBg: string;      // Pastel background for tab label (from reference image)
  tabBorder: string;  // Tab border color
  tabText: string;    // Tab text color
  slotIndex: number;  // 0 to 5 for staggered tab positions
  icon: LucideIcon;
  route: string;
  isAllowed: boolean;
  statusBadge?: string;
  metrics: FolderMetric[];
  shortcuts?: FolderShortcut[];
}

interface FolderItemProps {
  folder: FolderData;
  index: number;
  activeIndex: number;
  totalFolders: number;
  onSelect: (index: number) => void;
  onLaunch: (route: string) => void;
}

export const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  index,
  activeIndex,
  onSelect,
  onLaunch,
}) => {
  const diff = index - activeIndex;
  const isActive = diff === 0;
  const isPast = diff < 0;

  // Calculate 3D transformation matrices based on state
  let transform = '';
  let opacity = 1;
  let zIndex = 30;
  let stateClass = 'state-future';

  if (isActive) {
    stateClass = 'state-active';
    transform = 'translateY(-24px) translateZ(40px) rotateX(0deg) scale(1.01)';
    opacity = 1;
    zIndex = 65;
  } else if (isPast) {
    stateClass = 'state-past';
    const absDiff = Math.abs(diff);
    const rotX = -50 - Math.min(absDiff * 4, 15);
    const transY = 135 + absDiff * 14;
    const transZ = 30 + absDiff * 15;
    const s = Math.max(0.96 - absDiff * 0.03, 0.85);
    transform = `translateY(${transY}px) translateZ(${transZ}px) rotateX(${rotX}deg) scale(${s})`;
    opacity = Math.max(0.4 - (absDiff - 1) * 0.1, 0.2);
    zIndex = 20 + index;
  } else {
    // isFuture
    stateClass = 'state-future';
    const rotX = Math.min(diff * 2.5, 12);
    const transY = diff * 22;
    const transZ = -diff * 38;
    const s = Math.max(1 - diff * 0.02, 0.88);
    transform = `translateY(${transY}px) translateZ(${transZ}px) rotateX(${rotX}deg) scale(${s})`;
    opacity = Math.max(1 - diff * 0.12, 0.45);
    zIndex = 55 - diff;
  }

  const handleTabClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(index);
  };

  const handleLaunchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (folder.isAllowed) {
      onLaunch(folder.route);
    }
  };

  const Icon = folder.icon;

  return (
    <div
      className={`folder-unit ${stateClass}`}
      style={{
        transform,
        opacity,
        zIndex,
      }}
    >
      {/* Hanging Rod & Hanger Hooks (Physical cabinet hanger clips) */}
      <div className="hanger-rod">
        <div className="hanger-hook-left" />
        <div className="hanger-hook-right" />
      </div>

      {/* Staggered Folder Tab */}
      <div
        className={`folder-tab-container tab-slot-${folder.slotIndex % 6}`}
        onClick={handleTabClick}
        style={{
          backgroundColor: folder.tabBg,
          borderColor: folder.tabBorder,
          color: folder.tabText,
        }}
        title={`Click to pull forward: ${folder.title}`}
      >
        <div className="tab-notch" style={{ backgroundColor: folder.color }} />
        <div className="tab-icon" style={{ color: folder.color }}>
          <Icon size={14} strokeWidth={2.5} />
        </div>
        <span className="tab-label-text">{folder.tabLabel}</span>
      </div>

      {/* Folder Jacket Body (Manila Cardstock) */}
      <div className="folder-jacket">
        {/* Authentic perforated slot cutouts along top edge */}
        <div className="folder-slots-rim">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="slot-cutout" />
          ))}
        </div>

        {/* Inside Document Sheet */}
        <div className="folder-document-container">
          {/* Top accent bar matching signature module color */}
          <div
            className="document-accent-bar"
            style={{ backgroundColor: folder.color }}
          />

          {/* Document Header */}
          <div className="doc-header">
            <div className="doc-title-group">
              <div className="doc-badge-row">
                <span className="doc-category-tag">{folder.category}</span>
                <span
                  className="doc-status-badge"
                  style={{
                    backgroundColor: folder.tabBg,
                    color: folder.color,
                    border: `1px solid ${folder.tabBorder}`,
                  }}
                >
                  {folder.isAllowed ? (
                    <>
                      <CheckCircle2 size={12} strokeWidth={2.5} />
                      {folder.statusBadge || 'Authorized'}
                    </>
                  ) : (
                    <>
                      <Lock size={12} strokeWidth={2.5} />
                      Restricted Access
                    </>
                  )}
                </span>
                <span className="doc-status-badge" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                  {folder.tag}
                </span>
              </div>
              <h2 className="doc-title">{folder.title}</h2>
              <p className="doc-subtitle">{folder.subtitle}</p>
            </div>

            <div className="doc-action-stamp">
              <Sparkles size={14} color={folder.color} />
              <span>OFFICIAL FOLDER</span>
            </div>
          </div>

          {/* Document Metrics / Key Highlights Grid */}
          <div className="doc-metrics-grid">
            {folder.metrics.map((metric, mIdx) => (
              <div key={mIdx} className="metric-cell">
                <span className="metric-label">{metric.label}</span>
                <span className="metric-value" style={mIdx === 0 ? { color: folder.color } : {}}>
                  {metric.value}
                </span>
                {metric.sub && <span className="metric-sub">{metric.sub}</span>}
              </div>
            ))}
          </div>

          {/* Document Footer with Launch Button & Quick Shortcuts */}
          <div className="doc-footer">
            <div className="doc-shortcuts-list">
              {folder.shortcuts && folder.shortcuts.length > 0 && (
                <>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                    Quick Actions:
                  </span>
                  {folder.shortcuts.map((sc, sIdx) => (
                    <button
                      key={sIdx}
                      className="shortcut-tag"
                      onClick={(e) => {
                        e.stopPropagation();
                        sc.action();
                      }}
                    >
                      {sc.label}
                    </button>
                  ))}
                </>
              )}
            </div>

            <button
              className={`launch-folder-btn ${!folder.isAllowed ? 'restricted' : ''}`}
              onClick={handleLaunchClick}
              disabled={!folder.isAllowed}
              style={folder.isAllowed ? { backgroundColor: folder.color } : {}}
            >
              {folder.isAllowed ? (
                <>
                  <span>Open {folder.tabLabel}</span>
                  <ArrowRight size={18} />
                </>
              ) : (
                <>
                  <Lock size={16} />
                  <span>Access Restricted</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
