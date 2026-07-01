import type { ChatMessage } from '../../types'
import { usePromptStore } from '../../../stores/prompt'
import { renderPrompt } from '../prompt-engine'

export interface RunOptions {
  parameterValues?: Record<string, unknown>
  overrides?: { systemPrompt?: string; userPromptTemplate?: string }
}

export interface VolumeOutlineRequest {
  existingVolumesContext?: string
  existingVolumeCount?: number
  targetVolumeTitle?: string
}

function appendUserConstraint(messages: ChatMessage[], constraint: string): ChatMessage[] {
  const next = messages.map(message => ({ ...message }))
  const user = [...next].reverse().find(message => message.role === 'user')
  if (user) user.content = `${user.content}\n\n${constraint}`
  return next
}

/** 生成卷级大纲 */
export function buildVolumeOutlinePrompt(
  projectName: string,
  genre: string,
  worldContext: string,
  storyCoreContext: string,
  targetWordCount: number,
  userHint?: string,
  options?: RunOptions,
  characterContext?: string,
  /** Phase 32: 世界规则清单（替代旧 historicalContext + creativeMode） */
  worldRulesContext?: string,
  request?: VolumeOutlineRequest,
): ChatMessage[] {
  const rawVolumeCount = options?.parameterValues?.volumeCount
  const explicitVolumeCount = Number(rawVolumeCount)
  const hasExplicitVolumeCount =
    !request?.targetVolumeTitle &&
    rawVolumeCount !== '' && rawVolumeCount != null &&
    Number.isFinite(explicitVolumeCount) && explicitVolumeCount > 0
  const existingVolumeCount = request?.existingVolumeCount ?? 0
  const normalizedOptions: RunOptions = {
    ...options,
    parameterValues: {
      ...(options?.parameterValues ?? {}),
      volumeCount: hasExplicitVolumeCount ? Math.floor(explicitVolumeCount) : '',
    },
  }
  const tpl = usePromptStore.getState().getActive('outline.volume')
  const { messages } = renderPrompt(tpl, {
    projectName,
    genres: genre,
    targetWordCount,
    estimatedVolumes: hasExplicitVolumeCount ? Math.floor(explicitVolumeCount) : '由 AI 合理规划',
    worldContext: worldContext || '（暂无，请自由发挥）',
    storyCore: storyCoreContext || '（暂无，请自由发挥）',
    characterContext: characterContext || '',
    worldRulesContext: worldRulesContext || '',
    existingVolumesContext: request?.existingVolumesContext || '',
    existingVolumeCount,
    userHint,
  }, normalizedOptions)

  const constraints: string[] = ['【本次卷纲生成硬约束】']
  // CF-3：故事主线/核心非空时，强制以主线为骨架，避免自动卷纲偏离用户已填主线。
  if (storyCoreContext.trim()) {
    constraints.push('【主线一致性·硬约束】必须严格以上文「故事核心 / 主线」为骨架展开：每一卷的 summary 都要明确说明它推进了主线的哪一阶段；禁止另起新主线、禁止与已填主线冲突，不得把故事核心当作可有可无的参考。')
  }
  if (request?.existingVolumesContext) {
    constraints.push(request.existingVolumesContext)
    constraints.push(request.targetVolumeTitle
      ? `除本次指定补全的空卷《${request.targetVolumeTitle}》外，禁止改写、复述或重新生成其他已有卷。`
      : '必须从已有卷之后继续规划；禁止改写、复述或重新生成已有卷。新卷剧情必须承接已有卷末状态。')
  }
  if (request?.targetVolumeTitle) {
    constraints.push(`本次只补全现有空卷《${request.targetVolumeTitle}》的卷纲。`)
    constraints.push(`只输出 1 个 JSON 元素；title 必须保持为“${request.targetVolumeTitle}”，summary 写完整的本卷核心冲突、情绪走向、主角状态变化和卷末钩子。`)
  } else if (hasExplicitVolumeCount) {
    const remaining = Math.max(0, Math.floor(explicitVolumeCount) - existingVolumeCount)
    constraints.push(`用户明确设定全书最终总卷数为 ${Math.floor(explicitVolumeCount)} 卷，这是强约束。`)
    constraints.push(`当前已有 ${existingVolumeCount} 卷，本次必须只生成后续缺少的 ${remaining} 卷，最终总数恰好为 ${Math.floor(explicitVolumeCount)} 卷。`)
  } else {
    constraints.push('用户未指定卷数。请根据目标字数、世界观、故事核心、主线阶段和已有卷进度合理决定后续卷数；不得套用固定 2 卷或其他固定值。')
  }
  return appendUserConstraint(messages, constraints.join('\n'))
}

/** 将卷展开为章节大纲 */
export function buildChapterOutlinePrompt(
  volumeTitle: string,
  volumeSummary: string,
  worldContext: string,
  prevVolumeSummary: string,
  userHint?: string,
  options?: RunOptions,
  characterContext?: string,
  /** Phase 32: 世界规则清单 */
  worldRulesContext?: string,
): ChatMessage[] {
  const tpl = usePromptStore.getState().getActive('outline.chapter')
  const { messages } = renderPrompt(tpl, {
    volumeTitle,
    volumeSummary,
    worldContext: worldContext || '（暂无）',
    prevVolumeSummary: prevVolumeSummary || '（这是第一卷）',
    characterContext: characterContext || '',
    worldRulesContext: worldRulesContext || '',
    userHint,
  }, options)
  // CF-3：章纲必须服从本卷 summary 所承载的主线方向，不得另起支线压过主线。
  return appendUserConstraint(
    messages,
    '【主线一致性·硬约束】本卷大纲已承载故事主线，章纲必须服从本卷 summary 的主线方向：每章 summary 说明它推进了本卷/主线的哪一步；可以有支线，但不得另起或让支线压过主线。',
  )
}

/** 补全一个已存在的空章节章纲，不重建整卷。 */
export function buildSingleChapterOutlinePrompt(
  volumeTitle: string,
  volumeSummary: string,
  chapterTitle: string,
  siblingChaptersContext: string,
  worldContext: string,
  prevVolumeSummary: string,
  userHint?: string,
  options?: RunOptions,
  characterContext?: string,
  worldRulesContext?: string,
): ChatMessage[] {
  const messages = buildChapterOutlinePrompt(
    volumeTitle,
    volumeSummary,
    worldContext,
    prevVolumeSummary,
    userHint,
    {
      ...options,
      parameterValues: {
        ...(options?.parameterValues ?? {}),
        chaptersPerVolume: 1,
      },
    },
    characterContext,
    worldRulesContext,
  )
  return appendUserConstraint(messages, `【本次单章补全硬约束】
本次不是重建整卷，只补全现有空章节《${chapterTitle}》的章纲。
${siblingChaptersContext || '本卷暂无其他章节可供衔接。'}
只输出 1 个 JSON 元素；title 必须保持为“${chapterTitle}”，summary 用 1-3 句写清本章事件、冲突、推进作用与结尾衔接，不得生成其他章节。`)
}
