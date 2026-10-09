'use client'

import { useState } from 'react'
import { Header } from '@/components/Layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Trash2, Plus } from 'lucide-react'
import { StorageManager } from '@/lib/storage'
import { useAppData } from '@/lib/hooks'
import { Goal } from '@/lib/types'
import { FinanceCalculations } from '@/lib/calculations'
import { nanoid } from 'nanoid'

export default function GoalsPage() {
  const data = useAppData()
  const [addAmount, setAddAmount] = useState<Record<string, string>>({})

  const handleDeleteGoal = (id: string) => {
    StorageManager.deleteGoal(id)
  }

  const handleAddToGoal = (id: string, amount: string) => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return
    }

    const goal = data.goals.find((g) => g.id === id)
    if (!goal) return

    const newAmount = goal.currentAmount + Number(amount)
    StorageManager.updateGoal(id, { currentAmount: newAmount })
    setAddAmount({ ...addAmount, [id]: '' })
  }

  const handleAddNewGoal = () => {
    const newGoal: Goal = {
      id: nanoid(),
      name: 'New Goal',
      emoji: '🎯',
      targetAmount: 10000,
      currentAmount: 0,
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    }
    StorageManager.addGoal(newGoal)
  }

  const totalTarget = data.goals.reduce((sum, g) => sum + g.targetAmount, 0)
  const totalCurrent = data.goals.reduce((sum, g) => sum + g.currentAmount, 0)
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0

  return (
    <main className="min-h-screen">
      <Header />
      <div className="p-4 space-y-6 md:p-6">
        {/* Overall Progress */}
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10">
          <h2 className="text-lg font-semibold mb-4">Overall Ipong-Pino Progress</h2>
          <div className="space-y-3">
            <Progress value={overallProgress} className="h-3" />
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Current Savings</p>
                <p className="text-lg font-semibold text-primary">
                  {FinanceCalculations.formatCurrency(totalCurrent)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Target</p>
                <p className="text-lg font-semibold">{FinanceCalculations.formatCurrency(totalTarget)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Progress</p>
                <p className="text-lg font-semibold">{overallProgress.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Goals Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Sinking Funds</h2>
            <Button onClick={handleAddNewGoal} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              New Goal
            </Button>
          </div>

          {data.goals.length === 0 ? (
            <Card className="p-12">
              <div className="text-center text-muted-foreground">
                <p>No goals yet. Start by creating your first sinking fund!</p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {data.goals.map((goal) => {
                const progress = FinanceCalculations.calculateGoalProgress(
                  goal.currentAmount,
                  goal.targetAmount
                )
                const daysLeft = Math.max(
                  0,
                  Math.ceil(
                    (new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  )
                )

                return (
                  <Card key={goal.id} className="p-5 flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{goal.emoji}</span>
                          <h3 className="font-semibold">{goal.name}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Target: {FinanceCalculations.formatDate(goal.targetDate)} ({daysLeft} days)</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2 mb-4">
                      <Progress value={progress} className="h-2" />
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{FinanceCalculations.formatCurrency(goal.currentAmount)}</span>
                        <span className="text-muted-foreground">{progress.toFixed(0)}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Target: {FinanceCalculations.formatCurrency(goal.targetAmount)}</p>
                    </div>

                    {/* Add to Goal */}
                    <div className="flex gap-2 mt-auto">
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={addAmount[goal.id] || ''}
                        onChange={(e) => setAddAmount({ ...addAmount, [goal.id]: e.target.value })}
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAddToGoal(goal.id, addAmount[goal.id] || '')}
                        className="h-8"
                      >
                        Add
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
