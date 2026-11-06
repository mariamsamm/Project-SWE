/** One statistic box at the top of a dashboard (used by organizer and admin). */
function DashboardCard({ label, value, note }) {
  return (
    <article className="dashboard-card">
      <h2>{label}</h2>
      <p className="dashboard-card__value">{value.toLocaleString("en-GB")}</p>
      {note && <p className="dashboard-card__note">{note}</p>}
    </article>
  )
}

export default DashboardCard
