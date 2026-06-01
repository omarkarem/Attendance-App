import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  HiOutlineHome,
  HiOutlineCalendar,
  HiOutlineUserGroup,
  HiOutlineTableCells,
  HiOutlineArrowDownTray,
  HiOutlineArrowRightOnRectangle
} from 'react-icons/hi2';
import useAuth from '../hooks/useAuth';

const navItems = [
  { path: '/', icon: HiOutlineHome, label: 'Home' },
  { path: '/sessions', icon: HiOutlineCalendar, label: 'Sessions' },
  { path: '/athletes', icon: HiOutlineUserGroup, label: 'Athletes' },
  { path: '/attendance', icon: HiOutlineTableCells, label: 'Grid' },
  { path: '/export', icon: HiOutlineArrowDownTray, label: 'Export' },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-dark-800/80 backdrop-blur-xl border-r border-dark-600/50 flex-col z-40">
        {/* Logo */}
        <div className="p-6 border-b border-dark-600/50">
          <h1 className="text-xl font-bold gradient-text">AttendTrack</h1>
          <p className="text-dark-400 text-sm mt-1">Coach Dashboard</p>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-500/10 text-accent-400 shadow-glow'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-dark-600/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-400 to-neon-purple flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'Coach'}</p>
              <p className="text-xs text-dark-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-dark-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all duration-200"
          >
            <HiOutlineArrowRightOnRectangle className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-800/90 backdrop-blur-xl border-t border-dark-600/50 z-40 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1">
        <div className="flex items-center justify-around px-2 py-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                <item.icon className={`w-6 h-6 ${isActive ? 'drop-shadow-lg' : ''}`} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Mobile Top Bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-dark-800/90 backdrop-blur-xl border-b border-dark-600/50 z-40 px-4 pb-3 pt-[max(env(safe-area-inset-top),1rem)] flex items-center justify-between">
        <h1 className="text-lg font-bold gradient-text">AttendTrack</h1>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-400 to-neon-purple flex items-center justify-center text-white font-bold text-xs">
            {user?.name?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          <button
            onClick={logout}
            className="text-dark-400 hover:text-red-400 transition-colors"
          >
            <HiOutlineArrowRightOnRectangle className="w-5 h-5" />
          </button>
        </div>
      </header>
    </>
  );
};

export default Navbar;
