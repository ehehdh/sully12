'use client';

import { useAuth, User } from '@/lib/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
import Image from 'next/image';

interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

function UserMenu({ user, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pr-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
      >
        {user.profileImage ? (
          <Image
            src={user.profileImage}
            alt={user.nickname}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-white" />
          </div>
        )}
        <span className="text-sm font-medium text-white">{user.nickname}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 mt-2 w-48 bg-[#1a1a1f] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
            >
              <div className="p-3 border-b border-white/10">
                <p className="text-sm font-medium text-white">{user.nickname}</p>
                {user.email && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </div>
              
              <a
                href="/mypage"
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <UserIcon className="w-4 h-4" />
                마이페이지
              </a>
              
              <button
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function UserAuthButton() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <motion.a
        href="/login"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-full text-sm transition-all shadow-lg"
      >
        로그인
      </motion.a>
    );
  }

  return <UserMenu user={user} onLogout={logout} />;
}
