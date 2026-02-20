
import React from 'react';

interface HeaderProps {
  onOpenHistory: () => void;
  historyCount: number;
}

const Header: React.FC<HeaderProps> = ({ onOpenHistory, historyCount }) => {
  return (
    <header className="glass-panel sticky top-0 z-40 no-print shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="bg-gradient-to-tr from-choc-red to-choc-yellow p-2.5 rounded-2xl shadow-lg transform group-hover:rotate-12 transition-transform duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-choc-blue rounded-full border-2 border-slate-900 shadow-sm"></div>
          </div>
          
          <div className="flex flex-col">
            <h1 className="text-2xl font-extrabold tracking-tighter leading-none flex items-center gap-1">
              <span className="text-choc-green">C</span>
              <span className="text-choc-blue">H</span>
              <span className="text-choc-red">O</span>
              <span className="text-choc-pink">C</span>
              <span className="ml-1 text-white">LAR</span>
            </h1>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-0.5">Sistema de Precificação</span>
          </div>
        </div>
        
        <button 
          onClick={onOpenHistory}
          className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 shadow-lg hover:border-choc-blue hover:bg-slate-700 transition-all active:scale-95 group overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-choc-blue opacity-0 group-hover:opacity-10 transition-opacity"></div>
          <div className="relative flex items-center gap-2">
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 group-hover:text-choc-blue transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {historyCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-choc-pink opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-choc-pink text-[9px] text-white font-bold items-center justify-center">
                    {historyCount}
                  </span>
                </span>
              )}
            </div>
            <span className="hidden sm:block text-sm font-bold text-slate-300 group-hover:text-white">Histórico</span>
          </div>
        </button>
      </div>
    </header>
  );
};

export default Header;
