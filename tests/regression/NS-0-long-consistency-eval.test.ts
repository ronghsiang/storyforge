import { describe, expect, it } from 'vitest'
import { getFixtures } from '../../src/lib/evals/long-consistency/fixtures'
import {
  NS0_FIXED_MAX_TOKENS,
  NS1_ACCEPTANCE_THRESHOLDS,
  aggregateScores,
  buildEvalCase,
  runPairedEvalInBrowser,
  scoreOutput,
} from '../../src/lib/evals/long-consistency/runner'

describe('NS-0 long-consistency evaluation harness', () => {
  it('freezes separate development and held-out fixture sets', () => {
    expect(getFixtures('development').map(fixture => fixture.id)).toEqual([
      'dev-completion-bell',
      'dev-continuation-wound',
      'dev-expansion-medicine',
    ])
    expect(getFixtures('held-out').map(fixture => fixture.id)).toEqual([
      'held-completion-lantern',
      'held-continuation-ink',
      'held-expansion-compass',
    ])
  })

  it('snapshots the current production builders and exact 500-char predecessor tail', () => {
    const fixtures = getFixtures('development')
    const completion = buildEvalCase(fixtures[0], 'legacy-500-tail')
    const continuation = buildEvalCase(fixtures[1], 'legacy-500-tail')
    const expansion = buildEvalCase(fixtures[2], 'legacy-500-tail')

    expect(completion.productionSnapshot).toEqual({
      task: 'completion',
      previousTailChars: 500,
      builder: 'chapter.content',
    })
    expect(completion.messages.at(-1)?.content).toContain(fixtures[0].previousChapterText.slice(-500))
    expect(completion.messages.at(-1)?.content).not.toContain(fixtures[0].previousChapterText.slice(0, 40))
    expect(continuation.productionSnapshot.builder).toBe('chapter.continue')
    expect(expansion.productionSnapshot.builder).toBe('chapter.expand')
  })

  it('scores deterministic facts, constraints, future leakage, foreign-world leakage and evidence', () => {
    const fixture = {
      ...getFixtures('held-out')[0],
      evidenceIds: ['chapter-19:ending'],
    }
    const score = scoreOutput(
      fixture,
      '祁照偏过右耳，踩着熄灭的灯影，把密函交给手腕绕着两圈红绳的人。[证据:chapter-19:ending] 他随后踩发亮的灯，并想起将来烧毁密函。',
    )

    expect(score.requiredFactRecall).toBe(1)
    expect(score.constraintRecall).toBe(1)
    expect(score.futureLeakage).toBe(true)
    expect(score.wrongWorldLeakage).toBe(true)
    expect(score.evidenceCitationRecall).toBe(1)
  })

  it('pre-registers fixed-budget and NS-1 acceptance gates before real baseline calls', () => {
    expect(NS0_FIXED_MAX_TOKENS).toBe(1200)
    expect(NS1_ACCEPTANCE_THRESHOLDS).toEqual({
      futureLeakageRate: 0,
      wrongWorldLeakageRate: 0,
      minimumRequiredFactRecall: 0.85,
      minimumConstraintRecall: 0.85,
      minimumEvidenceCitationRecall: 0.9,
      maximumEstimatedInputTokenMultiplierVsLegacy: 1.6,
      minimumFactRecallImprovementVsLegacy: 0.1,
    })
  })

  it('aggregates a run without treating unavailable citation scores as zero', () => {
    const fixture = getFixtures('development')[0]
    const score = scoreOutput(fixture, '青铜铃藏在左袖，暗号是三短一长，她没有叫出苏禾的名字。')
    const aggregate = aggregateScores([{
      fixtureId: fixture.id,
      messages: [],
      productionSnapshot: {
        task: fixture.task,
        previousTailChars: 0,
        builder: 'chapter.content',
      },
      output: '青铜铃藏在左袖，暗号是三短一长，她没有叫出苏禾的名字。',
      inputChars: 100,
      outputChars: 30,
      inputTokens: 80,
      outputTokens: 20,
      durationMs: 10,
      score,
    }])

    expect(aggregate.requiredFactRecall).toBe(1)
    expect(aggregate.constraintRecall).toBe(1)
    expect(aggregate.evidenceCitationRecall).toBeNull()
    expect(aggregate.futureLeakageRate).toBe(0)
    expect(aggregate.estimatedInputTokens).toBe(80)
    expect(aggregate.estimatedOutputTokens).toBe(20)
  })

  it('runs paired A/B under both fixed-budget and natural-cost modes', async () => {
    const seenMaxTokens: number[] = []
    const fixture = getFixtures('development')[0]
    const records = await runPairedEvalInBrowser({
      fixtures: [fixture],
      split: 'development',
      variants: ['legacy-500-tail', 'handoff-tail-summary'],
      config: {
        provider: 'agnes',
        apiKey: 'test-only',
        model: 'agnes-1.5-flash',
        baseUrl: 'https://example.invalid/v1',
        temperature: 0.7,
        maxTokens: 4096,
      },
      call: async (_messages, config) => {
        seenMaxTokens.push(config.maxTokens)
        return {
          output: '青铜铃藏在左袖，暗号是三短一长，她没有叫出苏禾的名字。',
          usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
        }
      },
    })

    expect(records.map(record => `${record.budgetMode}:${record.variant}`)).toEqual([
      'fixed:legacy-500-tail',
      'fixed:handoff-tail-summary',
      'natural:legacy-500-tail',
      'natural:handoff-tail-summary',
    ])
    expect(seenMaxTokens).toEqual([1200, 1200, 4096, 4096])
  })
})
