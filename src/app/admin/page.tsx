"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  Shield, 
  ArrowLeft,
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  LogOut
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Issue } from "@/lib/database.types";

export default function AdminPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 관리자 로그아웃
  const handleAdminLogout = async () => {
    if (!confirm('관리자 세션을 종료하시겠습니까?')) return;
    
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  // 새 이슈 폼
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDetailedDescription, setNewDetailedDescription] = useState("");
  const [newCategory, setNewCategory] = useState("일반");
  
  // AI 제안
  const [aiSuggestions, setAiSuggestions] = useState<{label: string; description: string; detailed_description?: string; category?: string}[]>([]);
  const [aiKeyword, setAiKeyword] = useState(""); // AI 키워드 검색
  const [newsSources, setNewsSources] = useState<{title: string; link: string}[]>([]); // 뉴스 소스

  // 이슈 목록 로드
  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch("/api/issues?all=true");
      const data = await res.json();
      setIssues(data);
    } catch (error) {
      console.error("Failed to fetch issues:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // 이슈 추가
  const handleAddIssue = async () => {
    if (!newTitle.trim() || !newDescription.trim()) return;
    
    setIsAdding(true);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          detailed_description: newDetailedDescription || newDescription, // Fallback to short description
          category: newCategory,
        }),
      });
      
      if (res.ok) {
        setNewTitle("");
        setNewDescription("");
        setNewDetailedDescription("");
        setNewCategory("일반");
        fetchIssues();
      }
    } catch (error) {
      console.error("Failed to add issue:", error);
    } finally {
      setIsAdding(false);
    }
  };

  // 이슈 삭제
  const handleDeleteIssue = async (issueId: string) => {
    if (!confirm("정말 이 이슈를 삭제하시겠습니까?")) return;
    
    try {
      const res = await fetch(`/api/issues?id=${issueId}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        fetchIssues();
      }
    } catch (error) {
      console.error("Failed to delete issue:", error);
    }
  };

  // 이슈 토글
  const handleToggleIssue = async (issueId: string) => {
    try {
      const res = await fetch("/api/issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: issueId }),
      });
      
      if (res.ok) {
        fetchIssues();
      }
    } catch (error) {
      console.error("Failed to toggle issue:", error);
    }
  };

  // AI로 이슈 제안 받기 (키워드 기반)
  const handleGenerateSuggestions = async (keyword?: string) => {
    setIsGenerating(true);
    setAiSuggestions([]);
    setNewsSources([]);
    
    try {
      // 키워드가 있으면 추가
      const params = new URLSearchParams({
        seed: Date.now().toString(),
        count: "6"
      });
      if (keyword?.trim()) {
        params.set("keyword", keyword.trim());
      }
      
      const res = await fetch(`/api/topics?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      
      // 새로운 API 응답 형식 (topics + sources)
      if (data.topics && Array.isArray(data.topics)) {
        const suggestions = data.topics.map((t: any) => ({
          label: t.label || t.title || t,
          description: t.description || "",
          detailed_description: t.detailed_description || t.description || "",
          category: t.category || "일반"
        }));
        setAiSuggestions(suggestions);
        
        // 뉴스 소스 저장
        if (data.sources && Array.isArray(data.sources)) {
          setNewsSources(data.sources);
        }
      } else if (Array.isArray(data)) {
        // 기존 API 형식 (배열 직접 반환)
        const suggestions = data.map((t: any) => ({
          label: t.label || t.title || t,
          description: t.description || "",
          detailed_description: t.detailed_description || t.description || "",
          category: t.category || "일반"
        }));
        setAiSuggestions(suggestions);
      }
    } catch (error) {
      console.error("Failed to generate suggestions:", error);
      alert("AI 제안을 불러오는데 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  // AI 제안 선택
  const handleSelectSuggestion = (suggestion: {label: string; description: string; detailed_description?: string; category?: string}) => {
    setNewTitle(suggestion.label);
    setNewDescription(suggestion.description || `${suggestion.label}에 대해 찬성과 반대 입장에서 토론합니다.`);
    setNewDetailedDescription(suggestion.detailed_description || suggestion.description || "");
    if (suggestion.category) {
      setNewCategory(suggestion.category);
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500" />
      
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <header className="flex items-center justify-between mb-8 mt-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> 메인으로
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-500" />
            <h1 className="text-2xl font-bold">관리자 페이지</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchIssues}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleAdminLogout}
              className="text-red-400 hover:text-red-300"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* 퀵 링크 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
          <Link href="/admin/debates" className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl hover:bg-yellow-500/20 transition-colors">
            <div className="text-2xl mb-2">🏆</div>
            <h3 className="font-bold">토론 기록</h3>
            <p className="text-xs text-muted-foreground">완료된 토론 관리</p>
          </Link>
          <Link href="/admin/rooms" className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors">
            <div className="text-2xl mb-2">🚪</div>
            <h3 className="font-bold">토론방 관리</h3>
            <p className="text-xs text-muted-foreground">진행중 방 종료/삭제</p>
          </Link>
          <Link href="/admin/users" className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl hover:bg-green-500/20 transition-colors">
            <div className="text-2xl mb-2">👥</div>
            <h3 className="font-bold">사용자 관리</h3>
            <p className="text-xs text-muted-foreground">회원 정보 및 제재</p>
          </Link>
          <Link href="/admin/reports" className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors">
            <div className="text-2xl mb-2">🚨</div>
            <h3 className="font-bold">신고 관리</h3>
            <p className="text-xs text-muted-foreground">유저 신고 처리</p>
          </Link>
          <Link href="/admin/logs" className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl hover:bg-indigo-500/20 transition-colors">
            <div className="text-2xl mb-2">??</div>
            <h3 className="font-bold">활동 로그</h3>
            <p className="text-xs text-muted-foreground">관리자 활동 추적</p>
          </Link>
          <Link href="/admin" className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-colors">
            <div className="text-2xl mb-2">📋</div>
            <h3 className="font-bold">이슈 관리</h3>
            <p className="text-xs text-muted-foreground">토론 주제 관리</p>
          </Link>
          <Link href="/" className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl hover:bg-purple-500/20 transition-colors">
            <div className="text-2xl mb-2">🏠</div>
            <h3 className="font-bold">메인 페이지</h3>
            <p className="text-xs text-muted-foreground">사용자 화면 확인</p>
          </Link>
        </div>

        {/* 새 이슈 추가 섹션 */}
        <section className="mb-8 p-6 bg-card/50 backdrop-blur-md rounded-xl border border-white/10">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-500" />
            새 이슈 추가
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">제목</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="예: 기본소득제 도입"
                className="bg-secondary/50"
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">요약 설명 (짧게)</label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="토론 주제에 대한 간단한 설명"
                className="bg-secondary/50"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">상세 설명 (마우스 오버 시 표시)</label>
              <Textarea
                value={newDetailedDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewDetailedDescription(e.target.value)}
                placeholder="이슈에 대한 자세한 배경이나 논점을 설명해주세요."
                className="bg-secondary/50 min-h-[100px]"
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">카테고리</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full p-2 rounded-md bg-secondary/50 border border-white/10"
              >
                <option value="경제">경제</option>
                <option value="정치">정치</option>
                <option value="사회">사회</option>
                <option value="법률">법률</option>
                <option value="노동">노동</option>
                <option value="환경">환경</option>
                <option value="기술">기술</option>
                <option value="일반">일반</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleAddIssue} 
                disabled={isAdding || !newTitle.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                이슈 추가
              </Button>
            </div>
          </div>
          
          {/* AI 키워드 검색 섹션 */}
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-xl border border-purple-500/30">
            <h3 className="text-sm font-bold text-purple-300 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI 주제 추천
            </h3>
            
            {/* 키워드 입력 */}
            <div className="flex gap-2 mb-3">
              <Input
                value={aiKeyword}
                onChange={(e) => setAiKeyword(e.target.value)}
                placeholder="키워드 입력 (예: AI, 부동산, 교육...)"
                className="bg-black/30 border-purple-500/30 placeholder:text-purple-300/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleGenerateSuggestions(aiKeyword);
                  }
                }}
              />
              <Button 
                variant="outline" 
                onClick={() => handleGenerateSuggestions(aiKeyword)}
                disabled={isGenerating}
                className="border-purple-500/50 hover:bg-purple-500/20 text-purple-200 min-w-[120px]"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {aiKeyword.trim() ? '검색' : '랜덤 추천'}
                  </>
                )}
              </Button>
            </div>
            
            <p className="text-xs text-purple-400/70 mb-3">
              키워드를 입력하면 관련 토론 주제를, 비워두면 랜덤 주제를 추천합니다.
            </p>
          </div>
          
          {/* AI 제안 목록 */}
          {aiSuggestions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-purple-400 mb-2">
                {aiKeyword ? `"🔍 ${aiKeyword}" 관련 주제` : '🎲 랜덤 추천 주제'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {aiSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="p-3 text-sm bg-black/30 hover:bg-purple-500/20 text-left rounded-lg transition-colors border border-purple-500/20 hover:border-purple-500/40"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-500/30 text-purple-300">
                        {suggestion.category}
                      </span>
                    </div>
                    <div className="font-medium text-white">{suggestion.label}</div>
                    <div className="text-xs text-purple-300/70 mt-1 line-clamp-2">
                      {suggestion.description}
                    </div>
                  </button>
                ))}
              </div>
              
              {/* 뉴스 소스 링크 */}
              {newsSources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-purple-500/20">
                  <p className="text-xs text-purple-400/70 mb-2">📰 참고 뉴스</p>
                  <div className="flex flex-wrap gap-2">
                    {newsSources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-300/60 hover:text-purple-200 underline decoration-purple-500/30 hover:decoration-purple-400 truncate max-w-[250px]"
                        title={source.title}
                      >
                        {source.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 이슈 목록 */}
        <section>
          <h2 className="text-lg font-bold mb-4">
            등록된 이슈 ({issues.length}개)
          </h2>
          
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {issues.map((issue) => (
                  <motion.div
                    key={issue.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className={`p-4 rounded-xl border transition-colors ${
                      issue.is_active 
                        ? "bg-card/50 border-white/10" 
                        : "bg-card/20 border-red-500/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                            {issue.category}
                          </span>
                          {!issue.is_active && (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                              비활성
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold">{issue.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {issue.description}
                        </p>
                        {issue.detailed_description && (
                          <div className="text-xs text-muted-foreground/70 bg-secondary/30 p-2 rounded">
                            <span className="font-semibold block mb-1">상세 설명:</span>
                            {issue.detailed_description}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleIssue(issue.id)}
                          title={issue.is_active ? "비활성화" : "활성화"}
                        >
                          {issue.is_active ? (
                            <Eye className="w-4 h-4 text-green-500" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-red-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteIssue(issue.id)}
                          className="text-red-500 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}


