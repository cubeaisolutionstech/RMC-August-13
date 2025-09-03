"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    gender: "",
    phoneNumber: "",
    emailId: "",
    address: "",
    aadharNumber: "",
    panNumber: "",
    joiningDate: "",
    designation: "",
    department: "",
    emergencyContact: "",
    status: "Active",
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    fetchEmployees()
  }, [])

  const normalizeEmployee = (emp) => ({
    id: emp.id,
    fullName: emp.full_name,
    dateOfBirth: emp.date_of_birth,
    gender: emp.gender,
    phoneNumber: emp.phone_number,
    emailId: emp.email_id,
    address: emp.address,
    aadharNumber: emp.aadhar_number,
    panNumber: emp.pan_number,
    joiningDate: emp.joining_date,
    designation: emp.designation,
    department: emp.department,
    emergencyContact: emp.emergency_contact,
    status: emp.status,
    createdAt: emp.created_at,
    updatedAt: emp.updated_at,
  })

  const fetchEmployees = async () => {
    try {
      const response = await fetch("http://localhost:5000/employees")
      const data = await response.json()
      const normalized = data.map(normalizeEmployee)
      setEmployees(normalized)
    } catch (error) {
      console.error("Error fetching employees:", error)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required"
    if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required"
    if (!formData.gender) newErrors.gender = "Gender is required"
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = "Phone number is required"
    if (!formData.emailId.trim()) newErrors.emailId = "Email is required"
    if (!formData.address.trim()) newErrors.address = "Address is required"
    if (!formData.aadharNumber.trim()) newErrors.aadharNumber = "Aadhar number is required"
    if (!formData.panNumber.trim()) newErrors.panNumber = "PAN number is required"
    if (!formData.joiningDate) newErrors.joiningDate = "Joining date is required"
    if (!formData.designation.trim()) newErrors.designation = "Designation is required"
    if (!formData.department.trim()) newErrors.department = "Department is required"
    if (!formData.emergencyContact.trim()) newErrors.emergencyContact = "Emergency contact is required"

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.emailId && !emailRegex.test(formData.emailId)) {
      newErrors.emailId = "Invalid email format"
    }

    const phoneRegex = /^[0-9]{10}$/
    if (formData.phoneNumber && !phoneRegex.test(formData.phoneNumber)) {
      newErrors.phoneNumber = "Phone number must be 10 digits"
    }

    const aadharRegex = /^[0-9]{12}$/
    if (formData.aadharNumber && !aadharRegex.test(formData.aadharNumber)) {
      newErrors.aadharNumber = "Aadhar number must be 12 digits"
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
    if (formData.panNumber && !panRegex.test(formData.panNumber)) {
      newErrors.panNumber = "Invalid PAN format"
    }

    return newErrors
  }

 const handleStatusToggle = async (id) => {
  const employee = employees.find((emp) => emp.id === id)
  const newStatus = employee.status === "Active" ? "Inactive" : "Active"

  try {
    console.log(`Toggling status for ID ${id} to ${newStatus}`)

    const response = await fetch(`http://localhost:5000/employees/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })

    const result = await response.json()
    console.log("Backend response:", result)

    if (response.ok) {
      fetchEmployees() // refresh table
    } else {
      console.error("Failed to update status", result)
    }
  } catch (error) {
    console.error("Error toggling status:", error)
  }
}


  const handleSubmit = async (e) => {
    e.preventDefault()
    const formErrors = validateForm()

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    const newEmployee = {
      ...formData,
      id: editingEmployee ? editingEmployee.id : Date.now(),
      createdAt: editingEmployee ? editingEmployee.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const payload = {
      ...formData,
      joiningDate: new Date(formData.joiningDate).toISOString().slice(0, 10),
      dateOfBirth: new Date(formData.dateOfBirth).toISOString().slice(0, 10),
    }

    if (editingEmployee) {
      await fetch(`http://localhost:5000/employees/${editingEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch("http://localhost:5000/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    }

    fetchEmployees()
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      fullName: "",
      dateOfBirth: "",
      gender: "",
      phoneNumber: "",
      emailId: "",
      address: "",
      aadharNumber: "",
      panNumber: "",
      joiningDate: "",
      designation: "",
      department: "",
      emergencyContact: "",
      status: "Active",
    })
    setErrors({})
    setShowForm(false)
    setEditingEmployee(null)
  }

  const handleEdit = (employee) => {
    setFormData({ ...employee })
    setEditingEmployee(employee)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await fetch(`http://localhost:5000/employees/${id}`, {
          method: "DELETE",
        })
        fetchEmployees()
      } catch (error) {
        console.error("Error deleting employee:", error)
      }
    }
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(employees)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users")
    XLSX.writeFile(workbook, "users.xlsx")
  }

  const filteredEmployees = employees.filter((emp) => {
    const term = searchTerm.toLowerCase()
    return (
      (emp.fullName || "").toLowerCase().includes(term) ||
      (emp.emailId || "").toLowerCase().includes(term) ||
      (emp.designation || "").toLowerCase().includes(term)
    )
  })

  return (
    <div className="employee-management">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">👥</div>
          <h2>User Management</h2>
        </div>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
          <button className="btn btn-add" onClick={() => setShowForm(true)}>
            ➕ Add User
          </button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingEmployee ? "Edit User" : "Add New User"}</h3>
              <button className="close-btn" onClick={resetForm}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="employee-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className={errors.fullName ? "error" : ""}
                  />
                  {errors.fullName && <span className="error-text">{errors.fullName}</span>}
                </div>

                <div className="form-group">
                  <label>Date of Birth *</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className={errors.dateOfBirth ? "error" : ""}
                  />
                  {errors.dateOfBirth && <span className="error-text">{errors.dateOfBirth}</span>}
                </div>

                <div className="form-group">
                  <label>Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className={errors.gender ? "error" : ""}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && <span className="error-text">{errors.gender}</span>}
                </div>

                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className={errors.phoneNumber ? "error" : ""}
                  />
                  {errors.phoneNumber && <span className="error-text">{errors.phoneNumber}</span>}
                </div>

                <div className="form-group">
                  <label>Email ID *</label>
                  <input
                    type="email"
                    value={formData.emailId}
                    onChange={(e) => setFormData({ ...formData, emailId: e.target.value })}
                    className={errors.emailId ? "error" : ""}
                  />
                  {errors.emailId && <span className="error-text">{errors.emailId}</span>}
                </div>

                <div className="form-group full-width">
                  <label>Address *</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={errors.address ? "error" : ""}
                    rows="3"
                  />
                  {errors.address && <span className="error-text">{errors.address}</span>}
                </div>

                <div className="form-group">
                  <label>Aadhar Number *</label>
                  <input
                    type="text"
                    value={formData.aadharNumber}
                    onChange={(e) => setFormData({ ...formData, aadharNumber: e.target.value })}
                    className={errors.aadharNumber ? "error" : ""}
                    maxLength="12"
                  />
                  {errors.aadharNumber && <span className="error-text">{errors.aadharNumber}</span>}
                </div>

                <div className="form-group">
                  <label>PAN Number *</label>
                  <input
                    type="text"
                    value={formData.panNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        panNumber: e.target.value.toUpperCase(),
                      })
                    }
                    className={errors.panNumber ? "error" : ""}
                    maxLength="10"
                  />
                  {errors.panNumber && <span className="error-text">{errors.panNumber}</span>}
                </div>

                <div className="form-group">
                  <label>Joining Date *</label>
                  <input
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                    className={errors.joiningDate ? "error" : ""}
                  />
                  {errors.joiningDate && <span className="error-text">{errors.joiningDate}</span>}
                </div>

                <div className="form-group">
                  <label>Designation *</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className={errors.designation ? "error" : ""}
                  />
                  {errors.designation && <span className="error-text">{errors.designation}</span>}
                </div>

                <div className="form-group">
                  <label>Department *</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className={errors.department ? "error" : ""}
                  />
                  {errors.department && <span className="error-text">{errors.department}</span>}
                </div>

                <div className="form-group">
                  <label>Emergency Contact *</label>
                  <input
                    type="tel"
                    value={formData.emergencyContact}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: e.target.value,
                      })
                    }
                    className={errors.emergencyContact ? "error" : ""}
                  />
                  {errors.emergencyContact && <span className="error-text">{errors.emergencyContact}</span>}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-cancel" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-save">
                  {editingEmployee ? "Update" : "Save"} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((employee, index) => (
              <tr key={employee.id}>
                <td>{index + 1}</td>
                <td>{employee.fullName}</td>
                <td>{employee.emailId}</td>
                <td>{employee.phoneNumber}</td>
                <td>{employee.designation}</td>
                <td>{employee.department}</td>
                <td>
                  <span className={`status ${employee.status.toLowerCase()}`}>{employee.status}</span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-edit" onClick={() => handleEdit(employee)} title="Edit User">
                      ✏️
                    </button>
                    <button className="btn btn-delete" onClick={() => handleDelete(employee.id)} title="Delete User">
                      🗑️
                    </button>
                    <button
                      className={`btn ${employee.status === "Active" ? "btn-inactive" : "btn-active"}`}
                      onClick={() => handleStatusToggle(employee.id)}
                      title={employee.status === "Active" ? "Deactivate" : "Activate"}
                    >
                      {employee.status === "Active" ? "⏸️" : "▶️"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredEmployees.length === 0 && (
          <div className="no-data">
            <p>No users found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default EmployeeManagement
