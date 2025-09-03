"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const RoleManagement = () => {
  const [roles, setRoles] = useState([])
  const [employees, setEmployees] = useState([])
  const [designations, setDesignations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tableLoading, setTableLoading] = useState(true)
  const [formData, setFormData] = useState({
    role_name: "",
    permissions: {
      employees: { add: false, update: false, delete: false },
      branches: { add: false, update: false, delete: false },
      projects: { add: false, update: false, delete: false },
      vehicles: { add: false, update: false, delete: false },
      suppliers: { add: false, update: false, delete: false },
      po: { add: false, update: false, delete: false },
      grn: { add: false, update: false, delete: false },
      logs: { add: false, update: false, delete: false },
    },
  })
  const [errors, setErrors] = useState({})

  const API_BASE_URL = "http://localhost:5000"

  const modules = [
    { key: "employees", name: "Employee Management" },
    { key: "branches", name: "Branch Management" },
    { key: "projects", name: "Project Management" },
    { key: "vehicles", name: "Vehicle Entry" },
    { key: "suppliers", name: "Supplier Details" },
    { key: "po", name: "Purchase Orders" },
    { key: "grn", name: "GRN Management" },
    { key: "logs", name: "System Logs" },
  ]

  useEffect(() => {
    fetchRoles()
    fetchEmployees()
  }, [])

  const fetchRoles = async () => {
    try {
      setTableLoading(true)
      const response = await fetch(`${API_BASE_URL}/roles`)
      if (response.ok) {
        const data = await response.json()
        setRoles(data)
      } else {
        console.error("Failed to fetch roles")
        alert("Failed to fetch roles")
      }
    } catch (error) {
      console.error("Error fetching roles:", error)
      alert("Error fetching roles")
    } finally {
      setTableLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/employees`)
      if (response.ok) {
        const data = await response.json()
        setEmployees(data)

        // Extract unique designations
        const uniqueDesignations = [...new Set(data.map((emp) => emp.designation).filter(Boolean))]
        setDesignations(uniqueDesignations)
      }
    } catch (error) {
      console.error("Error fetching employees:", error)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.role_name.trim()) {
      newErrors.role_name = "Role name is required"
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

    setLoading(true)

    try {
      // Convert permissions to text format for storage
      const permissionsText = convertPermissionsToText(formData.permissions)

      const roleData = {
        role_name: formData.role_name,
        permissions: permissionsText,
      }

      let response
      if (editingRole) {
        response = await fetch(`${API_BASE_URL}/roles/${editingRole.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(roleData),
        })
      } else {
        response = await fetch(`${API_BASE_URL}/roles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(roleData),
        })
      }

      if (response.ok) {
        alert(editingRole ? "Role updated successfully!" : "Role created successfully!")
        resetForm()
        fetchRoles()
      } else {
        const errorData = await response.json()
        alert(errorData.error || "Failed to save role")
      }
    } catch (error) {
      console.error("Error saving role:", error)
      alert("Error saving role")
    } finally {
      setLoading(false)
    }
  }

  const convertPermissionsToText = (permissions) => {
    const permissionTexts = []
    Object.entries(permissions).forEach(([module, perms]) => {
      const activePerms = Object.entries(perms).filter(([_, value]) => value === true)
      if (activePerms.length > 0) {
        const moduleName = modules.find((m) => m.key === module)?.name || module
        const permissionList = activePerms.map(([perm]) => perm).join(", ")
        permissionTexts.push(`${moduleName}: ${permissionList}`)
      }
    })
    return permissionTexts.join(" | ")
  }

  const convertTextToPermissions = (permissionsText) => {
    const defaultPermissions = {
      employees: { add: false, update: false, delete: false },
      branches: { add: false, update: false, delete: false },
      projects: { add: false, update: false, delete: false },
      vehicles: { add: false, update: false, delete: false },
      suppliers: { add: false, update: false, delete: false },
      po: { add: false, update: false, delete: false },
      grn: { add: false, update: false, delete: false },
      logs: { add: false, update: false, delete: false },
    }

    if (!permissionsText || typeof permissionsText !== "string") {
      return defaultPermissions
    }

    try {
      // First try to parse as JSON (for backward compatibility)
      const jsonPermissions = JSON.parse(permissionsText)
      if (typeof jsonPermissions === "object") {
        return { ...defaultPermissions, ...jsonPermissions }
      }
    } catch (e) {
      // If not JSON, parse as text format
      const parts = permissionsText.split(" | ")
      parts.forEach((part) => {
        const [moduleName, permissions] = part.split(": ")
        if (moduleName && permissions) {
          const moduleKey = modules.find((m) => m.name === moduleName)?.key
          if (moduleKey) {
            const perms = permissions.split(", ")
            perms.forEach((perm) => {
              if (defaultPermissions[moduleKey] && defaultPermissions[moduleKey].hasOwnProperty(perm)) {
                defaultPermissions[moduleKey][perm] = true
              }
            })
          }
        }
      })
    }

    return defaultPermissions
  }

  const resetForm = () => {
    setFormData({
      role_name: "",
      permissions: {
        employees: { add: false, update: false, delete: false },
        branches: { add: false, update: false, delete: false },
        projects: { add: false, update: false, delete: false },
        vehicles: { add: false, update: false, delete: false },
        suppliers: { add: false, update: false, delete: false },
        po: { add: false, update: false, delete: false },
        grn: { add: false, update: false, delete: false },
        logs: { add: false, update: false, delete: false },
      },
    })
    setErrors({})
    setShowForm(false)
    setEditingRole(null)
  }

  const handleEdit = (role) => {
    const permissions = convertTextToPermissions(role.permissions)

    setFormData({
      role_name: role.role_name,
      permissions: permissions,
    })
    setEditingRole(role)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this role?")) {
      try {
        const response = await fetch(`${API_BASE_URL}/roles/${id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          alert("Role deleted successfully!")
          fetchRoles()
        } else {
          const errorData = await response.json()
          alert(errorData.error || "Failed to delete role")
        }
      } catch (error) {
        console.error("Error deleting role:", error)
        alert("Error deleting role")
      }
    }
  }

  const handlePermissionChange = (module, action, value) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [module]: {
          ...prev.permissions[module],
          [action]: value,
        },
      },
    }))
  }

  const exportToExcel = () => {
    const exportData = roles.map((role, index) => ({
      "S.No": index + 1,
      "Role Name": role.role_name,
      Permissions: role.permissions || "No permissions assigned",
      "Created Date": new Date(role.created_at).toLocaleDateString(),
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Roles")
    XLSX.writeFile(workbook, "roles.xlsx")
  }

  const getPermissionsSummary = (permissions) => {
    if (!permissions || permissions === "") {
      return "No permissions assigned"
    }
    return permissions
  }

  return (
    <div className="role-management">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">👔</div>
          <h2>Role Management</h2>
        </div>
        <div className="header-actions">
          <button className="btn btn-export" onClick={exportToExcel} disabled={roles.length === 0}>
            📊 Export Excel
          </button>
          <button className="btn btn-add" onClick={() => setShowForm(true)}>
            ➕ Add Role
          </button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h3>{editingRole ? "Edit Role" : "Add New Role"}</h3>
              <button className="close-btn" onClick={resetForm}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="role-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Role Name *</label>
                  <select
                    value={formData.role_name}
                    onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                    className={errors.role_name ? "error" : ""}
                    disabled={loading}
                  >
                    <option value="">Select from available designations</option>
                    {designations.map((designation, index) => (
                      <option key={index} value={designation}>
                        {designation}
                      </option>
                    ))}
                  </select>
                  {errors.role_name && <span className="error-text">{errors.role_name}</span>}
                </div>
              </div>

              <div className="permissions-section">
                <h4>Access Control</h4>
                <div className="permissions-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Module</th>
                        <th>Add</th>
                        <th>Update</th>
                        <th>Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((module) => (
                        <tr key={module.key}>
                          <td>{module.name}</td>
                          <td>
                            <input
                              type="checkbox"
                              checked={formData.permissions[module.key]?.add || false}
                              onChange={(e) => handlePermissionChange(module.key, "add", e.target.checked)}
                              disabled={loading}
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={formData.permissions[module.key]?.update || false}
                              onChange={(e) => handlePermissionChange(module.key, "update", e.target.checked)}
                              disabled={loading}
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={formData.permissions[module.key]?.delete || false}
                              onChange={(e) => handlePermissionChange(module.key, "delete", e.target.checked)}
                              disabled={loading}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-cancel" onClick={resetForm} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-save" disabled={loading}>
                  {loading ? "Saving..." : editingRole ? "Update" : "Save"} Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="roles-table">
        {tableLoading ? (
          <div className="loading-message">Loading roles...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Role Name</th>
                <th>Permissions Summary</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role, index) => (
                <tr key={role.id}>
                  <td>{index + 1}</td>
                  <td>{role.role_name}</td>
                  <td style={{ maxWidth: "300px", wordWrap: "break-word", fontSize: "12px" }}>
                    {getPermissionsSummary(role.permissions)}
                  </td>
                  <td>{new Date(role.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-edit" onClick={() => handleEdit(role)} title="Edit Role">
                        ✏️
                      </button>
                      <button className="btn btn-delete" onClick={() => handleDelete(role.id)} title="Delete Role">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!tableLoading && roles.length === 0 && (
          <div className="no-data">
            <p>No roles found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RoleManagement
