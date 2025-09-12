"use client"

import { useState } from "react"

const Sidebar = ({ activeSection, setActiveSection, collapsed, setCollapsed }) => {
  const [expandedMenus, setExpandedMenus] = useState({
    masters: true,
    inward: false,
  })

  const toggleMenu = (menu) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }))
  }

  const menuItems = [
    {
      id: "masters",
      title: "Masters",
      icon: "⚙️",
      submenu: [
        { id: "add-employee", title: "Add User", icon: "👤" },
        { id: "employee-login", title: "User Login", icon: "🔐" },
        { id: "branch", title: "Branch", icon: "🏢" },
        { id: "project", title: "Project", icon: "🏗️" },
        { id: "role", title: "Role", icon: "👔" },
        { id: "employee-profile", title: "User Profile", icon: "📋" },
      ],
    },
    {
      id: "inward",
      title: "Inward Entry",
      icon: "📥",
      submenu: [
        { id: "vehicle-entry", title: "Vehicle Entry", icon: "🚛" },
        //{ id: "po-details", title: "PO Details", icon: "📋" },
        { id: "intent", title: "Intent", icon: "📝" },
        { id: "purchase-order", title: "Purchase Order", icon: "📋" },
        { id: "grn", title: "GRN", icon: "📊" },
        { id: "supplier-detail", title: "Upload Supplier Detail", icon: "📄" },
        //{ id: "supplier-payment-details", title: "Supplier Payment Details", icon: "💰" },
        
        //{ id: "batch-slip-details", title: "Batch Management", icon: "📋" },
        //{ id: "create-batch-slip", title: "Create Batch Slip", icon: "📝" },
        //{ id: "invoices", title: "Invoices", icon: "🧾" },
        //{ id: "invoice-payment-details", title: "Invoice Payment Details", icon: "💳" },
        //{ id: "inventory-management", title: "Inventory Dashboard", icon: "📦" },
      ],
    },
       {
      id: "Outward",
      title: "Outward",
      icon: "📥",
      submenu: [
        //{ id: "vehicle-entry", title: "Vehicle Entry", icon: "🚛" },
        //{ id: "po-details", title: "PO Details", icon: "📋" },
        //{ id: "intent", title: "Intent", icon: "📝" },
        //{ id: "purchase-order", title: "Purchase Order", icon: "📋" },
        //{ id: "grn", title: "GRN", icon: "📊" },
        //{ id: "supplier-detail", title: "Upload Supplier Detail", icon: "📄" },
        //{ id: "supplier-payment-details", title: "Supplier Payment Details", icon: "💰" },
        { id: "batch-slip-details", title: "Client Batch Management", icon: "📋" },
        //{ id: "create-batch-slip", title: "Create Batch Slip", icon: "📝" },
        { id: "invoices", title: "Client Invoices", icon: "🧾" },
        //{ id: "invoice-payment-details", title: "Invoice Payment Details", icon: "💳" },
        //{ id: "inventory-management", title: "Inventory Dashboard", icon: "📦" },
      ],
    },
   
  ]

  return (
    <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className={`logo-icon-small ${collapsed ? "collapsed-logo" : ""}`}>
            <svg
              width={collapsed ? "40" : "80"}
              height={collapsed ? "40" : "80"}
              viewBox="0 0 80 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="logoPattern" patternUnits="userSpaceOnUse" width="80" height="80">
                  <image href="/logo.png" x="0" y="0" width="80" height="80" preserveAspectRatio="xMidYMid slice" />
                </pattern>
              </defs>
              <circle cx="40" cy="40" r="40" fill="url(#logoPattern)" />
            </svg>
          </div>
          {!collapsed && (
            <div className="logo-text-sidebar">
              <span className="logo-title">RR Builders</span>
              <span className="logo-subtitle">Construction Co.</span>
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-nav-container">
        <nav className="sidebar-nav">
          <div
            className={`nav-item ${activeSection === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveSection("dashboard")}
          >
            <span className="nav-icon">🏠</span>
            {!collapsed && <span className="nav-text">Dashboard</span>}
          </div>

          {menuItems.map((item) => (
            <div key={item.id} className="nav-group">
              {item.single ? (
                <div
                  className={`nav-item ${activeSection === item.id ? "active" : ""}`}
                  onClick={() => setActiveSection(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && <span className="nav-text">{item.title}</span>}
                </div>
              ) : (
                <>
                  <div
                    className={`nav-item parent ${expandedMenus[item.id] ? "expanded" : ""}`}
                    onClick={() => !collapsed && toggleMenu(item.id)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="nav-text">{item.title}</span>
                        <span className={`expand-icon ${expandedMenus[item.id] ? "rotated" : ""}`}>▼</span>
                      </>
                    )}
                  </div>

                  {!collapsed && expandedMenus[item.id] && (
                    <div className="submenu">
                      {item.submenu.map((subItem) => (
                        <div
                          key={subItem.id}
                          className={`nav-item sub ${activeSection === subItem.id ? "active" : ""}`}
                          onClick={() => setActiveSection(subItem.id)}
                        >
                          <span className="nav-icon">{subItem.icon}</span>
                          <span className="nav-text">{subItem.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </nav>
      </div>
    </div>
  )
}

export default Sidebar
