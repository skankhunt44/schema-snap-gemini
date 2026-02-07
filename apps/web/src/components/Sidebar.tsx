import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Database, FileText, Wand2, Share2, BarChart3, Settings as SettingsIcon, Menu, X } from 'lucide-react';

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/connect', icon: <Database size={20} />, label: 'Data Sources' },
    { to: '/templates', icon: <FileText size={20} />, label: 'Templates' },
    { to: '/map', icon: <Wand2 size={20} />, label: 'Smart Mapper' },
    { to: '/relationships', icon: <Share2 size={20} />, label: 'Relationships' },
    { to: '/analytics', icon: <BarChart3 size={20} />, label: 'Analytics' }
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      <button
        onClick={toggleSidebar}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 transition-colors"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-40 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shadow-xl transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="p-6 flex items-center gap-3 text-white">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <span className="text-lg font-bold">S</span>
          </div>
          <span className="text-xl font-bold tracking-tight">SchemaSnap</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Main Menu</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                    : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
          <div className="my-4 border-t border-slate-700/50 mx-4"></div>
          <NavLink
            to="/settings"
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                  : 'hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <SettingsIcon size={20} />
            <span className="font-medium">Settings</span>
          </NavLink>
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="mt-4 px-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs">
                BL
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white truncate max-w-[100px]">Bacus</span>
                <span className="text-xs text-slate-500">Local Demo</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
