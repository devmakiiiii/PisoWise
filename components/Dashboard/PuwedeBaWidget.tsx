'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppData } from '@/lib/types'
import { FinanceCalculations } from '@/lib/calculations'
import { Check, X } from 'lucide-react'

interface PuwedeBaWidgetProps {
  data: AppData
}

export function PuwedeBaWidget({ data }: PuwedeBaWidgetProps) {
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [result, setResult] = useState<null | ReturnType<typeof FinanceCalculations.canAfford>>(null)

  const spendableBalance = FinanceCalculations.getSpendableBalance(data)
  const daysUntilPayday = FinanceCalculations.getDaysUntilPayday(data.settings.payDay)

  const handleCheck = () => {
    if (!itemName || !itemPrice || isNaN(Number(itemPrice))) {
      return
    }

    const affordResult = FinanceCalculations.canAfford(
      Number(itemPrice),
      spendableBalance,
      daysUntilPayday
    )
    setResult(affordResult)
  }

  const handleReset = () => {
    setItemName('')
    setItemPrice('')
    setResult(null)
  }

  return (
    <Card className="p-6 border-2 border-primary/20">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span>Puwede Ba My Budget?</span>
        <span className="text-lg">💸</span>
      </h3>

      <div className="space-y-3">
        <Input
          placeholder="Item name (e.g., New shoes)"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          className="border-border"
        />

        <div className="flex gap-2">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-3 top-2 text-muted-foreground">₱</span>
              <Input
                type="number"
                placeholder="0.00"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                className="border-border pl-7"
              />
            </div>
          </div>
          <Button onClick={handleCheck} className="flex-1" disabled={!itemName || !itemPrice}>
            Check
          </Button>
        </div>

        {result && (
          <div
            className={`p-4 rounded-lg border-2 ${
              result.canAfford
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950'
                : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.canAfford ? (
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <X className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`font-semibold mb-2 ${
                    result.canAfford
                      ? 'text-emerald-900 dark:text-emerald-100'
                      : 'text-red-900 dark:text-red-100'
                  }`}
                >
                  {result.message}
                </p>
                <p className={`text-sm ${
                  result.canAfford
                    ? 'text-emerald-800 dark:text-emerald-200'
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  Current safe-to-spend: {FinanceCalculations.formatCurrency(spendableBalance)} with {daysUntilPayday} days to payday
                </p>
              </div>
            </div>
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="mt-3 w-full"
            >
              Check Another Item
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
