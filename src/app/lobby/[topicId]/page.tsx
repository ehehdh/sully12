
"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { ArrowLeft, Plus, Users } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/useAuth"
import { DebateSettings } from "@/lib/database.types"

type Room = {
  id: string;
  topic: string;
  title?: string;
  description?: string;
  stance: "agree" | "disagree" | "neutral";
  settings?: DebateSettings;
  participants: string[];
  createdAt: string;
}

export default function LobbyPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const topicId = params.topicId as string
  const userStance = searchParams.get("stance") as "agree" | "disagree" | "neutral"
  
  // 카카오 로그인 사용자 정보 사용
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  
  const [rooms, setRooms] = useState<Room[]>([])
  const [topicTitle, setTopicTitle] = useState<string>("")
  const [loading, setLoading] = useState(true)
  
  // 방 만들기 상태
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newRoomTitle, setNewRoomTitle] = useState("")
  const [newRoomDescription, setNewRoomDescription] = useState("")
  const [newRoomStance, setNewRoomStance] = useState<"agree" | "disagree" | "neutral">("neutral")
  const [settings, setSettings] = useState<DebateSettings>({
    introduction: { duration: 60, turns: 1 },
    rebuttal: { duration: 120, turns: 1 },
    cross: { duration: 180, turns: 1 },
    closing: { duration: 60, turns: 1 }
  })

  useEffect(() => {
    if (userStance) {
      setNewRoomStance(userStance)
    }
  }, [userStance])

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch(`/api/rooms?topic=${topicId}`)
        const data = await res.json()
        if (Array.isArray(data)) {
          setRooms(data)
        } else {
          console.error("Rooms data is not an array:", data)
          setRooms([])
        }
      } catch (error) {
        console.error("Failed to fetch rooms", error)
      } finally {
        setLoading(false)
      }
    }

    
    const fetchTopic = async () => {
      try {
        const res = await fetch(`/api/issues?id=${topicId}`)
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setTopicTitle(data[0].title)
        }
      } catch (error) {
        console.error("Failed to fetch topic", error)
      }
    }

    fetchRooms()
    fetchTopic()
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchRooms, 5000)
    return () => clearInterval(interval)
  }, [topicId])

  const handleCreateRoomClick = () => {
    setNewRoomTitle(`${topicTitle || topicId}에 대한 토론`)
    setNewRoomDescription("")
    setSettings({
      introduction: { duration: 60, turns: 1 },
      rebuttal: { duration: 120, turns: 1 },
      cross: { duration: 180, turns: 1 },
      closing: { duration: 60, turns: 1 }
    })
    setIsCreateDialogOpen(true)
  }

  const submitCreateRoom = async () => {
    // 로그인 확인
    if (!isAuthenticated || !user) {
      router.push('/login')
      return
    }
    
    const userName = user.nickname
    
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicId,
          stance: newRoomStance,
          creatorName: userName,
          title: newRoomTitle,
          description: newRoomDescription,
          settings
        })
      })
      const newRoom = await res.json()
      router.push(`/debate/${newRoom.id}?stance=${newRoomStance}&isMulti=true`)
    } catch (error) {
      console.error("Failed to create room", error)
    }
  }

  const handleJoinRoom = (roomId: string) => {
    // 로그인 확인
    if (!isAuthenticated || !user) {
      router.push('/login')
      return
    }
    router.push(`/debate/${roomId}?stance=${userStance}&isMulti=true`)
  }

  return (
    <main className="min-h-screen bg-background p-4 flex flex-col items-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500" />
      
      <div className="w-full max-w-4xl mt-8 mb-8 flex items-center justify-between">
         <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> 주제 목록으로
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">토론 대기실: <span className="text-blue-400">{topicTitle || topicId}</span></h1>
        <div className="w-24" />
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Room Card */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Card className="bg-card/50 border-dashed border-2 border-white/20 flex flex-col items-center justify-center p-8 hover:bg-card/80 transition-colors cursor-pointer" onClick={handleCreateRoomClick}>
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">새로운 토론방 만들기</h3>
              <p className="text-muted-foreground text-center">
                원하는 주제로 방을 만들고<br/>참가자를 기다리세요.
              </p>
            </Card>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-800 text-slate-100">
            <DialogHeader>
              <DialogTitle>토론방 만들기</DialogTitle>
              <DialogDescription className="text-slate-400">
                토론방의 제목과 설명을 입력하고 입장을 선택해주세요.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="title" className="text-sm font-medium">방 제목</label>
                <Input id="title" value={newRoomTitle} onChange={(e) => setNewRoomTitle(e.target.value)} className="bg-slate-800 border-slate-700" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="description" className="text-sm font-medium">방 설명</label>
                <Input id="description" value={newRoomDescription} onChange={(e) => setNewRoomDescription(e.target.value)} placeholder="어떤 이야기를 나누고 싶으신가요?" className="bg-slate-800 border-slate-700" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">나의 입장</label>
                <div className="flex gap-2">
                  <Button 
                    variant={newRoomStance === "agree" ? "default" : "outline"} 
                    className={cn("flex-1", newRoomStance === "agree" && "bg-blue-600 hover:bg-blue-700")}
                    onClick={() => setNewRoomStance("agree")}
                  >
                    찬성
                  </Button>
                  <Button 
                    variant={newRoomStance === "disagree" ? "default" : "outline"} 
                    className={cn("flex-1", newRoomStance === "disagree" && "bg-red-600 hover:bg-red-700")}
                    onClick={() => setNewRoomStance("disagree")}
                  >
                    반대
                  </Button>
                  <Button 
                    variant={newRoomStance === "neutral" ? "default" : "outline"} 
                    className="flex-1"
                    onClick={() => setNewRoomStance("neutral")}
                  >
                    중립
                  </Button>
                </div>
              </div>

              {/* Time settings removed */}
            </div>
            <DialogFooter>
              <Button onClick={submitCreateRoom}>방 만들기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Room List */}
        {loading ? (
          <div className="col-span-1 md:col-span-2 text-center p-10">로딩 중...</div>
        ) : rooms.length === 0 ? (
          <div className="col-span-1 md:col-span-2 text-center p-10 text-muted-foreground">
            현재 개설된 방이 없습니다. 첫 번째 방을 만들어보세요!
          </div>
        ) : (
          rooms.map((room) => (
            <Card key={room.id} className="bg-card/50 border-white/10 hover:border-white/20 transition-colors">
              <CardHeader>
                <CardTitle className="flex flex-col gap-2">
                  <span className="text-lg">{room.title || room.topic}</span>
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full border w-fit",
                    room.stance === "agree" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                    room.stance === "disagree" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                    "bg-gray-500/20 text-gray-300 border-gray-500/30"
                  )}>
                    {room.stance === "agree" ? "개설자: 찬성" : room.stance === "disagree" ? "개설자: 반대" : "개설자: 중립"}
                  </span>
                </CardTitle>
                <CardDescription>
                  <div className="mb-2 text-sm text-slate-300">{room.description || "설명이 없습니다."}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    {(room.participants?.length || 0)}명 참여 중
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleJoinRoom(room.id)}>
                  참여하기
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  )
}
