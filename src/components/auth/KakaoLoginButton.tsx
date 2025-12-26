'use client';

import { motion } from 'framer-motion';

interface KakaoLoginButtonProps {
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

export function KakaoLoginButton({ 
  onClick, 
  size = 'lg', 
  fullWidth = false,
  className = '' 
}: KakaoLoginButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // 기본 동작: 카카오 로그인 API로 이동
      window.location.href = '/api/auth/kakao';
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
        bg-[#FEE500] hover:bg-[#FDD835]
        text-[#181600] font-semibold
        rounded-xl
        transition-all duration-200
        shadow-lg hover:shadow-xl
        ${className}
      `}
    >
      {/* 카카오 로고 SVG */}
      <svg 
        width={size === 'sm' ? 18 : size === 'md' ? 20 : 24} 
        height={size === 'sm' ? 18 : size === 'md' ? 20 : 24} 
        viewBox="0 0 24 24" 
        fill="none"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 5.582 2 10.015c0 2.818 1.786 5.291 4.475 6.724l-1.136 4.138a.38.38 0 00.576.421l4.877-3.225c.394.037.795.056 1.208.056 5.523 0 10-3.582 10-8.015C22 5.582 17.523 2 12 2z"
          fill="#181600"
        />
      </svg>
      <span>카카오로 시작하기</span>
    </motion.button>
  );
}

// 심플 버전 (아이콘만)
export function KakaoLoginIconButton({ 
  onClick,
  className = '' 
}: { onClick?: () => void; className?: string }) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      window.location.href = '/api/auth/kakao';
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
        bg-[#FEE500] hover:bg-[#FDD835]
        rounded-full
        transition-all duration-200
        shadow-lg hover:shadow-xl
        ${className}
      `}
      title="카카오로 로그인"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 5.582 2 10.015c0 2.818 1.786 5.291 4.475 6.724l-1.136 4.138a.38.38 0 00.576.421l4.877-3.225c.394.037.795.056 1.208.056 5.523 0 10-3.582 10-8.015C22 5.582 17.523 2 12 2z"
          fill="#181600"
        />
      </svg>
    </motion.button>
  );
}
