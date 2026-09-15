import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Calendar,
  TrendingUp,
  Cpu,
  Database,
  Users,
  User,
} from 'lucide-react';
import { FolderItem, type FolderData } from './FolderItem';
import './FolderDrawer.css';

interface FolderDrawerProps {
  currentWeek: number | string;
  user: {
    email?: string;
    role?: string;
    sub_role?: string;
    tracker_access?: string[];
  } | null;
}

export const FolderDrawer: React.FC<FolderDrawerProps> = ({ currentWeek, user }) => {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);

  const isAdmin = user?.role === 'Admin';
  const hasWeeklyAccess = !user || user.tracker_access?.includes('Weekly') || isAdmin;
  const hasRevenueAccess = !user || user.tracker_access?.includes('Revenue') || isAdmin;
  const hasSymbAccess = !user || user.tracker_access?.includes('SYMB') || isAdmin;
  const hasAdminAccess = !user || isAdmin;
  const hasAccessManagement = !user || isAdmin;

  // Build the rich folder metadata preserving the established system color palette
  const folders: FolderData[] = [
    {
      id: 'weekly',
      title: 'Weekly BD Tracker',
      tabLabel: 'WEEKLY TRACKER',
      subtitle: 'Executive revenue projections, Closed Won deals, pipeline health, and quarterly stretch milestones.',
      category: 'Commercial Operations',
      tag: `Week ${currentWeek || 'Active'}`,
      // Signature Blue palette
      color: '#2563eb',
      tabBg: '#dbeafe',
      tabBorder: '#93c5fd',
      tabText: '#1e40af',
      slotIndex: 0,
      icon: Calendar,
      route: '/weekly',
      isAllowed: hasWeeklyAccess,
      statusBadge: 'Active Pipeline',
      metrics: [
        { label: 'Current Week', value: `Wk ${currentWeek || '--'}`, sub: 'Active Review' },
        { label: 'Projection Category', value: 'Closed Won', sub: 'Weighted POs' },
        { label: 'Slides', value: '10 Decks', sub: 'Executive Views' },
      ],
      shortcuts: [
        { label: 'Slide 2 KPIs', action: () => navigate('/weekly') },
        { label: 'AI Intelligence', action: () => navigate('/weekly') },
      ],
    },
    {
      id: 'revenue',
      title: 'Revenue Analytics',
      tabLabel: 'REVENUE',
      subtitle: 'Invoicing performance, historical billings, run-rate tracking, and fiscal year financial reconciliation.',
      category: 'Financial Planning',
      tag: 'FY2027 Projections',
      // Signature Emerald Green palette
      color: '#059669',
      tabBg: '#d1fae5',
      tabBorder: '#6ee7b7',
      tabText: '#065f46',
      slotIndex: 1,
      icon: TrendingUp,
      route: '/revenue',
      isAllowed: hasRevenueAccess,
      statusBadge: 'Synced',
      metrics: [
        { label: 'Fiscal Year', value: 'FY2027', sub: 'Active Target' },
        { label: 'Invoiced Base', value: '$20.26M', sub: 'Verified Total' },
        { label: 'Target Model', value: '$73.00M', sub: 'Stretch Target' },
      ],
      shortcuts: [
        { label: 'Invoiced Breakdown', action: () => navigate('/revenue') },
      ],
    },
    {
      id: 'symb',
      title: 'SYMB Smart Systems',
      tabLabel: 'SYMB TRACKER',
      subtitle: 'Custom module pipelines, customer engineering milestones, hardware deliverables, and design-in status.',
      category: 'Engineering & Delivery',
      tag: 'Modules & Hardware',
      // Signature Amber / Gold palette
      color: '#d97706',
      tabBg: '#fef3c7',
      tabBorder: '#fcd34d',
      tabText: '#92400e',
      slotIndex: 2,
      icon: Cpu,
      route: '/symb',
      isAllowed: hasSymbAccess,
      statusBadge: 'Hardware Stage',
      metrics: [
        { label: 'Module Lines', value: 'SYMB Platform', sub: 'Design-in Wins' },
        { label: 'Pipeline View', value: 'Real-time', sub: 'Delivery Matrix' },
        { label: 'Milestones', value: 'Active', sub: 'QP2 Stage' },
      ],
      shortcuts: [
        { label: 'Pipeline View', action: () => navigate('/symb') },
      ],
    },
    {
      id: 'admin',
      title: 'Data Ingestion & Master Upload',
      tabLabel: 'ADMIN DATA',
      subtitle: 'CRM dataset ingestion, weekly Excel uploads, backlog synchronization, and financial target configurations.',
      category: 'Data Engineering',
      tag: 'Master Records',
      // Signature Royal Violet palette
      color: '#7c3aed',
      tabBg: '#ede9fe',
      tabBorder: '#c4b5fd',
      tabText: '#5b21b6',
      slotIndex: 3,
      icon: Database,
      route: '/admin',
      isAllowed: hasAdminAccess,
      statusBadge: isAdmin ? 'Admin Cleared' : 'Restricted',
      metrics: [
        { label: 'Data Feeds', value: 'CRM & ERP', sub: 'Weekly Automation' },
        { label: 'Sync Status', value: 'Ready', sub: 'Latest Week 36' },
        { label: 'Audit Logs', value: 'Protected', sub: 'Admin Only' },
      ],
      shortcuts: [
        { label: 'Upload CRM Excel', action: () => navigate('/admin') },
        { label: 'Target Settings', action: () => navigate('/admin') },
      ],
    },
    {
      id: 'access',
      title: 'Access Management & Security',
      tabLabel: 'PERMISSIONS',
      subtitle: 'Role-based access controls, granular tracker authorizations, user provisioning, and organizational governance.',
      category: 'Security & Auth',
      tag: 'RBAC Directory',
      // Signature Coral Rose palette
      color: '#e11d48',
      tabBg: '#ffe4e6',
      tabBorder: '#fda4af',
      tabText: '#9f1239',
      slotIndex: 4,
      icon: Users,
      route: '/access-management',
      isAllowed: hasAccessManagement,
      statusBadge: isAdmin ? 'Governance' : 'Admin Required',
      metrics: [
        { label: 'Security Model', value: 'JWT RBAC', sub: 'Role Enforced' },
        { label: 'Tracker Scopes', value: 'Per-User', sub: 'Weekly / SYMB' },
        { label: 'Active Session', value: user?.email ? 'Authenticated' : 'Guest', sub: 'Token Validated' },
      ],
      shortcuts: [
        { label: 'User Directory', action: () => navigate('/access-management') },
      ],
    },
    {
      id: 'profile',
      title: 'User Profile & Preferences',
      tabLabel: 'MY ACCOUNT',
      subtitle: 'Current authentication credentials, assigned tracker scopes, active organization role, and account settings.',
      category: 'Personal Portal',
      tag: user?.role || 'Guest Mode',
      // Signature Ocean Slate / Teal palette
      color: '#0284c7',
      tabBg: '#e0f2fe',
      tabBorder: '#7dd3fc',
      tabText: '#0369a1',
      slotIndex: 5,
      icon: User,
      route: user ? '/profile' : '/login',
      isAllowed: true, // Anyone can open profile or login
      statusBadge: user ? 'Logged In' : 'Sign In Required',
      metrics: [
        { label: 'Account Email', value: user?.email ? user.email.split('@')[0] : 'Guest User', sub: user?.email || 'Not authenticated' },
        { label: 'Assigned Role', value: user?.role || 'Guest', sub: user?.sub_role || 'Standard' },
        { label: 'Trackers Allowed', value: `${user?.tracker_access?.length || (isAdmin ? 'All' : 0)} Modules`, sub: 'Access Granted' },
      ],
      shortcuts: [
        { label: user ? 'Account Settings' : 'Go to Login', action: () => navigate(user ? '/profile' : '/login') },
      ],
    },
  ];

  const totalFolders = folders.length;
  const currentFolder = folders[activeIndex];

  // Navigate to adjacent folders
  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => Math.min(prev + 1, totalFolders - 1));
  }, [totalFolders]);

  const handleLaunch = useCallback((route: string) => {
    navigate(route);
  }, [navigate]);

  // Mouse wheel scroll handler with smooth debounced stepping
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      // Avoid accidental horizontal leafing or micro-movements
      if (Math.abs(e.deltaY) < 16) return;

      e.preventDefault();

      if (isScrollingRef.current) return;
      isScrollingRef.current = true;

      if (e.deltaY > 0) {
        // Scrolling down -> flip forward / move to next folder
        setActiveIndex((prev) => Math.min(prev + 1, totalFolders - 1));
      } else {
        // Scrolling up -> pull back to previous folder
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      }

      setTimeout(() => {
        isScrollingRef.current = false;
      }, 260); // 260ms cooldown gives crisp physical folder leafing feel
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
    };
  }, [totalFolders]);

  // Touch gesture handler (mobile swipe)
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartYRef.current === null) return;
      const deltaY = touchStartYRef.current - e.changedTouches[0].clientY;
      if (Math.abs(deltaY) > 30) {
        if (deltaY > 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
      touchStartYRef.current = null;
    };

    viewport.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewport.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleNext, handlePrev]);

  // Keyboard navigation (Arrow keys & Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentFolder.isAllowed) {
          handleLaunch(currentFolder.route);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIndex(totalFolders - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNext, handlePrev, handleLaunch, currentFolder, totalFolders]);

  return (
    <div className="cabinet-wrapper">
      {/* Cabinet Frame Info & Status Header */}
      <div className="cabinet-status-bar">
        <div className="cabinet-counter">
          <span className="counter-badge">
            FOLDER {String(activeIndex + 1).padStart(2, '0')} / {String(totalFolders).padStart(2, '0')}
          </span>
          <span className="cabinet-title-label">
            <FolderOpen size={18} color={currentFolder.color} />
            {currentFolder.title}
          </span>
        </div>

        <div className="cabinet-keyboard-hint">
          <span className="key-badge">↑ / ↓ Scroll</span>
          <span>Leaf folders</span>
          <span className="key-badge">Click Tab</span>
          <span>Jump</span>
          <span className="key-badge">↵ Enter</span>
          <span>Open</span>
        </div>
      </div>

      {/* 3D Drawer Viewport */}
      <div className="drawer-viewport" ref={viewportRef}>
        {/* Physical Mechanical Side Rails */}
        <div className="drawer-rail-left" />
        <div className="drawer-rail-right" />

        {/* 3D Stage of Staggered Folders */}
        <div className="folders-stage">
          {folders.map((folder, idx) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              index={idx}
              activeIndex={activeIndex}
              totalFolders={totalFolders}
              onSelect={(i) => setActiveIndex(i)}
              onLaunch={handleLaunch}
            />
          ))}
        </div>

        {/* Drawer Cabinet Front Face Lip */}
        <div className="drawer-front-lip">
          <div className="drawer-handle" />
        </div>
      </div>

      {/* Navigation Controls & Dot Trackers */}
      <div className="drawer-nav-controls">
        <button
          className="drawer-stepper-btn"
          onClick={handlePrev}
          disabled={activeIndex === 0}
          title="Leaf to previous folder (Arrow Up / Left)"
        >
          <ChevronLeft size={18} />
          <span>Previous Folder</span>
        </button>

        {/* Dot depth indicators */}
        <div className="drawer-dots-container">
          {folders.map((f, idx) => (
            <div
              key={f.id}
              className={`drawer-dot ${idx === activeIndex ? 'active' : ''}`}
              onClick={() => setActiveIndex(idx)}
              style={idx === activeIndex ? { backgroundColor: f.color } : {}}
              title={`Jump to: ${f.tabLabel}`}
            />
          ))}
        </div>

        <button
          className="drawer-stepper-btn"
          onClick={handleNext}
          disabled={activeIndex === totalFolders - 1}
          title="Leaf to next folder (Arrow Down / Right)"
        >
          <span>Next Folder</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};
