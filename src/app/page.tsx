"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Shield, Search, Flame, Clock, X } from "lucide-react"
import { Issue } from "@/lib/database.types"
import { UserAuthButton } from "@/components/auth/UserAuthButton"

// 카테고리 색상 맵 - 더 깔끔한 버전
const CATEGORY_COLORS: Record<string, { accent: string; badge: string }> = {
  '경제': { accent: 'border-l-green-500', badge: 'bg-green-500/20 text-green-400' },
  '정치': { accent: 'border-l-blue-500', badge: 'bg-blue-500/20 text-blue-400' },
  '사회': { accent: 'border-l-purple-500', badge: 'bg-purple-500/20 text-purple-400' },
  '법률': { accent: 'border-l-amber-500', badge: 'bg-amber-500/20 text-amber-400' },
  '노동': { accent: 'border-l-orange-500', badge: 'bg-orange-500/20 text-orange-400' },
  '환경': { accent: 'border-l-teal-500', badge: 'bg-teal-500/20 text-teal-400' },
  '기술': { accent: 'border-l-pink-500', badge: 'bg-pink-500/20 text-pink-400' },
  '일반': { accent: 'border-l-gray-500', badge: 'bg-gray-500/20 text-gray-400' },
}

// 카테고리 목록
const CATEGORIES = ['전체', '경제', '정치', '사회', '법률', '노동', '환경', '기술', '일반']

// 정렬 옵션
type SortOption = 'latest' | 'popular'

