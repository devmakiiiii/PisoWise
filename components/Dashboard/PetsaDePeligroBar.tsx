'use client'

import { Card } from '@/components/ui/card'
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'
import { AppData } from '@/lib/types'
import { FinanceCalculations } from '@/lib/calculations'

interface PetsaDePeligroBarProps {
  data: AppData
}

export function PetsaDePeligroBar({ data }: PetsaDePeligroBarProps) {
  const spendableBalance = FinanceCalculations.getSpendableBalance(data)
  const daysUntilPayday = FinanceCalculations.getDaysUntilPayday(data.settings.payDay)
  const { status, dailyCap, percentageUsed } = FinanceCalculations.getPetsaDePeligroStatus(
    spendableBalance,
    daysUntilPayday
  )

  const getStatusColors = () => {
    switch (status) {
      case 'safe':
        return {
          bgColor: 'bg-emerald-100 dark:bg-emerald-950',
          textColor: 'text-emerald-900 dark:text-emerald-100',
          barColor: 'bg-emerald-500',
          icon: CheckCircle,
          label: 'Safe Zone',
        }
      case 'caution':
        return {
          bgColor: 'bg-amber-100 dark:bg-amber-950',
          textColor: 'text-amber-900 dark:text-amber-100',
          barColor: 'bg-amber-500',
          icon: AlertCircle,
          label: 'Caution',
        }
      case 'survival':
        return {
          bgColor: 'bg-red-100 dark:bg-red-950',
          textColor: 'text-red-900 dark:text-red-100',
          barColor: 'bg-red-500',
          icon: AlertTriangle,
          label: 'Survival Mode',
        }
    }
  }

  const colors = getStatusColors()
  const Icon = colors.icon

  return (
    <Card className={`p-6 ${colors.bgColor}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Icon className="h-5 w-5" />
            <h3 className={`text-lg font-semibold ${colors.textColor}`}>Petsa de Peligro Status</h3>
          </div>
          <p className={`text-sm ${colors.textColor} opacity-75`}>
            {daysUntilPayday} days until payday • Daily spending cap: {FinanceCalculations.formatCurrency(dailyCap)}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${colors.textColor}`}>
          {colors.label}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className={colors.textColor}>Budget Usage</span>
          <span className={`font-semibold ${colors.textColor}`}>{percentageUsed.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-white/40 dark:bg-black/40 rounded-full h-3 overflow-hidden">
          <div
            className={`${colors.barColor} h-full rounded-full transition-all duration-300`}
            style={{ width: `${percentageUsed}%` }}
          />
        </div>
      </div>

      {/* Status Message */}
      <div className={`mt-4 p-3 rounded-lg bg-white/30 dark:bg-black/30`}>
        <p className={`text-sm ${colors.textColor} font-medium`}>
          {status === 'safe'
            ? `Great! You have ₱${spendableBalance.toLocaleString()} available to spend wisely until payday.`
            : status === 'caution'
              ? `Be careful! Your daily spending cap is only ₱${dailyCap.toLocaleString()} to make it to payday.`
              : `Critical! You need to control your spending. Consider asking family for support or deferring purchases.`}
        </p>
      </div>
    </Card>
  )
}
