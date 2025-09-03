"use client"

import { useState } from "react"

const Header = ({ user, onLogout, toggleSidebar }) => {
  const [showUserMenu, setShowUserMenu] = useState(false)

  return (
    <header className="header">
      <div className="header-left">
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          ☰
        </button>
        <div className="header-logo">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="logoPattern" patternUnits="userSpaceOnUse" width="80" height="80">
      <image
        href="/logo.png"
        x="0"
        y="0"
        width="80"
        height="80"
        preserveAspectRatio="xMidYMid slice"
      />
    </pattern>
  </defs>
  <circle cx="40" cy="40" r="40" fill="url(#logoPattern)" />
</svg>

          <h1 className="page-title">RR Builders</h1>
        </div>
      </div>

      <div className="header-right">
        <div className="header-time">
          <span className="current-time">{new Date().toLocaleTimeString()}</span>
        </div>
        <div className="user-info">
          <span className="welcome-text">Welcome, {user.username}</span>
          <div className="user-menu-container">
            <button className="user-avatar" onClick={() => setShowUserMenu(!showUserMenu)}>
              👤
            </button>

            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-details">
                  <p>
                    <strong>{user.username}</strong>
                  </p>
                  <p className="user-role">{user.role}</p>
                </div>
                <hr />
                <button className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                  Profile Settings
                </button>
                <button className="dropdown-item logout" onClick={onLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