export default function Home() {
  const router = useRouter()
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [stance, setStance] = useState<"agree" | "neutral" | "disagree" | null>(null)
  
  // 검색 & 필터 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [sortBy, setSortBy] = useState<SortOption>('latest')

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const res = await fetch("/api/issues")
        const data = await res.json()
        
        if (Array.isArray(data)) {
          setIssues(data)
        } else {
          console.error("Issues data is not an array:", data)
          setIssues([])
        }
      } catch (error) {
        console.error("Failed to fetch issues", error)
      } finally {
        setLoading(false)
      }
    }
    fetchIssues()
  }, [])

  // 필터링 및 정렬된 이슈
  const filteredIssues = useMemo(() => {
    let result = [...issues]
    
    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(issue => 
        issue.title.toLowerCase().includes(query) ||
        issue.description?.toLowerCase().includes(query)
      )
    }
    
    // 카테고리 필터
    if (selectedCategory !== '전체') {
      result = result.filter(issue => issue.category === selectedCategory)
    }
    
    // 정렬
    if (sortBy === 'popular') {
      // debate_count가 있으면 사용, 없으면 created_at 기준
      result.sort((a, b) => {
        const countA = (a as any).debate_count || 0
        const countB = (b as any).debate_count || 0
        return countB - countA
      })
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    
    return result
  }, [issues, searchQuery, selectedCategory, sortBy])

  const handleMatch = () => {
    if (selectedIssue && stance) {
      router.push(`/lobby/${selectedIssue.id}?stance=${stance}`)
    }
  }

  const getCategoryStyle = (category: string) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['일반']
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-[#0a0a0f] p-4 relative overflow-hidden">
      {/* Background Ambience - 더 어둡게 조정 */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-3xl -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-white/[0.02] to-transparent rounded-full -z-10" />
      
      {/* Top Navigation */}
      <div className="absolute top-4 right-4 flex items-center gap-4 z-50">
        <Link 
          href="/admin" 
          className="flex items-center gap-2 text-xs text-muted-foreground/50 hover:text-white transition-colors"
        >
          <Shield className="w-3 h-3" />
          관리자
        </Link>
        <UserAuthButton />
      </div>
      
      <div className="max-w-6xl w-full flex flex-col items-center mt-12 md:mt-16">
        {/* Header Section */}
        <div className="text-center space-y-6 mb-10 z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter bg-gradient-to-r from-blue-400 via-white to-purple-400 bg-clip-text text-transparent drop-shadow-lg">
              안토론
            </h1>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
          >
            당신의 논리가 세상을 설득하는 곳.<br/>
            지금 가장 뜨거운 이슈를 선택하고 토론에 참여하세요.
          </motion.p>
        </div>

        {/* Search & Filter Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-2xl mb-8 space-y-4"
        >
          {/* 검색바 */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="토론 주제 검색..."
              className="pl-12 pr-12 h-14 bg-white/5 border-white/10 rounded-2xl text-lg placeholder:text-muted-foreground/50 focus:border-white/30 focus:bg-white/10 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* 필터 & 정렬 */}
          <div className="flex items-center justify-between gap-4">
            {/* 카테고리 탭 */}
            <div className="flex-1 overflow-x-auto scrollbar-thin">
              <div className="flex gap-2 pb-2">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                      selectedCategory === category
                        ? "bg-white text-black"
                        : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* 정렬 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('latest')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all",
                  sortBy === 'latest' 
                    ? "bg-white/10 text-white" 
                    : "text-white/50 hover:text-white"
                )}
              >
                <Clock className="w-4 h-4" />
                최신
              </button>
              <button
                onClick={() => setSortBy('popular')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all",
                  sortBy === 'popular' 
                    ? "bg-white/10 text-white" 
                    : "text-white/50 hover:text-white"
                )}
              >
                <Flame className="w-4 h-4" />
                인기
              </button>
            </div>
          </div>
        </motion.div>

        {/* Results Count */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full text-left mb-4 px-4 md:px-0"
          >
            <p className="text-sm text-muted-foreground">
              {filteredIssues.length}개의 토론 주제
              {searchQuery && <span> · "{searchQuery}" 검색 결과</span>}
              {selectedCategory !== '전체' && <span> · {selectedCategory}</span>}
            </p>
          </motion.div>
        )}

        {/* Issues List */}
        {loading ? (
          <div className="flex gap-2 mt-20">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" />
            <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-75" />
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce delay-150" />
          </div>
        ) : filteredIssues.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <p className="text-muted-foreground text-lg">검색 결과가 없습니다.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('전체'); }}
              className="mt-4 text-blue-400 hover:underline"
            >
              필터 초기화
            </button>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-4 md:px-0 pb-20"
          >
            {filteredIssues.map((issue) => {
              const categoryStyle = getCategoryStyle(issue.category)
              
              return (
                <motion.div 
                  key={issue.id} 
                  variants={itemVariants}
                  className="relative group"
                >
                  <Dialog>
                    <DialogTrigger asChild>
                      <div 
                        onClick={() => {
                          setSelectedIssue(issue)
                          setStance(null)
                        }}
                        className={cn(
                          "relative p-5 rounded-xl cursor-pointer transition-all duration-200",
                          "bg-[#12121a] border border-white/10",
                          "hover:bg-[#1a1a24] hover:border-white/20 hover:shadow-lg hover:shadow-black/20",
                          "border-l-4",
                          categoryStyle.accent
                        )}
                      >
                        {/* Header: Category + Date */}
                        <div className="flex items-center justify-between mb-3">
                          <span className={cn(
                            "text-xs font-medium px-2.5 py-1 rounded-md",
                            categoryStyle.badge
                          )}>
                            {issue.category}
                          </span>
                          <span className="text-xs text-white/30">
                            {new Date(issue.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 break-keep leading-snug">
                          {issue.title}
                        </h3>
                        
                        {/* Description */}
                        <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">
                          {issue.description}
                        </p>

                        {/* Arrow indicator */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-white/60 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </DialogTrigger>
                  
                    {/* Stance Selection Dialog */}
                    <DialogContent className="sm:max-w-[500px] bg-[#0A0A0F] border-white/10 text-white shadow-2xl">
                      <DialogHeader className="space-y-4">
                        <DialogTitle className="text-3xl font-bold text-center pt-4">{issue.title}</DialogTitle>
                        <DialogDescription className="text-center text-gray-400 text-base">
                          {issue.description}
                          <br/><br/>
                          <span className="text-white font-medium">이 주제에 대해 어떤 입장이신가요?</span>
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="grid grid-cols-3 gap-4 py-8">
                        <Button 
                          variant="outline" 
                          className={cn(
                            "h-32 flex flex-col gap-3 border-white/10 hover:bg-blue-900/20 hover:border-blue-500/50 hover:text-white transition-all",
                             stance === "agree" && "bg-blue-600 border-blue-600 ring-2 ring-blue-400 ring-offset-2 ring-offset-black"
                          )}
                          onClick={() => setStance("agree")}
                        >
                          <span className="text-4xl">👍</span>
                          <span className="font-bold">찬성</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className={cn(
                            "h-32 flex flex-col gap-3 border-white/10 hover:bg-gray-800 hover:border-gray-500/50 hover:text-white transition-all",
                            stance === "neutral" && "bg-gray-600 border-gray-600 ring-2 ring-gray-400 ring-offset-2 ring-offset-black"
                          )}
                          onClick={() => setStance("neutral")}
                        >
                          <span className="text-4xl">🤔</span>
                          <span className="font-bold">중립</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          className={cn(
                            "h-32 flex flex-col gap-3 border-white/10 hover:bg-red-900/20 hover:border-red-500/50 hover:text-white transition-all",
                            stance === "disagree" && "bg-red-600 border-red-600 ring-2 ring-red-400 ring-offset-2 ring-offset-black"
                          )}
                          onClick={() => setStance("disagree")}
                        >
                          <span className="text-4xl">👎</span>
                          <span className="font-bold">반대</span>
                        </Button>
                      </div>
                      
                      <DialogFooter>
                        <Button 
                          onClick={handleMatch} 
                          disabled={!stance} 
                          className="w-full h-14 text-lg font-bold bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          토론방 입장하기
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </main>
  )
}
