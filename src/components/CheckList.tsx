import type { CheckResult } from '../types'
import { Badge } from './ui'

export function CheckList({ checks }: { checks: CheckResult[] }) {
  return (
    <ol className="checks">
      {checks.map((check, i) => (
        <li
          key={check.id}
          className="check fade-in"
          style={{ animationDelay: `${i * 45}ms` }}
        >
          <span className="check__index">{check.index}</span>
          <div>
            <p className="check__label">{check.label}</p>
            <p className="check__detail">{check.detail}</p>
          </div>
          <Badge status={check.status}>{check.badge}</Badge>
        </li>
      ))}
    </ol>
  )
}
