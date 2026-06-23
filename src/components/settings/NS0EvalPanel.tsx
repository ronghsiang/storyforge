import { useState } from 'react'
import { chat } from '../../lib/ai/client'
import { getFixtures } from '../../lib/evals/long-consistency/fixtures'
import {
  NS0_RESULTS_STORAGE_KEY,
  runEvalInBrowser,
} from '../../lib/evals/long-consistency/runner'
import type { EvalRunRecord } from '../../lib/evals/long-consistency/types'
import { useAIConfigStore } from '../../stores/ai-config'

function readStoredRecord(): EvalRunRecord | null {
  try {
    const raw = localStorage.getItem(NS0_RESULTS_STORAGE_KEY)
    return raw ? JSON.parse(raw) as EvalRunRecord : null
  } catch {
    return null
  }
}

export default function NS0EvalPanel() {
  const config = useAIConfigStore(state => state.config)
  const [record, setRecord] = useState<EvalRunRecord | null>(() => readStoredRecord())
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    setError('')
    setProgress('0/3')
    try {
      const fixtures = getFixtures('held-out')
      const next = await runEvalInBrowser({
        fixtures,
        split: 'held-out',
        variant: 'legacy-500-tail',
        budgetMode: 'fixed',
        config,
        call: async (messages, fixedConfig) => {
          const result: import('../../lib/ai/client').ChatResult = {}
          const output = await chat(messages, fixedConfig, { category: 'eval.ns0' }, undefined, result)
          return { output, usage: result.usage }
        },
        onProgress: (completed, total) => setProgress(`${completed}/${total}`),
      })
      setRecord(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRunning(false)
    }
  }

  const aggregate = record?.aggregate

  return (
    <div data-testid="ns0-eval-panel" className="max-w-2xl mt-6 p-4 bg-bg-surface border border-border rounded-xl">
      <h3 className="text-sm font-semibold text-text-primary">NS-0 长期一致性基线（仅开发环境）</h3>
      <p className="mt-1 text-xs text-text-muted">
        运行 3 个冻结 held-out 合成样例；固定 temperature=0.2、maxTokens=1200。完整输出只保存在本浏览器。
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => { void run() }}
          disabled={running || !config.apiKey}
          className="px-3 py-1.5 text-sm rounded-lg bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40"
        >
          {running ? `运行中 ${progress}` : '运行 Agnes 基线'}
        </button>
        {record && <span className="text-xs text-text-muted">{record.model} · {record.createdAt}</span>}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {aggregate && (
        <div data-testid="ns0-eval-result" className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-secondary">
          <span>事实召回：{(aggregate.requiredFactRecall * 100).toFixed(1)}%</span>
          <span>约束召回：{(aggregate.constraintRecall * 100).toFixed(1)}%</span>
          <span>未来泄漏：{(aggregate.futureLeakageRate * 100).toFixed(1)}%</span>
          <span>错世界泄漏：{(aggregate.wrongWorldLeakageRate * 100).toFixed(1)}%</span>
          <span>估算输入：{aggregate.estimatedInputTokens} tokens</span>
          <span>估算输出：{aggregate.estimatedOutputTokens} tokens</span>
        </div>
      )}
    </div>
  )
}
