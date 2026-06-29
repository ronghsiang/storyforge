import type { Character } from '../../lib/types'
import { dimensionsByGroup, type CharacterDimensionKey } from '../../lib/character/character-dimensions'

interface Props {
  character: Character
  onChange: (patch: Partial<Character>) => void
  /** 行内已显示、此处不重复的维度（如 NPC 行已有 简介/地点） */
  exclude?: CharacterDimensionKey[]
}

/**
 * 角色完整维度的展示/编辑区(共享)——按 CHARACTER_DIMENSIONS 分组渲染。
 * NPC / 次要 / 路人 / 主要面板复用,让 AI 生成的完整内容在各自页面都能看到、能改。
 * 加一个维度只改 CHARACTER_DIMENSIONS + FIELD_REGISTRY,这里自动出现。
 */
export default function CharacterDimensionFields({ character, onChange, exclude = [] }: Props) {
  const skip = new Set<CharacterDimensionKey>(exclude)
  return (
    <div className="space-y-3">
      {dimensionsByGroup().map(({ group, dims }) => {
        const shown = dims.filter(d => !skip.has(d.key))
        if (!shown.length) return null
        return (
          <div key={group}>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted/70">{group}</div>
            <div className="space-y-1.5">
              {shown.map(d => (
                <div key={d.key} className="flex gap-2">
                  <span className="w-20 flex-shrink-0 pt-1.5 text-xs text-text-muted">{d.label}</span>
                  <textarea
                    value={(character[d.key] as string) || ''}
                    onChange={e => onChange({ [d.key]: e.target.value } as Partial<Character>)}
                    placeholder={`${d.label}…`}
                    rows={d.rows}
                    className="flex-1 px-2 py-1 bg-bg-base border border-border rounded text-xs text-text-primary resize-y focus:outline-none focus:border-accent"
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
