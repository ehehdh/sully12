'use client';

import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsPage() {
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
            <FileText className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-bold">이용약관</h1>
          </div>
          <div className="w-24" />
        </div>

        <div className="space-y-6 bg-white/5 border border-white/10 rounded-3xl p-6">
          <section>
            <h2 className="font-bold mb-2">1. 목적</h2>
            <p className="text-sm text-muted-foreground">
              본 약관은 안토론 서비스 이용에 관한 기본적인 권리와 의무를 규정합니다.
            </p>
          </section>
          <section>
            <h2 className="font-bold mb-2">2. 계정 및 이용</h2>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>소셜 로그인으로 가입하며, 허위 정보 등록을 금지합니다.</li>
              <li>서비스 운영을 방해하는 행위는 제재될 수 있습니다.</li>
            </ul>
          </section>
          <section>
            <h2 className="font-bold mb-2">3. 콘텐츠 및 제재</h2>
            <p className="text-sm text-muted-foreground">
              신고된 콘텐츠는 내부 정책에 따라 검토되며, 필요 시 경고/정지/차단 조치가 적용됩니다.
            </p>
          </section>
          <section>
            <h2 className="font-bold mb-2">4. 기타</h2>
            <p className="text-sm text-muted-foreground">
              본 약관은 필요 시 업데이트될 수 있으며, 변경 시 고지합니다.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
