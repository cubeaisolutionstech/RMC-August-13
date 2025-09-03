"use client"

import { useState, useEffect } from "react"

const InventoryManagement = () => {
  // Sample data - replace with real data from your API
  const [dashboardData, setDashboardData] = useState({
    totalPO: 0,
    finishedPO: 0,
    pendingPO: 0,
    totalClientOrders: 0,
    finishedClientOrders: 0,
    pendingClientOrders: 0,
  })

  useEffect(() => {
    fetchInventoryStats()
  }, [])

  const fetchInventoryStats = async () => {
    try {
      const response = await fetch("http://localhost:5000/inventory/stats")
      const data = await response.json()
      setDashboardData(data)
    } catch (error) {
      console.error("Error fetching inventory stats:", error)
    }
  }

  const [materialData] = useState([
    { name: "Cement", quantity: 500, unit: "bags", pending: 50, icon: "🏗️" },
    { name: "Steel Bars", quantity: 200, unit: "tons", pending: 0, icon: "🔩" },
    { name: "Bricks", quantity: 100, unit: "pieces", pending: 2000, icon: "🧱" },
    { name: "Sand", quantity: 150, unit: "cubic meters", pending: 25, icon: "⏳" },
    { name: "Gravel", quantity: 100, unit: "cubic meters", pending: 0, icon: "🪨" },
    { name: "Paint", quantity: 80, unit: "liters", pending: 15, icon: "🎨" },
    { name: "Tiles", quantity: 500, unit: "sq meters", pending: 100, icon: "⬜" },
    { name: "Wood", quantity: 50, unit: "cubic meters", pending: 10, icon: "🪵" },
  ])

  // Calculate chart data for order statistics
  const orderChartData = [
    { label: "Total PO", value: dashboardData.totalPO, color: "#3b82f6" },
    { label: "Finished PO", value: dashboardData.finishedPO, color: "#10b981" },
    { label: "Pending PO", value: dashboardData.pendingPO, color: "#f59e0b" },
    { label: "Total Client Orders", value: dashboardData.totalClientOrders, color: "#8b5cf6" },
    { label: "Finished Client Orders", value: dashboardData.finishedClientOrders, color: "#06b6d4" },
    { label: "Pending Client Orders", value: dashboardData.pendingClientOrders, color: "#ef4444" },
  ]

  // Get max value for chart scaling
  const maxOrderValue = Math.max(...orderChartData.map((item) => item.value))
  const maxMaterialValue = Math.max(...materialData.map((item) => item.quantity))

  return (
    <div className="inventory-management">
      {/* Page Header */}
      <div className="section-header">
        <h2>Inventory Dashboard</h2>
        <div className="header-actions">
          <button className="btn btn-export">📊 Export Report</button>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="inventory-dashboard">
        <h3>Overview</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
              📋
            </div>
            <div className="stat-info">
              <h3>Total Purchase Orders</h3>
              <div className="stat-number">{dashboardData.totalPO}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "linear-gradient(135deg, #10b981, #047857)" }}>
              ✅
            </div>
            <div className="stat-info">
              <h3>Finished Purchase Orders</h3>
              <div className="stat-number">{dashboardData.finishedPO}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
              ⏳
            </div>
            <div className="stat-info">
              <h3>Pending Purchase Orders</h3>
              <div className="stat-number">{dashboardData.pendingPO}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}>
              👥
            </div>
            <div className="stat-info">
              <h3>Total Client Orders</h3>
              <div className="stat-number">{dashboardData.totalClientOrders}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}>
              ✨
            </div>
            <div className="stat-info">
              <h3>Finished Client Orders</h3>
              <div className="stat-number">{dashboardData.finishedClientOrders}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}>
              📝
            </div>
            <div className="stat-info">
              <h3>Pending Client Orders</h3>
              <div className="stat-number">{dashboardData.pendingClientOrders}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Commenting out the Order Statistics Chart section
      <div className="chart-section">
        <h3>Order Statistics</h3>
        <div className="chart-container">
          <div className="y-axis-label">Number of Orders</div>
          <div className="chart-content">
            <div className="chart-bars">
              {orderChartData.map((item, index) => (
                <div key={index} className="bar-container">
                  <div
                    className="bar order-bar"
                    style={{
                      height: `${(item.value / maxOrderValue) * 200}px`,
                      background: `linear-gradient(135deg, ${item.color}, ${item.color}dd)`,
                    }}
                  >
                    <span className="bar-value">{item.value}</span>
                  </div>
                  <div className="bar-label">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="x-axis-label">Order Categories</div>
          </div>
        </div>
      </div>
      */}

      {/* Commenting out the Material Quantities Chart section
      <div className="chart-section">
        <h3>Material Quantities</h3>
        <div className="chart-container">
          <div className="y-axis-label">Quantity</div>
          <div className="chart-content">
            <div className="chart-bars">
              {materialData.map((material, index) => (
                <div key={index} className="bar-container">
                  <div
                    className="bar material-bar"
                    style={{
                      height: `${(material.quantity / maxMaterialValue) * 150}px`,
                      background: "linear-gradient(135deg, #667eea, #764ba2)",
                    }}
                  >
                    <span className="bar-value">{material.quantity}</span>
                  </div>
                  <div className="bar-label">
                    <span className="material-icon">{material.icon}</span>
                    <br />
                    {material.name}
                  </div>
                </div>
              ))}
            </div>
            <div className="x-axis-label">Materials</div>
          </div>
        </div>
      </div>
      */}

      {/* Commenting out the Materials Table section
      <div className="materials-section">
        <div className="section-header">
          <h3>Material Inventory</h3>
          <div className="header-actions">
            <input type="text" placeholder="Search materials..." className="search-input" />
            <button className="btn btn-csv">📄 Export CSV</button>
          </div>
        </div>

        <div className="materials-table">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Quantity</th>
                <th>Pending Quantity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {materialData.map((material, index) => (
                <tr key={index}>
                  <td>
                    <div className="material-info">
                      <span className="material-icon">{material.icon}</span>
                      <strong>{material.name}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="quantity-value">{material.quantity.toLocaleString()}</span>
                    <span className="unit-text"> {material.unit}</span>
                  </td>
                  <td>
                    {material.pending > 0 ? (
                      <span className="pending-quantity">
                        {material.pending.toLocaleString()} {material.unit}
                      </span>
                    ) : (
                      <span className="no-pending">No pending</span>
                    )}
                  </td>
                  <td>
                    <span className={`status ${material.pending > 0 ? "pending" : "available"}`}>
                      {material.pending > 0 ? "Pending" : "Available"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      */}
    </div>
  )
}

export default InventoryManagement