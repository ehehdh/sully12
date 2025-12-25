"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
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
import { Shield, Sparkles } from "lucide-react"
import { Issue } from "@/lib/database.types"

// Extended type for UI state if needed, but Issue from DB is fine.
// We might map it to ensure fields exist.

export default function Home() {
  const router = useRouter()
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [stance, setStance] = useState<"agree" | "neutral" | "disagree" | null>(null)
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);

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

  const handleMatch = () => {
    if (selectedIssue && stance) {
      // Redirect to lobby
      router.push(`/lobby/${selectedIssue.id}?stance=${stance}`)
    }
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-background p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse duration-[5000ms]" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -z-10 animate-pulse duration-[7000ms]" />
      
      {/* Admin Link */}
      <Link 
        href="/admin" 
        className="absolute top-4 right-4 flex items-center gap-2 text-xs text-muted-foreground/50 hover:text-white transition-colors z-50"
      >
        <Shield className="w-3 h-3" />
        관리자
      </Link>
      
      <div className="max-w-6xl w-full flex flex-col items-center mt-12 md:mt-20">
        {/* Header Section */}
        <div className="text-center space-y-6 mb-16 z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter bg-gradient-to-r from-blue-400 via-white to-purple-400 bg-clip-text text-transparent drop-shadow-lg">
              안토론
            </h1>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            당신의 논리가 세상을 설득하는 곳.<br/>
            지금 가장 뜨거운 이슈를 선택하고 토론에 참여하세요.
          </motion.p>
        </div>

        {/* Issues List */}
        {loading ? (
          <div className="flex gap-2 mt-20">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" />
            <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-75" />
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce delay-150" />
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 md:px-0 pb-20"
          >


            {/* Mapped Issues */}
            {issues.map((issue) => (
              <motion.div 
                key={issue.id} 
                variants={itemVariants}
                className="relative"
                onMouseEnter={() => setHoveredIssueId(issue.id)}
                onMouseLeave={() => setHoveredIssueId(null)}
              >
                <Dialog>
                  <DialogTrigger asChild>
                    <div 
                      onClick={() => {
                        setSelectedIssue(issue)
                        setStance(null)
                      }}
                      className="group relative h-64 p-8 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02] hover:from-white/10 hover:to-white/5 hover:border-white/20 backdrop-blur-sm transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between"
                    >
                      {/* Category Badge */}
                      <div className="absolute top-6 left-6">
                         <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 text-white/70 border border-white/5">
                           {issue.category}
                         </span>
                      </div>

                      {/* Main Content */}
                      <div className="mt-8">
                        <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 group-hover:to-white mb-3 break-keep">
                          {issue.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {issue.description}
                        </p>
                      </div>

                      {/* Arrow Icon */}
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0 duration-300">
                        <span className="text-white text-2xl">→</span>
                      </div>

                      {/* Hover Overlay - Detailed Description */}
                       <AnimatePresence>
                        {hoveredIssueId === issue.id && (
                          <motion.div 
                            initial={{ opacity: 0, background: "rgba(0,0,0,0)" }}
                            animate={{ opacity: 1, background: "rgba(10,10,15,0.95)" }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 p-6 flex flex-col justify-center items-center text-center z-10"
                          >
                             <motion.div
                               initial={{ y: 10, opacity: 0 }}
                               animate={{ y: 0, opacity: 1 }}
                               transition={{ delay: 0.1 }}
                             >
                               <h4 className="font-bold text-white mb-3 text-lg">{issue.title}</h4>
                               <p className="text-sm text-gray-300 leading-relaxed font-light break-keep">
                                 {issue.detailed_description || issue.description}
                               </p>
                               <p className="text-xs text-blue-400 mt-4 font-bold">클릭하여 토론 참여하기</p>
                             </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </DialogTrigger>
                  
                  {/* Stance Selection Dialog (Same as before but styled) */}
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
            ))}
          </motion.div>
        )}
      </div>
    </main>
  )
}
