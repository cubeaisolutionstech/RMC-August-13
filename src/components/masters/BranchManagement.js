"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const BranchManagement = () => {
  const [branches, setBranches] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingBranch, setEditingBranch] = useState(null)
  const [formData, setFormData] = useState({
    branchName: "",
    address: "",
    contactNumber: "",
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    fetchBranches()
  }, [])

  const fetchBranches = async () => {
    try {
      const response = await fetch("http://localhost:5000/branches")
      const data = await response.json()
      setBranches(data)
    } catch (error) {
      console.error("Error fetching branches:", error)
    }
  }

  const saveBranches = (branchList) => {
    localStorage.setItem("branches", JSON.stringify(branchList))
    setBranches(branchList)
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.branchName.trim()) newErrors.branchName = "Branch name is required"
    if (!formData.address.trim()) newErrors.address = "Address is required"
    if (!formData.contactNumber.trim()) newErrors.contactNumber = "Contact number is required"

    const phoneRegex = /^[0-9]{10}$/
    if (formData.contactNumber && !phoneRegex.test(formData.contactNumber)) {
      newErrors.contactNumber = "Contact number must be 10 digits"
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
      branchName: formData.branchName,
      address: formData.address,
      contactNumber: formData.contactNumber,
    }

    try {
      if (editingBranch) {
        await fetch(`http://localhost:5000/branches/${editingBranch.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch("http://localhost:5000/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      fetchBranches()
      resetForm()
    } catch (error) {
      console.error("Error saving branch:", error)
    }
  }

  const resetForm = () => {
    setFormData({
      branchName: "",
      address: "",
      contactNumber: "",
    })
    setErrors({})
    setShowForm(false)
    setEditingBranch(null)
  }

  const handleEdit = (branch) => {
    setFormData({
      branchName: branch.branch_name,
      address: branch.address,
      contactNumber: branch.contact_number,
    })
    setEditingBranch(branch)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this branch?")) {
      try {
        await fetch(`http://localhost:5000/branches/${id}`, {
          method: "DELETE",
        })
        fetchBranches()
      } catch (error) {
        console.error("Error deleting branch:", error)
      }
    }
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(branches)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Branches")
    XLSX.writeFile(workbook, "branches.xlsx")
  }

  return (
    <div className="branch-management">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">🏢</div>
          <h2>Branch Management</h2>
        </div>
        <div className="header-actions">
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
          <button className="btn btn-add" onClick={() => setShowForm(true)}>
            ➕ Add Branch
          </button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingBranch ? "Edit Branch" : "Add New Branch"}</h3>
              <button className="close-btn" onClick={resetForm}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="branch-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Branch Name *</label>
                  <input
                    type="text"
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                    className={errors.branchName ? "error" : ""}
                    placeholder="Enter branch name"
                  />
                  {errors.branchName && <span className="error-text">{errors.branchName}</span>}
                </div>

                <div className="form-group">
                  <label>Contact Number *</label>
                  <input
                    type="tel"
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    className={errors.contactNumber ? "error" : ""}
                    placeholder="Enter contact number"
                    maxLength="10"
                  />
                  {errors.contactNumber && <span className="error-text">{errors.contactNumber}</span>}
                </div>

                <div className="form-group full-width">
                  <label>Address *</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={errors.address ? "error" : ""}
                    placeholder="Enter branch address"
                    rows="4"
                  />
                  {errors.address && <span className="error-text">{errors.address}</span>}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-cancel" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-save">
                  {editingBranch ? "Update" : "Save"} Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="branches-table">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Branch Name</th>
              <th>Address</th>
              <th>Contact Number</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch, index) => (
              <tr key={branch.id}>
                <td>{index + 1}</td>
                <td>{branch.branch_name}</td>
                <td>{branch.address}</td>
                <td>{branch.contact_number}</td>
                <td>{new Date(branch.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-edit" onClick={() => handleEdit(branch)} title="Edit Branch">
                      ✏️
                    </button>
                    <button className="btn btn-delete" onClick={() => handleDelete(branch.id)} title="Delete Branch">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {branches.length === 0 && (
          <div className="no-data">
            <p>No branches found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default BranchManagement
