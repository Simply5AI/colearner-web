'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { DailyQuest, DailyQuestItem } from '@/lib/api/gamification'
import { CheckCircle2, Circle, Target, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DailyQuestWidgetProps {
  quest: DailyQuest | null
}

export function DailyQuestWidget({ quest }: DailyQuestWidgetProps) {
  if (!quest) {
    return (
      <Card className="col-span-1 border-primary/20 bg-background overflow-hidden relative">
        <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Daily Quests
          </CardTitle>
          <CardDescription>Loading today's objectives...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { items, isAllCompleted } = quest

  return (
    <Card className={cn(
      "col-span-1 transition-all duration-300 relative overflow-hidden",
      isAllCompleted ? "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]" : "border-border"
    )}>
      {isAllCompleted && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
      )}
      
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Daily Quests
          </CardTitle>
          {isAllCompleted && (
            <span className="text-xs font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full">
              <Trophy className="h-3 w-3" /> All Done!
            </span>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-4 relative z-10">
        <div className="space-y-4">
          {items.map((item: DailyQuestItem) => {
            const progress = Math.min(100, Math.round((item.current / item.target) * 100))
            const isDone = item.isCompleted || item.current >= item.target

            return (
              <div key={item.id} className="space-y-2 group">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={cn(
                      "font-medium transition-colors",
                      isDone ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground group-hover:text-primary"
                    )}>
                      {item.title}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {item.current} / {item.target}
                  </span>
                </div>
                <Progress 
                  value={progress} 
                  className={cn("h-2 transition-all", isDone && "opacity-50")} 
                  indicatorClassName={isDone ? "bg-green-500" : "bg-primary"}
                />
              </div>
            )
          })}
        </div>
        
        {!isAllCompleted && items.length > 0 && (
          <p className="text-xs text-center text-muted-foreground pt-2 font-medium">
            Complete all to earn bonus XP!
          </p>
        )}
      </CardContent>
    </Card>
  )
}
