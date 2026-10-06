export default function TopBar({ sidebarOpen, onToggleSidebar, trendsOpen, onToggleTrends }) {
  return (
    <div className="topbar">
      <button type="button" className={sidebarOpen ? 'active' : ''} onClick={onToggleSidebar}>
        View Species on Map
      </button>
      <button type="button" className={trendsOpen ? 'active' : ''} onClick={onToggleTrends}>
        View Trends per Species
      </button>
    </div>
  )
}
