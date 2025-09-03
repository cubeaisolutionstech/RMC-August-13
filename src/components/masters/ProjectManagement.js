"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const ProjectManagement = () => {
  const [projects, setProjects] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    projectName: "",
    address: "",
    latitude: "",
    longitude: "",
  })
  const [errors, setErrors] = useState({})

  const API_BASE_URL = "http://localhost:5000"

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/projects`)
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      } else {
        console.error("Failed to fetch projects")
      }
    } catch (error) {
      console.error("Error fetching projects:", error)
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.projectName.trim()) newErrors.projectName = "Project name is required"
    if (!formData.address.trim()) newErrors.address = "Address is required"
    if (!formData.latitude.trim()) newErrors.latitude = "Latitude is required"
    if (!formData.longitude.trim()) newErrors.longitude = "Longitude is required"

    // Validate latitude and longitude
    const lat = Number.parseFloat(formData.latitude)
    const lng = Number.parseFloat(formData.longitude)

    if (isNaN(lat) || lat < -90 || lat > 90) {
      newErrors.latitude = "Latitude must be between -90 and 90"
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      newErrors.longitude = "Longitude must be between -180 and 180"
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

    try {
      setLoading(true)
      const projectData = {
        project_name: formData.projectName,
        address: formData.address,
        latitude: Number.parseFloat(formData.latitude),
        longitude: Number.parseFloat(formData.longitude),
      }

      let response
      if (editingProject) {
        // Update existing project
        response = await fetch(`${API_BASE_URL}/projects/${editingProject.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(projectData),
        })
      } else {
        // Create new project
        response = await fetch(`${API_BASE_URL}/projects`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(projectData),
        })
      }

      if (response.ok) {
        await fetchProjects() // Refresh the projects list
        resetForm()
        alert(editingProject ? "Project updated successfully!" : "Project created successfully!")
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error || "Failed to save project"}`)
      }
    } catch (error) {
      console.error("Error saving project:", error)
      alert("Error saving project. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      projectName: "",
      address: "",
      latitude: "",
      longitude: "",
    })
    setErrors({})
    setShowForm(false)
    setEditingProject(null)
  }

  const handleEdit = (project) => {
    setFormData({
      projectName: project.project_name,
      address: project.address,
      latitude: project.latitude.toString(),
      longitude: project.longitude.toString(),
    })
    setEditingProject(project)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      try {
        setLoading(true)
        const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          await fetchProjects() // Refresh the projects list
          alert("Project deleted successfully!")
        } else {
          const errorData = await response.json()
          alert(`Error: ${errorData.error || "Failed to delete project"}`)
        }
      } catch (error) {
        console.error("Error deleting project:", error)
        alert("Error deleting project. Please try again.")
      } finally {
        setLoading(false)
      }
    }
  }

  const exportToExcel = () => {
    const exportData = projects.map((project, index) => ({
      "S.No": index + 1,
      "Project Name": project.project_name,
      Address: project.address,
      Latitude: project.latitude,
      Longitude: project.longitude,
      "Created Date": new Date(project.created_at).toLocaleDateString(),
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Projects")
    XLSX.writeFile(workbook, "projects.xlsx")
  }

  const openInMaps = (latitude, longitude) => {
    const url = `https://www.google.com/maps?q=${latitude},${longitude}`
    window.open(url, "_blank")
  }

  return (
    <div className="project-management">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">🏗️</div>
          <h2>Project Management</h2>
        </div>
        <div className="header-actions">
          <button className="btn btn-export" onClick={exportToExcel} disabled={loading || projects.length === 0}>
            📊 Export Excel
          </button>
          <button className="btn btn-add" onClick={() => setShowForm(true)} disabled={loading}>
            ➕ Add Project
          </button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingProject ? "Edit Project" : "Add New Project"}</h3>
              <button className="close-btn" onClick={resetForm} disabled={loading}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="project-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Project Name *</label>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    className={errors.projectName ? "error" : ""}
                    placeholder="Enter project name"
                    disabled={loading}
                  />
                  {errors.projectName && <span className="error-text">{errors.projectName}</span>}
                </div>

                <div className="form-group full-width">
                  <label>Address *</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={errors.address ? "error" : ""}
                    placeholder="Enter project address"
                    rows="4"
                    disabled={loading}
                  />
                  {errors.address && <span className="error-text">{errors.address}</span>}
                </div>

                <div className="form-group">
                  <label>Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    className={errors.latitude ? "error" : ""}
                    placeholder="Enter latitude"
                    disabled={loading}
                  />
                  {errors.latitude && <span className="error-text">{errors.latitude}</span>}
                </div>

                <div className="form-group">
                  <label>Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    className={errors.longitude ? "error" : ""}
                    placeholder="Enter longitude"
                    disabled={loading}
                  />
                  {errors.longitude && <span className="error-text">{errors.longitude}</span>}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-cancel" onClick={resetForm} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-save" disabled={loading}>
                  {loading ? "Saving..." : editingProject ? "Update" : "Save"} Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="projects-table">
        {loading && <div className="loading">Loading projects...</div>}

        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Project Name</th>
              <th>Address</th>
              <th>Coordinates</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project, index) => (
              <tr key={project.id}>
                <td>{index + 1}</td>
                <td>{project.project_name}</td>
                <td>{project.address}</td>
                <td>
                  <div className="coordinates">
                    <span>
                      {project.latitude}, {project.longitude}
                    </span>
                    <button
                      className="btn btn-map"
                      onClick={() => openInMaps(project.latitude, project.longitude)}
                      title="View on Map"
                      disabled={loading}
                    >
                      🗺️
                    </button>
                  </div>
                </td>
                <td>{new Date(project.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-edit"
                      onClick={() => handleEdit(project)}
                      title="Edit Project"
                      disabled={loading}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-delete"
                      onClick={() => handleDelete(project.id)}
                      title="Delete Project"
                      disabled={loading}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && projects.length === 0 && (
          <div className="no-data">
            <p>No projects found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectManagement
