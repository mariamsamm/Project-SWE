import { STATUS_LABELS } from "../utils/format"

function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-badge--${status.toLowerCase()}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default StatusBadge
