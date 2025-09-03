"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const Logs = () => {
  const [logs, setLogs] = useState([])
  const [filteredLogs, setFilteredLogs] = useState([])
  const [branches, setBranches] = useState([])
  const [materialData, setMaterialData] = useState([])
  const [filteredMaterialData, setFilteredMaterialData] = useState([])
  const [isLoadingMaterial, setIsLoadingMaterial] = useState(false)
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    branch: "All",
    user: "",
    module: "All",
    action: "All",
  })

  const [materialFilters, setMaterialFilters] = useState({
    dateFrom: "",
    dateTo: "",
    partyName: "",
    grade: "All",
    pb: "All",
  })

  const modules = [
    "Employee Management",
    "Branch Management",
    "Project Management",
    "Role Management",
    "Vehicle Entry",
    "Supplier Details",
    "PO Details",
    "GRN Management",
    "System",
  ]

  const actions = ["Add", "Update", "Delete", "Inaction", "Login", "Logout", "View", "Export"]

  // Reset logs every 2 days
  const resetLogsIfNeeded = () => {
    const lastResetDate = localStorage.getItem("logsLastReset")
    const currentDate = new Date().getTime()
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000 // 2 days in milliseconds

    if (!lastResetDate || currentDate - Number.parseInt(lastResetDate) > twoDaysInMs) {
      // Reset logs
      localStorage.removeItem("systemLogs")
      localStorage.setItem("logsLastReset", currentDate.toString())
      generateSampleLogs()
      console.log("Logs reset after 2 days")
    }
  }

  useEffect(() => {
    resetLogsIfNeeded()

    // Load logs and branches from localStorage
    const savedLogs = localStorage.getItem("systemLogs")
    const savedBranches = localStorage.getItem("branches")

    if (savedLogs) {
      const logData = JSON.parse(savedLogs)
      setLogs(logData)
      setFilteredLogs(logData)
    } else {
      // Generate sample logs for demonstration
      generateSampleLogs()
    }

    if (savedBranches) {
      setBranches(JSON.parse(savedBranches))
    }
  }, [])

  const generateSampleLogs = () => {
    const sampleLogs = [
      {
        id: 1,
        sno: 1,
        branchName: "Main Branch",
        moduleName: "Employee Management",
        actionPerformed: "Add",
        actionBy: "admin",
        actionOn: "John Doe Employee Record",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        ipAddress: "192.168.1.100",
      },
      {
        id: 2,
        sno: 2,
        branchName: "Main Branch",
        moduleName: "System",
        actionPerformed: "Login",
        actionBy: "admin",
        actionOn: "System Login",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        ipAddress: "192.168.1.100",
      },
      {
        id: 3,
        sno: 3,
        branchName: "Branch A",
        moduleName: "Vehicle Entry",
        actionPerformed: "Add",
        actionBy: "user1",
        actionOn: "Vehicle Entry Record",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        ipAddress: "192.168.1.101",
      },
    ]

    setLogs(sampleLogs)
    setFilteredLogs(sampleLogs)
    localStorage.setItem("systemLogs", JSON.stringify(sampleLogs))
  }

  const formatExcelDate = (excelDate) => {
    if (typeof excelDate === "number") {
      // Excel date serial number
      const date = new Date((excelDate - 25569) * 86400 * 1000)
      return date.toISOString().split("T")[0]
    } else if (typeof excelDate === "string") {
      // Try to parse as date string
      const date = new Date(excelDate)
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0]
      }
    }
    return ""
  }

  // Load Material Data from Excel
  const loadMaterialDataFromExcel = async () => {
    setIsLoadingMaterial(true)
    try {
      // Try to fetch from public folder first
      const response = await fetch("/full_concrete_delivery_log.xlsx")
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        // Skip header row and transform data
        const headers = jsonData[0]
        const dataRows = jsonData.slice(1)

        const transformedData = dataRows
          .map((row, index) => {
            const rowData = {}
            headers.forEach((header, colIndex) => {
              rowData[header] = row[colIndex] || ""
            })

            return {
              id: index + 1,
              sno: index + 1,
              date: rowData["Date"] ? formatExcelDate(rowData["Date"]) : "",
              partyName: rowData["Party Name"] || "",
              pb: rowData["P/B"] || "",
              grade: rowData["Grade"] || "",
              qty: Number.parseFloat(rowData["Qty"]) || 0,
              rate: Number.parseFloat(rowData["Rate"]) || 0,
              billNo: rowData["Bill No"] || "",
              billDate: rowData["Bill Date"] ? formatExcelDate(rowData["Bill Date"]) : "",
              cement: Number.parseFloat(rowData["Cement"]) || 0,
              silo2: Number.parseFloat(rowData["Silo 2"]) || 0,
              mm20: Number.parseFloat(rowData["20MM"]) || 0,
              mm12: Number.parseFloat(rowData["12MM"]) || 0,
              mSand: Number.parseFloat(rowData["M.Sand"]) || 0,
              admixTrue: Number.parseFloat(rowData["Admix True"]) || 0,
              flyAshUsage: Number.parseFloat(rowData["Fly Ash Usage"]) || 0,
              remark: rowData["Remark"] || "",
            }
          })
          .filter((item) => item.partyName) // Filter out empty rows

        setMaterialData(transformedData)
        setFilteredMaterialData(transformedData)
        localStorage.setItem("concreteDeliveryData", JSON.stringify(transformedData))
        alert(`Successfully loaded ${transformedData.length} records from full_concrete_delivery_log.xlsx`)
      } else {
        throw new Error("File not found in public folder")
      }
    } catch (error) {
      console.error("Auto-load failed, opening file picker:", error)
      // Fallback to file picker
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".xlsx,.xls"
      input.onchange = handleMaterialFileSelect
      input.click()
    } finally {
      setIsLoadingMaterial(false)
    }
  }

  const handleMaterialFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: "array" })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

          // Skip header row and transform data
          const headers = jsonData[0]
          const dataRows = jsonData.slice(1)

          const transformedData = dataRows
            .map((row, index) => {
              const rowData = {}
              headers.forEach((header, colIndex) => {
                rowData[header] = row[colIndex] || ""
              })

              return {
                id: index + 1,
                sno: index + 1,
                date: rowData["Date"] ? formatExcelDate(rowData["Date"]) : "",
                partyName: rowData["Party Name"] || "",
                pb: rowData["P/B"] || "",
                grade: rowData["Grade"] || "",
                qty: Number.parseFloat(rowData["Qty"]) || 0,
                rate: Number.parseFloat(rowData["Rate"]) || 0,
                billNo: rowData["Bill No"] || "",
                billDate: rowData["Bill Date"] ? formatExcelDate(rowData["Bill Date"]) : "",
                cement: Number.parseFloat(rowData["Cement"]) || 0,
                silo2: Number.parseFloat(rowData["Silo 2"]) || 0,
                mm20: Number.parseFloat(rowData["20MM"]) || 0,
                mm12: Number.parseFloat(rowData["12MM"]) || 0,
                mSand: Number.parseFloat(rowData["M.Sand"]) || 0,
                admixTrue: Number.parseFloat(rowData["Admix True"]) || 0,
                flyAshUsage: Number.parseFloat(rowData["Fly Ash Usage"]) || 0,
                remark: rowData["Remark"] || "",
              }
            })
            .filter((item) => item.partyName) // Filter out empty rows

          setMaterialData(transformedData)
          setFilteredMaterialData(transformedData)
          localStorage.setItem("concreteDeliveryData", JSON.stringify(transformedData))
          alert(`Successfully loaded ${transformedData.length} records from ${file.name}`)
        } catch (error) {
          console.error("Error parsing Excel file:", error)
          alert(
            "Error reading Excel file. Please ensure it's a valid Excel file (.xlsx or .xls) with the correct column headers.",
          )
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }

  useEffect(() => {
    let filtered = logs

    // Filter by date range
    if (filters.dateFrom) {
      filtered = filtered.filter((log) => new Date(log.timestamp) >= new Date(filters.dateFrom))
    }

    if (filters.dateTo) {
      filtered = filtered.filter((log) => new Date(log.timestamp) <= new Date(filters.dateTo + "T23:59:59"))
    }

    // Filter by branch
    if (filters.branch !== "All") {
      filtered = filtered.filter((log) => log.branchName === filters.branch)
    }

    // Filter by user
    if (filters.user) {
      filtered = filtered.filter((log) => log.actionBy.toLowerCase().includes(filters.user.toLowerCase()))
    }

    // Filter by module
    if (filters.module !== "All") {
      filtered = filtered.filter((log) => log.moduleName === filters.module)
    }

    // Filter by action
    if (filters.action !== "All") {
      filtered = filtered.filter((log) => log.actionPerformed === filters.action)
    }

    setFilteredLogs(filtered)
  }, [logs, filters])

  useEffect(() => {
    let filtered = materialData

    // Filter by date range
    if (materialFilters.dateFrom) {
      filtered = filtered.filter((item) => new Date(item.date) >= new Date(materialFilters.dateFrom))
    }

    if (materialFilters.dateTo) {
      filtered = filtered.filter((item) => new Date(item.date) <= new Date(materialFilters.dateTo))
    }

    // Filter by party name
    if (materialFilters.partyName) {
      filtered = filtered.filter((item) =>
        item.partyName.toLowerCase().includes(materialFilters.partyName.toLowerCase()),
      )
    }

    // Filter by grade
    if (materialFilters.grade !== "All") {
      filtered = filtered.filter((item) => item.grade === materialFilters.grade)
    }

    // Filter by P/B
    if (materialFilters.pb !== "All") {
      filtered = filtered.filter((item) => item.pb === materialFilters.pb)
    }

    setFilteredMaterialData(filtered)
  }, [materialData, materialFilters])

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const clearFilters = () => {
    setFilters({
      dateFrom: "",
      dateTo: "",
      branch: "All",
      user: "",
      module: "All",
      action: "All",
    })
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredLogs)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "System Logs")
    XLSX.writeFile(workbook, "system_logs.xlsx")
  }

  const exportMaterialToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredMaterialData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Concrete Delivery Data")
    XLSX.writeFile(workbook, "concrete_delivery_data.xlsx")
  }

  const exportToPDF = () => {
    const printWindow = window.open("", "_blank")
    const tableHTML = document.querySelector(".logs-table").outerHTML

    printWindow.document.write(`
      <html>
        <head>
          <title>System Logs Report</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f2f2f2; }
            .action-add { color: green; }
            .action-update { color: blue; }
            .action-delete { color: red; }
            .action-login { color: purple; }
          </style>
        </head>
        <body>
          <h1>System Logs Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <p>Total Records: ${filteredLogs.length}</p>
          ${tableHTML}
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.print()
  }

  const getActionClass = (action) => {
    switch (action.toLowerCase()) {
      case "add":
        return "action-add"
      case "update":
        return "action-update"
      case "delete":
        return "action-delete"
      case "login":
        return "action-login"
      case "logout":
        return "action-logout"
      default:
        return "action-default"
    }
  }

  return (
    <div className="logs">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">📝</div>
          <h2>System Logs</h2>
        </div>
        <div className="header-actions">
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
          <button className="btn btn-export" onClick={exportToPDF}>
            📄 Export PDF
          </button>
        </div>
      </div>

      <div className="filters-section">
        <div className="advanced-filters">
          <div className="filter-row">
            <div className="date-range-container">
              <div className="date-input-wrapper">
                <label className="date-label">📅 From Date</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                  className="enhanced-date-input"
                />
              </div>
              <div className="date-separator">→</div>
              <div className="date-input-wrapper">
                <label className="date-label">📅 To Date</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                  className="enhanced-date-input"
                />
              </div>
            </div>
          </div>

          <div className="filter-row">
            <div className="custom-select-wrapper">
              <label className="select-label">🏢 Branch</label>
              <div className="custom-select">
                <select
                  value={filters.branch}
                  onChange={(e) => handleFilterChange("branch", e.target.value)}
                  className="enhanced-select"
                >
                  <option value="All">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.branchName}>
                      🏢 {branch.branchName}
                    </option>
                  ))}
                </select>
                <span className="select-arrow">▼</span>
              </div>
            </div>

            <div className="custom-select-wrapper">
              <label className="select-label">📋 Module</label>
              <div className="custom-select">
                <select
                  value={filters.module}
                  onChange={(e) => handleFilterChange("module", e.target.value)}
                  className="enhanced-select"
                >
                  <option value="All">All Modules</option>
                  {modules.map((module) => (
                    <option key={module} value={module}>
                      📋 {module}
                    </option>
                  ))}
                </select>
                <span className="select-arrow">▼</span>
              </div>
            </div>

            <div className="custom-select-wrapper">
              <label className="select-label">⚡ Action</label>
              <div className="custom-select">
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange("action", e.target.value)}
                  className="enhanced-select"
                >
                  <option value="All">All Actions</option>
                  {actions.map((action) => (
                    <option key={action} value={action}>
                      {action === "Add" && "➕"}
                      {action === "Update" && "✏️"}
                      {action === "Delete" && "🗑️"}
                      {action === "Login" && "🔐"}
                      {action === "Logout" && "🚪"}
                      {action === "View" && "👁️"}
                      {action === "Export" && "📊"}
                      {action === "Inaction" && "⏸️"}
                      {action}
                    </option>
                  ))}
                </select>
                <span className="select-arrow">▼</span>
              </div>
            </div>
          </div>

          <div className="filter-actions-row">
            <button className="btn btn-clear-all" onClick={clearFilters}>
              🗑️ Clear All Filters
            </button>
            <div className="filter-summary">
              <span className="results-badge">
                📊 {filteredLogs.length} of {logs.length} records
              </span>
              <div className="active-filters">
                {Object.entries(filters).filter(([key, value]) => value && value !== "All" && value !== "").length >
                  0 && (
                  <span className="active-filters-count">
                    🔍{" "}
                    {Object.entries(filters).filter(([key, value]) => value && value !== "All" && value !== "").length}{" "}
                    filters active
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="logs-table">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Branch Name</th>
              <th>Module Name</th>
              <th>Action Performed</th>
              <th>Action By</th>
              <th>Action On</th>
              <th>Timestamp</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log, index) => (
              <tr key={log.id}>
                <td>{index + 1}</td>
                <td>{log.branchName}</td>
                <td>{log.moduleName}</td>
                <td>
                  <span className={`action-badge ${getActionClass(log.actionPerformed)}`}>{log.actionPerformed}</span>
                </td>
                <td>{log.actionBy}</td>
                <td>{log.actionOn}</td>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
                <td>{log.ipAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredLogs.length === 0 && (
          <div className="no-data">
            <p>No logs found matching the selected criteria</p>
          </div>
        )}
      </div>

      <div className="logs-summary">
        <div className="summary-cards">
          <div className="summary-card">
            <h4>Total Logs</h4>
            <span className="summary-number">{logs.length}</span>
          </div>
          <div className="summary-card">
            <h4>Filtered Results</h4>
            <span className="summary-number">{filteredLogs.length}</span>
          </div>
          <div className="summary-card">
            <h4>Today's Logs</h4>
            <span className="summary-number">
              {logs.filter((log) => new Date(log.timestamp).toDateString() === new Date().toDateString()).length}
            </span>
          </div>
          <div className="summary-card">
            <h4>Active Users</h4>
            <span className="summary-number">{[...new Set(logs.map((log) => log.actionBy))].length}</span>
          </div>
        </div>
      </div>
      <br />
      {/* Concrete Delivery Data Section */}
      <div className="concrete-delivery-section">
        <div className="section-header">
          <div className="section-title">
            <div className="section-icon">🚛</div>
            <h2>Concrete Delivery Log</h2>
          </div>
          <div className="header-actions">
            <button
              className={`btn btn-load-material ${isLoadingMaterial ? "loading" : ""}`}
              onClick={loadMaterialDataFromExcel}
              disabled={isLoadingMaterial}
            >
              {isLoadingMaterial ? "⏳ Loading..." : "📋 Load Delivery Data"}
            </button>
            <button className="btn btn-export" onClick={exportMaterialToExcel}>
              📊 Export Delivery Data
            </button>
          </div>
        </div>

        <div className="concrete-delivery-table">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Party Name</th>
                <th>P/B</th>
                <th>Grade</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Bill No</th>
                <th>Bill Date</th>
                <th>Cement</th>
                <th>Silo 2</th>
                <th>20MM</th>
                <th>12MM</th>
                <th>M.Sand</th>
                <th>Admix True</th>
                <th>Fly Ash Usage</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterialData.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{new Date(item.date).toLocaleDateString()}</td>
                  <td>{item.partyName}</td>
                  <td>
                    <span className={`pb-badge ${item.pb === "P" ? "pb-purchase" : "pb-billing"}`}>{item.pb}</span>
                  </td>
                  <td>
                    <span className="grade-badge">{item.grade}</span>
                  </td>
                  <td className="qty-cell">{item.qty}</td>
                  <td className="rate-cell">₹{item.rate.toLocaleString()}</td>
                  <td>{item.billNo}</td>
                  <td>{new Date(item.billDate).toLocaleDateString()}</td>
                  <td className="material-qty">{item.cement}</td>
                  <td className="material-qty">{item.silo2}</td>
                  <td className="material-qty">{item.mm20}</td>
                  <td className="material-qty">{item.mm12}</td>
                  <td className="material-qty">{item.mSand}</td>
                  <td className="material-qty">{item.admixTrue}</td>
                  <td className="material-qty">{item.flyAshUsage}</td>
                  <td className="remark-cell">{item.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredMaterialData.length === 0 && (
            <div className="no-data">
              <p>No concrete delivery data found. Click "Load Delivery Data" to import from Excel file.</p>
            </div>
          )}
        </div>

        <div className="concrete-delivery-summary">
          <div className="summary-cards">
            <div className="summary-card">
              <h4>Total Records</h4>
              <span className="summary-number">{materialData.length}</span>
            </div>
            <div className="summary-card">
              <h4>Total Quantity</h4>
              <span className="summary-number">{filteredMaterialData.reduce((sum, item) => sum + item.qty, 0)}</span>
            </div>
            <div className="summary-card">
              <h4>Total Value</h4>
              <span className="summary-number">
                ₹{filteredMaterialData.reduce((sum, item) => sum + item.qty * item.rate, 0).toLocaleString()}
              </span>
            </div>
            <div className="summary-card">
              <h4>Unique Parties</h4>
              <span className="summary-number">
                {[...new Set(filteredMaterialData.map((item) => item.partyName))].length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Logs
