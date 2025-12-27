'use client';

import { motion } from 'framer-motion';

interface GoogleLoginButtonProps {
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

export function GoogleLoginButton({ 
  onClick, 
  size = 'lg', 
  fullWidth = false,
  className = '' 
}: GoogleLoginButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // 기본 동작: 구글 로그인 API로 이동
      window.location.href = '/api/auth/google';
    }
  };

  const sizeStyles = {
    sm: 'h-10 px-4 text-sm',
    md: 'h-12 px-6 text-base',
    lg: 'h-14 px-8 text-lg',
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        flex items-center justify-center gap-3
        bg-white hover:bg-gray-50
        text-gray-700 font-semibold
        rounded-xl
        transition-all duration-200
        shadow-lg hover:shadow-xl
        border border-gray-200
        ${className}
      `}
    >
      {/* 구글 로고 SVG */}
      <svg 
        width={size === 'sm' ? 18 : size === 'md' ? 20 : 24} 
        height={size === 'sm' ? 18 : size === 'md' ? 20 : 24} 
        viewBox="0 0 24 24"
      >
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      <span>Google로 시작하기</span>
    </motion.button>
  );
}

// 아이콘만 버전
export function GoogleLoginIconButton({ 
  onClick,
  className = '' 
}: { onClick?: () => void; className?: string }) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      window.location.href = '/api/auth/google';
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        w-12 h-12
        flex items-center justify-center
        bg-white hover:bg-gray-50
        rounded-full
        transition-all duration-200
        shadow-lg hover:shadow-xl
        border border-gray-200
        ${className}
      `}
      title="Google로 로그인"
    >
      <svg width="24" height="24" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    </motion.button>
  );
}
