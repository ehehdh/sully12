'use client';

import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              홈으로
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-bold">개인정보처리방침</h1>
          </div>
          <div className="w-24" />
        </div>

        <div className="space-y-6 bg-white/5 border border-white/10 rounded-3xl p-6">
          <section>
            <h2 className="font-bold mb-2">1. 수집 항목</h2>
            <p className="text-sm text-muted-foreground">
              소셜 로그인 정보(이메일, 프로필)와 서비스 이용 기록을 수집합니다.
            </p>
          </section>
          <section>
            <h2 className="font-bold mb-2">2. 이용 목적</h2>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>서비스 제공 및 사용자 식별</li>
              <li>부정 이용 방지 및 보안 관리</li>
              <li>이용 통계 분석</li>
            </ul>
          </section>
          <section>
            <h2 className="font-bold mb-2">3. 보관 및 파기</h2>
            <p className="text-sm text-muted-foreground">
              회원 탈퇴 시 개인정보는 즉시 비활성화 처리되며, 정책에 따라 일정 기간 후 파기됩니다.
            </p>
          </section>
          <section>
            <h2 className="font-bold mb-2">4. 문의</h2>
            <p className="text-sm text-muted-foreground">
              개인정보 관련 문의는 관리자 페이지 또는 공지 채널을 통해 접수됩니다.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
