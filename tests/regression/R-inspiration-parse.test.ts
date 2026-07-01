import { describe, it, expect } from 'vitest'
import { parseReverseOutput } from '../../src/lib/ai/inspiration-reverse'

// 一份最小可用的反推 JSON（字段可空，解析器只要能取到对象即可）
const REVERSE_JSON = {
  worldview: { worldOrigin: '灵界崩塌', powerHierarchy: '灵阶九品' },
  storyCore: { logline: '少年逆袭', theme: '成长', centralConflict: '与灵界世家的世仇' },
  characters: [
    { name: '林尘', roleWeight: 'main', moralAxis: 'neutral', orderAxis: 'lawful', personality: '坚韧' },
  ],
}
const JSON_STR = JSON.stringify(REVERSE_JSON)

describe('R-inspiration-parse（灵感反推解析健壮性 · 社区反馈"第一遍不出来"根因）', () => {
  it('纯 JSON → 解析成功', () => {
    const r = parseReverseOutput(JSON_STR)
    expect(r).not.toBeNull()
    expect(r!.worldview.worldOrigin).toBe('灵界崩塌')
    expect(r!.characters).toHaveLength(1)
  })

  it('```json 围栏包裹 → 解析成功', () => {
    const r = parseReverseOutput('这是你要的设定：\n```json\n' + JSON_STR + '\n```\n希望满意~')
    expect(r).not.toBeNull()
    expect(r!.storyCore.logline).toBe('少年逆袭')
  })

  it('带前后文、无围栏（旧代码会 JSON.parse 失败→null→第一遍不显示）→ 现在能解析', () => {
    const r = parseReverseOutput('好的，以下是根据你的灵感反推的结果：\n' + JSON_STR + '\n\n如需调整请告诉我。')
    expect(r).not.toBeNull()                       // ← 这是本次修复的关键断言
    expect(r!.worldview.worldOrigin).toBe('灵界崩塌')
    expect(r!.characters[0].name).toBe('林尘')
  })

  it('未闭合围栏（被 maxTokens 截断）→ 尽量修复解析，不直接崩', () => {
    // 截断到 characters 之前但结构可修复
    const truncated = '```json\n{"worldview":{"worldOrigin":"灵界崩塌"},"storyCore":{"logline":"少年逆袭"},"characters":[]'
    const r = parseReverseOutput(truncated)
    expect(r).not.toBeNull()
    expect(r!.worldview.worldOrigin).toBe('灵界崩塌')
  })

  it('完全不是 JSON（模型拒答）→ 返回 null，不抛异常', () => {
    expect(parseReverseOutput('抱歉，我无法根据这个灵感生成设定。')).toBeNull()
    expect(parseReverseOutput('')).toBeNull()
  })
})
