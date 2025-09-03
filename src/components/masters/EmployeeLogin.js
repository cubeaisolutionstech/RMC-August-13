"use client"

import { useState, useEffect } from "react"

const EmployeeLogin = () => {
  const [employees, setEmployees] = useState([])
  const [branches, setBranches] = useState([])
  const [roles, setRoles] = useState([])
  const [loginCredentials, setLoginCredentials] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    employeeId: "",
    branchId: "",
    loginId: "",
    password: "",
    confirmPassword: "",
    roleId: "",
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [employeesRes, branchesRes, rolesRes, credentialsRes] = await Promise.all([
        fetch("http://localhost:5000/employees"),
        fetch("http://localhost:5000/branches"),
        fetch("http://localhost:5000/roles"),
        fetch("http://localhost:5000/employee-login"),
      ])

      const employeesData = await employeesRes.json()
      const branchesData = await branchesRes.json()
      const rolesData = await rolesRes.json()
      const credentialsData = await credentialsRes.json()

      setEmployees(employeesData)
      setBranches(branchesData)
      setRoles(rolesData)
      setLoginCredentials(credentialsData)
    } catch (error) {
      console.error("Error fetching data:", error)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.employeeId) newErrors.employeeId = "User selection is required"
    if (!formData.branchId) newErrors.branchId = "Branch selection is required"
    if (!formData.loginId.trim()) newErrors.loginId = "Login ID is required"
    if (!formData.password.trim()) newErrors.password = "Password is required"
    if (formData.password.length < 6) newErrors.password = "Password must be at least 6 characters"
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }
    if (!formData.roleId) newErrors.roleId = "Role selection is required"

    // Check if login ID already exists
    const existingCredential = loginCredentials.find((cred) => cred.login_id === formData.loginId)
    if (existingCredential) {
      newErrors.loginId = "Login ID already exists"
    }

    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const formErrors = validateForm()

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    const payload = {
      employeeId: Number.parseInt(formData.employeeId),
      branchId: Number.parseInt(formData.branchId),
      loginId: formData.loginId,
      password: formData.password,
      roleId: Number.parseInt(formData.roleId),
    }

    try {
      await fetch("http://localhost:5000/employee-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      fetchData()
      resetForm()
    } catch (error) {
      console.error("Error saving login credentials:", error)
    }
  }

  const resetForm = () => {
    setFormData({
      employeeId: "",
      branchId: "",
      loginId: "",
      password: "",
      confirmPassword: "",
      roleId: "",
    })
    setErrors({})
    setShowForm(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this login credential?")) {
      try {
        await fetch(`http://localhost:5000/employee-login/${id}`, {
          method: "DELETE",
        })
        fetchData()
      } catch (error) {
        console.error("Error deleting credential:", error)
      }
    }
  }

  const getEmployeeName = (employeeId) => {
    const employee = employees.find((emp) => emp.id === Number.parseInt(employeeId))
    return employee ? employee.fullName : "Unknown"
  }

  const getBranchName = (branchId) => {
    const branch = branches.find((br) => br.id === Number.parseInt(branchId))
    return branch ? branch.branchName : "Unknown"
  }

  const getRoleName = (roleId) => {
    const role = roles.find((r) => r.id === Number.parseInt(roleId))
    return role ? role.roleName : "Unknown"
  }

  return (
    <div className="employee-login">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">🔐</div>
          <h2>User Login Setup</h2>
        </div>
        <button className="btn btn-add" onClick={() => setShowForm(true)}>
          ➕ Create Login
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create User Login</h3>
              <button className="close-btn" onClick={resetForm}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Select User *</label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className={errors.employeeId ? "error" : ""}
                  >
                    <option value="">Select User</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name} - {employee.designation}
                      </option>
                    ))}
                  </select>
                  {errors.employeeId && <span className="error-text">{errors.employeeId}</span>}
                </div>

                <div className="form-group">
                  <label>Select Branch *</label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className={errors.branchId ? "error" : ""}
                  >
                    <option value="">Select Branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.branch_name}
                      </option>
                    ))}
                  </select>
                  {errors.branchId && <span className="error-text">{errors.branchId}</span>}
                </div>

                <div className="form-group">
                  <label>Login ID *</label>
                  <input
                    type="text"
                    value={formData.loginId}
                    onChange={(e) => setFormData({ ...formData, loginId: e.target.value })}
                    className={errors.loginId ? "error" : ""}
                    placeholder="Enter unique login ID"
                  />
                  {errors.loginId && <span className="error-text">{errors.loginId}</span>}
                </div>

                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={errors.password ? "error" : ""}
                    placeholder="Enter password"
                  />
                  {errors.password && <span className="error-text">{errors.password}</span>}
                </div>

                <div className="form-group">
                  <label>Confirm Password *</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={errors.confirmPassword ? "error" : ""}
                    placeholder="Confirm password"
                  />
                  {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
                </div>

                <div className="form-group">
                  <label>Select Role *</label>
                  <select
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    className={errors.roleId ? "error" : ""}
                  >
                    <option value="">Select Role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                  {errors.roleId && <span className="error-text">{errors.roleId}</span>}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-cancel" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-save">
                  Save Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="credentials-table">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>User Name</th>
              <th>Branch</th>
              <th>Login ID</th>
              <th>Role</th>
              <th>Created Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loginCredentials.map((credential, index) => (
              <tr key={credential.id}>
                <td>{index + 1}</td>
                <td>{credential.employee_name}</td>
                <td>{credential.branch_name}</td>
                <td>{credential.login_id}</td>
                <td>{credential.role_name}</td>
                <td>{new Date(credential.created_at).toLocaleDateString()}</td>
                <td>
                  <span className={`status ${credential.status.toLowerCase()}`}>{credential.status}</span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-delete"
                      onClick={() => handleDelete(credential.id)}
                      title="Delete Credential"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loginCredentials.length === 0 && (
          <div className="no-data">
            <p>No login credentials found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default EmployeeLogin
