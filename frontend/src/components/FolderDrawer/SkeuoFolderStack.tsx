import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  TrendingUp,
  Cpu,
  Database,
  User,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import './SkeuoFolderStack.css';

interface SkeuoFolder {
  id: string;
  title: string;
  tabLabel: string;
  subtitle: string;
  category: string;
  route: string;
  icon: LucideIcon;
  tabColor: string;     // Signature accent color
  insertBg: string;     // Card pastel color from 3D render
  insertText: string;   // Text color on card
  isAllowed: boolean;
}

interface SkeuoFolderStackProps {
  currentWeek: number | string;
  user: {
    email?: string;
    role?: string;
    sub_role?: string;
    tracker_access?: string[];
  } | null;
}

export const SkeuoFolderStack: React.FC<SkeuoFolderStackProps> = ({ currentWeek, user }) => {
  const navigate = useNavigate();
  // By default, all folders are unhighlighted (0th state); scrolling or tab hover reveals one by one
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const isAdmin = user?.role === 'Admin';
  const hasWeeklyAccess = !user || user.tracker_access?.includes('Weekly') || isAdmin;
  const hasRevenueAccess = !user || user.tracker_access?.includes('Revenue') || isAdmin;
  const hasSymbAccess = !user || user.tracker_access?.includes('SYMB') || isAdmin;
  const hasAdminAccess = !user || isAdmin;

  // 5 Folders per row: 1-to-1 match with user diagram (media_1789399335391.png)
  const folders: SkeuoFolder[] = [
    {
      id: 'weekly',
      title: 'Weekly BD Tracker',
      tabLabel: 'WEEKLY',
      subtitle: `Opps & Revenue • Wk ${currentWeek || '36'}`,
      category: 'Sales',
      route: '/weekly',
      icon: Calendar,
      tabColor: '#2563eb',
      insertBg: '#f4e6ca', // Warm Manila / Cream from image 2
      insertText: '#422006',
      isAllowed: hasWeeklyAccess,
    },
    {
      id: 'revenue',
      title: 'Revenue Analytics',
      tabLabel: 'REVENUE',
      subtitle: 'Invoicing and Mfg progress',
      category: 'Manufacturing',
      route: '/revenue',
      icon: TrendingUp,
      tabColor: '#059669',
      insertBg: '#b5d3b3', // Soft Sage Green from image 2
      insertText: '#064e3b',
      isAllowed: hasRevenueAccess,
    },
    {
      id: 'symb',
      title: 'SYMB Smart Systems',
      tabLabel: 'SYMB',
      subtitle: 'Symb Production tracker',
      category: 'Manufacturing - Sales',
      route: '/symb',
      icon: Cpu,
      tabColor: '#d97706',
      insertBg: '#a7cde0', // Soft Sky Blue from image 2
      insertText: '#0c4a6e',
      isAllowed: hasSymbAccess,
    },
    {
      id: 'admin',
      title: 'Admin & Access Control',
      tabLabel: 'ADMIN',
      subtitle: 'CRM Uploads & Role Governance',
      category: 'admin',
      route: '/admin',
      icon: Database,
      tabColor: '#7c3aed',
      insertBg: '#e6a89c', // Soft Terracotta from image 2
      insertText: '#4c1d18',
      isAllowed: hasAdminAccess,
    },
    {
      id: 'profile',
      title: 'My Profile & Account',
      tabLabel: 'PROFILE',
      subtitle: user?.email ? `Logged in: ${user.email.split('@')[0]}` : 'Sign in to access features',
      category: '', // No pill needed for profile
      route: user ? '/profile' : '/login',
      icon: User,
      tabColor: '#0284c7',
      insertBg: '#d6cdf7', // Soft Lavender from image 2
      insertText: '#2e1065',
      isAllowed: true,
    },
  ];

  // Group into rows of 5 folders each
  const FOLDERS_PER_ROW = 5;
  const rows: SkeuoFolder[][] = [];
  for (let i = 0; i < folders.length; i += FOLDERS_PER_ROW) {
    rows.push(folders.slice(i, i + FOLDERS_PER_ROW));
  }

  const activeFolder = activeIndex !== null ? folders[activeIndex] : null;

  const handleFolderClick = (folder: SkeuoFolder) => {
    if (folder.isAllowed) {
      navigate(folder.route);
    }
  };

  const trackRef = useRef<HTMLDivElement | null>(null);

  // Apple-style pinned scroll engine: locks component in center while user scrolls through folders
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const track = trackRef.current;
          if (!track) {
            ticking = false;
            return;
          }

          const rect = track.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          // Target pinning offset when sticky locks in upper center (10vh from top)
          const pinOffset = windowHeight * 0.10;
          const scrollableDistance = track.clientHeight - windowHeight;

          if (scrollableDistance <= 0) {
            ticking = false;
            return;
          }

          // Progress from 0 (when track enters pin zone) to 1 (when track finishes)
          const scrolled = pinOffset - rect.top;
          const progress = Math.min(1, Math.max(0, scrolled / scrollableDistance));

          // 6 distinct progressive steps:
          // 0 to 0.08 -> null (0th resting state: un-highlighted)
          // 0.08 to 0.28 -> 0 (Weekly BD Tracker)
          // 0.28 to 0.48 -> 1 (Revenue Analytics)
          // 0.48 to 0.68 -> 2 (SYMB Smart Systems)
          // 0.68 to 0.86 -> 3 (Admin & Access Control)
          // 0.86 to 1.00 -> 4 (My Profile & Account)
          if (progress <= 0.08) {
            setActiveIndex(null);
          } else if (progress < 0.28) {
            setActiveIndex(0);
          } else if (progress < 0.48) {
            setActiveIndex(1);
          } else if (progress < 0.68) {
            setActiveIndex(2);
          } else if (progress < 0.86) {
            setActiveIndex(3);
          } else {
            setActiveIndex(4);
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initialize on mount
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [folders.length]);

  return (
    <div className="skeuo-apple-track" ref={trackRef}>
      <div className="skeuo-apple-sticky">
        <div className="skeuo-stage-container">
          {/* 3D Viewport with Horizontal Cascading Spread */}
          <div
            className="skeuo-viewport"
            onClick={(e) => {
              // Clicking empty background resets to 0th neutral resting state
              if (e.target === e.currentTarget) {
                setActiveIndex(null);
              }
            }}
          >
        {rows.map((rowFolders, rIdx) => (
          <div key={rIdx} className="skeuo-stack">
            {/* Ground Ambient Drop Shadow */}
            <div className="skeuo-ground-shadow" />

            {[...rowFolders].reverse().map((folder) => {
              // Original index in row for precise 3D positioning
              const indexInRow = rowFolders.indexOf(folder);
              const globalIndex = rIdx * FOLDERS_PER_ROW + indexInRow;
              const isActive = activeIndex !== null && activeIndex === globalIndex;

              // Horizontal Cascading Spread matching user diagram (media_1789399335391.png)
              const baseX = indexInRow * 165;
              const baseY = -indexInRow * 20;
              const baseZ = -indexInRow * 32;

              // When active: strictly vertical elevation (translateY -80px)
              const finalX = baseX;
              const finalY = isActive ? baseY - 80 : baseY;
              const finalZ = baseZ;

              // Active lifted folder sits on top (zIndex 100); resting folders follow clean cascade
              const zIndex = isActive ? 100 : 50 - indexInRow;

              const Icon = folder.icon;

              return (
                <div
                  key={folder.id}
                  className={`skeuo-folder-item ${isActive ? 'is-active' : ''}`}
                  style={{
                    transform: `translate3d(${finalX}px, ${finalY}px, ${finalZ}px)`,
                    zIndex,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(globalIndex);
                    handleFolderClick(folder);
                  }}
                  title={`Click to open ${folder.title}`}
                >
                  {/* Back Flap with Top Tab */}
                  <div className="skeuo-folder-back">
                    <div className="skeuo-folder-tab">
                      <div
                        className="skeuo-tab-dot"
                        style={{ backgroundColor: folder.tabColor }}
                      />
                      <Icon size={13} color="#3b2c6b" />
                      <span className="skeuo-tab-label">{folder.tabLabel}</span>
                    </div>
                  </div>

                  {/* The Pastel Colored Card Insert peeking out */}
                  <div
                    className="skeuo-card-insert"
                    style={{
                      backgroundColor: folder.insertBg,
                      color: folder.insertText,
                    }}
                  >
                    <div className="skeuo-card-top-row">
                      {folder.category ? (
                        <span className="skeuo-card-badge">
                          <Sparkles size={11} />
                          {folder.category}
                        </span>
                      ) : <span />}
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, opacity: 0.7 }}>
                        0{globalIndex + 1}
                      </span>
                    </div>

                    <h3 className="skeuo-card-title">{folder.title}</h3>
                    <p className="skeuo-card-sub">{folder.subtitle}</p>
                  </div>

                  {/* Front Flap (Lower Pocket) */}
                  <div className="skeuo-folder-front">
                    <div className="skeuo-front-brand">
                      <span className="skeuo-front-num">0{globalIndex + 1}</span>
                      <span className="skeuo-front-label">{folder.tabLabel}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Pill Switcher Buttons BELOW the 3D folders */}
      <div className="skeuo-tab-ribbon">
        {folders.map((f, i) => {
          const Icon = f.icon;
          const isSelected = activeIndex !== null && activeIndex === i;
          return (
            <button
              key={f.id}
              className={`ribbon-btn ${isSelected ? 'active' : ''}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => handleFolderClick(f)}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: f.tabColor,
                }}
              />
              <Icon size={14} />
              <span>{f.tabLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Floating Active Folder Focus Indicator (revealed on scroll or tab select) */}
      {activeFolder && (
        <div
          className="skeuo-active-pill"
          onClick={() => handleFolderClick(activeFolder)}
          style={{ cursor: 'pointer' }}
        >
          <span
            className="active-pill-dot"
            style={{ backgroundColor: activeFolder.tabColor }}
          />
          <span className="active-pill-name">{activeFolder.title}</span>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>•</span>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{activeFolder.subtitle}</span>
          <div className="active-pill-action">
            <span>Click to open</span>
            <ArrowRight size={14} />
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
