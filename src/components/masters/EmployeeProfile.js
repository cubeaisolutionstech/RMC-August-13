"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const EmployeeProfile = () => {
  const [employees, setEmployees] = useState([])
  const [filteredEmployees, setFilteredEmployees] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("All")
  const [filterDepartment, setFilterDepartment] = useState("All")
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      const response = await fetch("http://localhost:5000/employees")
      const data = await response.json()
      setEmployees(data)
      setFilteredEmployees(data)
    } catch (error) {
      console.error("Error fetching employees:", error)
    }
  }

  useEffect(() => {
    let filtered = employees

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (emp) =>
          emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.email_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.department.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Filter by status
    if (filterStatus !== "All") {
      filtered = filtered.filter((emp) => emp.status === filterStatus)
    }

    // Filter by department
    if (filterDepartment !== "All") {
      filtered = filtered.filter((emp) => emp.department === filterDepartment)
    }

    setFilteredEmployees(filtered)
  }, [employees, searchTerm, filterStatus, filterDepartment])

  const getDepartments = () => {
    const departments = [...new Set(employees.map((emp) => emp.department))]
    return departments.filter((dept) => dept)
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredEmployees)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employee Profiles")
    XLSX.writeFile(workbook, "employee_profiles.xlsx")
  }

  const exportToPDF = () => {
    // Simple PDF export using print functionality
    const printWindow = window.open("", "_blank")
    const tableHTML = document.querySelector(".employees-table").outerHTML

    printWindow.document.write(`
      <html>
        <head>
          <title>Employee Profiles</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .status.active { color: green; }
            .status.inactive { color: red; }
          </style>
        </head>
        <body>
          <h1>User Profiles Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          ${tableHTML}
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.print()
  }

  const viewProfile = (employee) => {
    setSelectedEmployee(employee)
    setShowProfile(true)
  }

  const calculateAge = (dateOfBirth) => {
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }

  const calculateTenure = (joiningDate) => {
    const today = new Date()
    const joinDate = new Date(joiningDate)
    const diffTime = Math.abs(today - joinDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const years = Math.floor(diffDays / 365)
    const months = Math.floor((diffDays % 365) / 30)

    return `${years} years, ${months} months`
  }

  return (
    <div className="employee-profile">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">📋</div>
          <h2>User Profiles</h2>
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
        <div className="filters-container">
          <div className="search-container"></div>

          <div className="custom-filters">
            <div className="custom-select-wrapper">
              <label className="select-label">Status</label>
              <div className="custom-select">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="enhanced-select"
                >
                  <option value="All">All Status</option>
                  <option value="Active">✅ Active</option>
                  <option value="Inactive">❌ Inactive</option>
                </select>
                <span className="select-arrow">▼</span>
              </div>
            </div>

            <div className="custom-select-wrapper">
              <label className="select-label">Department</label>
              <div className="custom-select">
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="enhanced-select"
                >
                  <option value="All">All Departments</option>
                  {getDepartments().map((dept) => (
                    <option key={dept} value={dept}>
                      🏢 {dept}
                    </option>
                  ))}
                </select>
                <span className="select-arrow">▼</span>
              </div>
            </div>

            <div className="filter-actions">
              <button
                className="btn btn-clear-filters"
                onClick={() => {
                  setSearchTerm("")
                  setFilterStatus("All")
                  setFilterDepartment("All")
                }}
              >
                🗑️ Clear All
              </button>
              <div className="results-badge">{filteredEmployees.length} Results</div>
            </div>
          </div>
        </div>
      </div>

      <div className="employees-table">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Designation</th>
              <th>Department</th>
              <th>Joining Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((employee, index) => (
              <tr key={employee.id}>
                <td>{index + 1}</td>
                <td>{employee.full_name}</td>
                <td>{employee.email_id}</td>
                <td>{employee.phone_number}</td>
                <td>{employee.designation}</td>
                <td>{employee.department}</td>
                <td>{new Date(employee.joining_date).toLocaleDateString()}</td>
                <td>
                  <span className={`status ${employee.status.toLowerCase()}`}>{employee.status}</span>
                </td>
                <td>
                  <button className="btn btn-view" onClick={() => viewProfile(employee)} title="View Profile">
                    👁️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredEmployees.length === 0 && (
          <div className="no-data">
            <p>No Users found matching the criteria</p>
          </div>
        )}
      </div>

      {showProfile && selectedEmployee && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h3>User Profile - {selectedEmployee.full_name}</h3>
              <button className="close-btn" onClick={() => setShowProfile(false)}>
                ✕
              </button>
            </div>

            <div className="profile-content">
              <div className="profile-section">
                <h4>Personal Information</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <label>Full Name:</label>
                    <span>{selectedEmployee.full_name}</span>
                  </div>
                  <div className="profile-item">
                    <label>Date of Birth:</label>
                    <span>
                      {new Date(selectedEmployee.date_of_birth).toLocaleDateString()} (
                      {calculateAge(selectedEmployee.date_of_birth)} years)
                    </span>
                  </div>
                  <div className="profile-item">
                    <label>Gender:</label>
                    <span>{selectedEmployee.gender}</span>
                  </div>
                  <div className="profile-item">
                    <label>Phone Number:</label>
                    <span>{selectedEmployee.phone_number}</span>
                  </div>
                  <div className="profile-item">
                    <label>Email ID:</label>
                    <span>{selectedEmployee.email_id}</span>
                  </div>
                  <div className="profile-item full-width">
                    <label>Address:</label>
                    <span>{selectedEmployee.address}</span>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <h4>Identity Information</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <label>Aadhar Number:</label>
                    <span>{selectedEmployee.aadhar_number}</span>
                  </div>
                  <div className="profile-item">
                    <label>PAN Number:</label>
                    <span>{selectedEmployee.pan_number}</span>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <h4>Employment Information</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <label>Joining Date:</label>
                    <span>{new Date(selectedEmployee.joining_date).toLocaleDateString()}</span>
                  </div>
                  <div className="profile-item">
                    <label>Tenure:</label>
                    <span>{calculateTenure(selectedEmployee.joining_date)}</span>
                  </div>
                  <div className="profile-item">
                    <label>Designation:</label>
                    <span>{selectedEmployee.designation}</span>
                  </div>
                  <div className="profile-item">
                    <label>Department:</label>
                    <span>{selectedEmployee.department}</span>
                  </div>
                  <div className="profile-item">
                    <label>Status:</label>
                    <span className={`status ${selectedEmployee.status.toLowerCase()}`}>{selectedEmployee.status}</span>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <h4>Emergency Contact</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <label>Emergency Contact:</label>
                    <span>{selectedEmployee.emergency_contact}</span>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <h4>System Information</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <label>Created Date:</label>
                    <span>{new Date(selectedEmployee.created_at).toLocaleString()}</span>
                  </div>
                  {selectedEmployee.updated_at && (
                    <div className="profile-item">
                      <label>Last Updated:</label>
                      <span>{new Date(selectedEmployee.updated_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeeProfile
