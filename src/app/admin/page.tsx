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
  Loader2
} from "lucide-react";
import Link from "next/link";
import { Issue } from "@/lib/database.types";

export default function AdminPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // 새 이슈 폼
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDetailedDescription, setNewDetailedDescription] = useState("");
  const [newCategory, setNewCategory] = useState("일반");
  
  // AI 제안
  const [aiSuggestions, setAiSuggestions] = useState<{label: string; description: string; detailed_description?: string; category?: string}[]>([]);

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

  // AI로 이슈 제안 받기
  const handleGenerateSuggestions = async () => {
    setIsGenerating(true);
    setAiSuggestions([]);
    
    try {
      // Add a timestamp to bust cache and seed the random generator
      const res = await fetch(`/api/topics?seed=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      
      // API는 배열을 직접 반환함
        if (Array.isArray(data)) {
        const suggestions = data.map((t: any) => ({
          label: t.label || t.title || t,
          description: t.description || "",
          detailed_description: t.detailed_description || t.description || "",
          category: t.category || "일반"
        }));
        setAiSuggestions(suggestions);
      } else if (data.topics && Array.isArray(data.topics)) {
        const suggestions = data.topics.map((t: any) => ({
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
          <Button variant="ghost" size="sm" onClick={fetchIssues}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </header>

        {/* 퀵 링크 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <Link href="/admin/debates" className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl hover:bg-yellow-500/20 transition-colors">
            <div className="text-2xl mb-2">🏆</div>
            <h3 className="font-bold">토론 기록</h3>
            <p className="text-xs text-muted-foreground">완료된 토론 관리</p>
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
              
              <Button 
                variant="outline" 
                onClick={handleGenerateSuggestions}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                AI 제안 받기
              </Button>
            </div>
          </div>
          
          {/* AI 제안 목록 */}
          {aiSuggestions.length > 0 && (
            <div className="mt-4 p-4 bg-purple-900/30 rounded-lg border border-purple-500/30">
              <h3 className="text-sm font-bold text-purple-300 mb-2">
                🤖 AI 추천 토론 주제
              </h3>
              <div className="flex flex-wrap gap-2">
                {aiSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="px-3 py-2 text-sm bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 rounded-lg transition-colors text-left"
                  >
                    <div className="font-medium">{suggestion.label}</div>
                  </button>
                ))}
              </div>
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


