import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface LogicThermometerProps {
  score: number // 0 to 100
  className?: string
}

export function LogicThermometer({ score, className }: LogicThermometerProps) {
  // Color gradient based on score
  const getColor = (s: number) => {
    if (s < 30) return "bg-red-500"
    if (s < 70) return "bg-yellow-500"
    return "bg-cyan-500"
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Logic Temp</span>
      <div className="relative h-32 w-4 rounded-full bg-secondary overflow-hidden border border-white/10">
        <motion.div 
          className={cn("absolute bottom-0 w-full rounded-full", getColor(score))}
          initial={{ height: "0%" }}
          animate={{ height: `${score}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>
      <span className={cn("text-sm font-bold", score >= 70 ? "text-cyan-400" : score >= 30 ? "text-yellow-400" : "text-red-400")}>
        {score}°
      </span>
    </div>
  )
}
