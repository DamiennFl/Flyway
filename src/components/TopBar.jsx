export default function TopBar({ sidebarOpen, onToggleSidebar, trendsOpen, onToggleTrends }) {
  return (
    <div className="topbar">
      <button type="button" className={sidebarOpen ? 'active' : ''} onClick={onToggleSidebar}>
        View species on map
      </button>
      <button type="button" className={trendsOpen ? 'active' : ''} onClick={onToggleTrends}>
        View trends per species
      </button>
    </div>
  )
}
