
"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const VehicleEntry = () => {
  const [vehicleEntries, setVehicleEntries] = useState([])
  const [ticketDetails, setTicketDetails] = useState([])
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [detectedVehicle, setDetectedVehicle] = useState(null)
  const [showDetailsForm, setShowDetailsForm] = useState(false)
  const [matchedVehicle, setMatchedVehicle] = useState(null)
  const [showManualForm, setShowManualForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchVehicleEntries()
    fetchTicketDetails()
  }, [])

  const fetchVehicleEntries = async () => {
    try {
      const vehiclesRes = await fetch("http://localhost:5000/vehicles")
      const vehicles = await vehiclesRes.json()
      const weighbridgeRes = await fetch("http://localhost:5000/weighbridge_data")
      const weighbridgeData = await weighbridgeRes.json()
      const mergedData = vehicles.map(vehicle => {
        const weighbridge = weighbridgeData.find(
          w => w.VehicleNumber === vehicle.vehicle_number
        )
        return {
          ...vehicle,
          weighbridge_weight: weighbridge ? weighbridge.NetWeight : "N/A",
        }
      })
      console.log("✅ Final merged data:", mergedData)
      setVehicleEntries(mergedData)
    } catch (error) {
      console.error("Error fetching vehicle entries:", error)
    }
  }

  const fetchTicketDetails = async () => {
    try {
      const response = await fetch("http://localhost:5000/ticket-details")
      const data = await response.json()
      if (response.ok) {
        console.log("✅ Ticket details:", data)
        setTicketDetails(data)
      } else {
        console.error("Error fetching ticket details:", data.error)
      }
    } catch (error) {
      console.error("Error fetching ticket details:", error)
    }
  }

  const exportToExcel = () => {
    const exportData = vehicleEntries.map((entry, index) => ({
      "S.No": index + 1,
      "Inward Number": entry.inward_no,
      "Vehicle Number": entry.vehicle_number,
      Material: entry.material,
      "Entry Time": new Date(entry.entry_time).toLocaleString(),
      "Weighbridge Weight": entry.weighbridge_weight || "N/A",
    }))
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vehicle Entries")
    XLSX.writeFile(
      workbook,
      `vehicle_entries_${new Date().toISOString().split("T")[0]}.xlsx`
    )
  }

  const exportTicketDetailsToExcel = () => {
    const exportData = filteredTicketDetails.map((entry, index) => ({
      "S.No": index + 1,
      "ID": entry.id,
      "Ticket Number": entry.TicketNumber,
      "Vehicle Number": entry.VehicleNumber,
      Date: entry.Date ? new Date(entry.Date).toLocaleDateString() : "N/A",
      Time: entry.Time || "N/A",
      "Loaded Weight (kg)": entry.LoadedWeight ? Number(entry.LoadedWeight).toFixed(2) : "0.00",
      "Empty Weight (kg)": entry.EmptyWeight ? Number(entry.EmptyWeight).toFixed(2) : "0.00",
      "Net Weight (kg)": entry.NetWeight ? Number(entry.NetWeight).toFixed(2) : "0.00",
      "Load Weight Date": entry.LoadWeightDate ? new Date(entry.LoadWeightDate).toLocaleDateString() : "N/A",
      "Load Weight Time": entry.LoadWeightTime || "N/A",
      "Empty Weight Date": entry.EmptyWeightDate ? new Date(entry.EmptyWeightDate).toLocaleDateString() : "N/A",
      "Empty Weight Time": entry.EmptyWeightTime || "N/A",
      Pending: entry.Pending || "N/A",
      Shift: entry.Shift || "N/A",
      Material: entry.Materialname || "N/A",
      "Supplier Name": entry.SupplierName || "N/A",
      State: entry.State || "N/A",
      Closed: entry.Closed || "N/A",
      "Created At": entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "N/A",
      "Updated At": entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "N/A",
    }))
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ticket Details")
    XLSX.writeFile(
      workbook,
      `ticket_details_${new Date().toISOString().split("T")[0]}.xlsx`
    )
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this vehicle entry?")) {
      try {
        const response = await fetch(`http://localhost:5000/vehicles/${id}`, {
          method: "DELETE",
        })
        if (response.ok) {
          fetchVehicleEntries()
          alert("Vehicle entry deleted successfully!")
        } else {
          const errorData = await response.json()
          alert(`Error deleting vehicle entry: ${errorData.error || "Unknown error"}`)
        }
      } catch (error) {
        console.error("Error deleting vehicle entry:", error)
        alert("Error deleting vehicle entry")
      }
    }
  }

  const handleVideoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setVideoFile(file)
    const videoUrl = URL.createObjectURL(file)
    setVideoPreview(videoUrl)
    setDetectedVehicle(null)
    setMatchedVehicle(null)
    setShowDetailsForm(false)
  }

  const handleVideoProcessing = async () => {
    if (!videoFile) return alert("Please upload a video first.")
    const formData = new FormData()
    formData.append("file", videoFile)
    setLoading(true)
    try {
      const response = await fetch("http://localhost:5000/vehicles/process-video", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (data.success) {
        setDetectedVehicle(data.vehicle_data)
        if (data.matched) {
          setMatchedVehicle(data.existing_vehicle)
          alert("✅ Vehicle matched! Displaying existing details.")
        } else {
          setShowDetailsForm(true)
          alert("🆕 New vehicle detected! Please fill the remaining details.")
        }
      } else {
        alert(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      console.error("Error during processing:", error)
      alert("Error during vehicle verification.")
    } finally {
      setLoading(false)
    }
  }

  const handleDetailsSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const vehicleData = {
      ...detectedVehicle,
      supplier_name: formData.get("supplierName"),
      weighbridge_weight: formData.get("weighbridgeWeight"),
    }
    try {
      const response = await fetch("http://localhost:5000/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehicleData),
      })
      if (response.ok) {
        fetchVehicleEntries()
        setShowDetailsForm(false)
        setDetectedVehicle(null)
        setVideoFile(null)
        setVideoPreview(null)
        document.getElementById("video-upload").value = ""
        alert("Vehicle entry created successfully!")
      } else {
        const errorData = await response.json()
        alert(`Error creating vehicle entry: ${errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error creating vehicle entry:", error)
      alert("Error creating vehicle entry")
    }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const vehicleData = {
      vehicle_number: formData.get("vehicleNumber"),
      supplier_name: formData.get("supplierName"),
      material: formData.get("material"),
      entry_time: new Date().toISOString().slice(0, 19).replace("T", " "),
    }
    try {
      const response = await fetch("http://localhost:5000/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehicleData),
      })
      if (response.ok) {
        fetchVehicleEntries()
        setShowManualForm(false)
        alert("✅ Vehicle entry added successfully!")
      } else {
        const errorData = await response.json()
        alert(`❌ Error: ${errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error adding manual entry:", error)
      alert("❌ Error adding manual entry")
    }
  }

  const filteredTicketDetails = ticketDetails.filter(entry =>
    entry.VehicleNumber.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="vehicle-entry">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">🚛</div>
          <div>
            <h2>Vehicle Entry Management</h2>
            <p className="section-subtitle">
              Automated vehicle entry using license plate detection
            </p>
          </div>
        </div>
        <div className="header-actions">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search Ticket Details by Vehicle Number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="btn btn-clear-search"
                onClick={() => setSearchQuery("")}
                title="Clear Search"
              >
                ❌
              </button>
            )}
          </div>
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Vehicle Entries
          </button>
          <button className="btn btn-export" onClick={exportTicketDetailsToExcel}>
            📊 Export Ticket Details
          </button>
        </div>
      </div>
      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        {/* <button className="btn btn-add" onClick={() => setShowManualForm(true)}>
          ➕ Add Vehicle Entry
        </button> */}
      </div>

      {showManualForm && (
        <div className="details-form-card">
          <div className="card-header">
            <h4>➕ Manual Vehicle Entry</h4>
          </div>
          <form onSubmit={handleManualSubmit} className="details-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Vehicle Number</label>
                <input type="text" name="vehicleNumber" required />
              </div>
              <div className="form-group">
                <label>Supplier Name</label>
                <input type="text" name="supplierName" required />
              </div>
              <div className="form-group">
                <label>Material</label>
                <input type="text" name="material" required />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-submit">
                ✅ Save
              </button>
              <button
                type="button"
                className="btn btn-cancel"
                onClick={() => setShowManualForm(false)}
              >
                ❌ Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="entries-table">
        {/* <div className="table-header">
          <h3>Vehicle Entries</h3>
          <div className="table-stats">
            <div className="stat-card">
              <span className="stat-number">{vehicleEntries.length}</span>
              <span className="stat-label">Total Entries</span>
            </div>
          </div>
        </div> */}
        {/* <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Inward Number</th>
                <th>Vehicle Number</th>
                <th>Material</th>
                <th>Entry Time/Date</th>
                <th>Weighbridge Weight (kg)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicleEntries.map((entry, index) => (
                <tr key={entry.id}>
                  <td>{index + 1}</td>
                  <td><span className="inward-number">{entry.inward_no}</span></td>
                  <td><span className="vehicle-number">{entry.vehicle_number}</span></td>
                  <td><span className="material">{entry.material || "N/A"}</span></td>
                  <td>
                    <span className="entry-time">
                      {new Date(entry.entry_time).toLocaleDateString()}
                      <br />
                      <small>{new Date(entry.entry_time).toLocaleTimeString()}</small>
                    </span>
                  </td>
                  <td><span className="weighbridge-weight">{entry.weighbridge_weight || "N/A"} kg</span></td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-delete"
                        onClick={() => handleDelete(entry.id)}
                        title="Delete Entry"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vehicleEntries.length === 0 && (
            <div className="no-data">
              <div className="no-data-icon">🚛</div>
              <h3>No Vehicle Entries Found</h3>
              <p>Upload and process videos to detect vehicle entries</p>
            </div>
          )}
        </div> */}
      </div>

      <div className="entries-table" style={{ marginTop: "40px" }}>
        <div className="table-header">
          <h3>Ticket Details</h3>
          <div className="table-stats">
            <div className="stat-card">
              <span className="stat-number">{filteredTicketDetails.length}</span>
              <span className="stat-label">Total Tickets</span>
            </div>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>ID</th>
                <th>Ticket Number</th>
                <th>Vehicle Number</th>
                <th>Date</th>
                <th>Time</th>
                <th>Loaded Weight (kg)</th>
                <th>Empty Weight (kg)</th>
                <th>Net Weight (kg)</th>
                <th>Load Weight Date</th>
                <th>Load Weight Time</th>
                <th>Empty Weight Date</th>
                <th>Empty Weight Time</th>
                <th>Pending</th>
                <th>Shift</th>
                <th>Material</th>
                <th>Supplier Name</th>
                <th>State</th>
                <th>Closed</th>
                <th>Created At</th>
                <th>Updated At</th>
              </tr>
            </thead>
            <tbody>
              {filteredTicketDetails.map((entry, index) => (
                <tr key={entry.id}>
                  <td>{index + 1}</td>
                  <td><span className="id">{entry.id}</span></td>
                  <td><span className="ticket-number">{entry.TicketNumber}</span></td>
                  <td><span className="vehicle-number">{entry.VehicleNumber}</span></td>
                  <td><span className="date">{entry.Date ? new Date(entry.Date).toLocaleDateString() : "N/A"}</span></td>
                  <td><span className="time">{entry.Time || "N/A"}</span></td>
                  <td><span className="loaded-weight">{entry.LoadedWeight ? Number(entry.LoadedWeight).toFixed(2) : "0.00"} kg</span></td>
                  <td><span className="empty-weight">{entry.EmptyWeight ? Number(entry.EmptyWeight).toFixed(2) : "0.00"} kg</span></td>
                  <td><span className="net-weight">{entry.NetWeight ? Number(entry.NetWeight).toFixed(2) : "0.00"} kg</span></td>
                  <td><span className="load-weight-date">{entry.LoadWeightDate ? new Date(entry.LoadWeightDate).toLocaleDateString() : "N/A"}</span></td>
                  <td><span className="load-weight-time">{entry.LoadWeightTime || "N/A"}</span></td>
                  <td><span className="empty-weight-date">{entry.EmptyWeightDate ? new Date(entry.EmptyWeightDate).toLocaleDateString() : "N/A"}</span></td>
                  <td><span className="empty-weight-time">{entry.EmptyWeightTime || "N/A"}</span></td>
                  <td><span className="pending">{entry.Pending || "N/A"}</span></td>
                  <td><span className="shift">{entry.Shift || "N/A"}</span></td>
                  <td><span className="material">{entry.Materialname || "N/A"}</span></td>
                  <td><span className="supplier-name">{entry.SupplierName || "N/A"}</span></td>
                  <td><span className="state">{entry.State || "N/A"}</span></td>
                  <td><span className="closed">{entry.Closed || "N/A"}</span></td>
                  <td><span className="created-at">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "N/A"}</span></td>
                  <td><span className="updated-at">{entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "N/A"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTicketDetails.length === 0 && (
            <div className="no-data">
              <div className="no-data-icon">🎟️</div>
              <h3>{searchQuery ? "No Matching Ticket Details Found" : "No Ticket Details Found"}</h3>
              <p>{searchQuery ? "Try a different vehicle number" : "Upload an Excel file to populate ticket details"}</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .vehicle-entry {
          padding: 20px;
          max-width: 1600px;
          margin: 0 auto;
          background: #f8f9fa;
          min-height: 100vh;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding: 25px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .section-icon {
          font-size: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          border-radius: 15px;
          color: white;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        .section-title h2 {
          margin: 0;
          color: #333;
          font-size: 32px;
          font-weight: 700;
        }
        .section-subtitle {
          margin: 8px 0 0 0;
          color: #666;
          font-size: 16px;
        }
        .header-actions {
          display: flex;
          gap: 15px;
          align-items: center;
        }
        .search-container {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .search-input {
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          width: 200px;
          transition: border-color 0.3s ease;
        }
        .search-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .details-form-card {
          margin-top: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .card-header {
          padding: 20px;
          background: linear-gradient(135deg, #007bff 0%, #6610f2 100%);
          color: white;
        }
        .card-header h4 {
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .details-form {
          padding: 20px;
        }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .form-group label {
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }
        .form-group input {
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.3s ease;
        }
        .form-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .entries-table {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 25px 30px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-bottom: 2px solid #dee2e6;
        }
        .table-header h3 {
          margin: 0;
          color: #333;
          font-size: 24px;
          font-weight: 700;
        }
        .table-stats {
          display: flex;
          gap: 20px;
        }
        .stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 15px 20px;
          border-radius: 10px;
          background: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          min-width: 80px;
        }
        .stat-number {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }
        .stat-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          font-weight: 600;
        }
        .table-container {
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        th, td {
          padding: 15px 12px;
          text-align: left;
          border-bottom: 1px solid #dee2e6;
          vertical-align: middle;
          white-space: nowrap;
        }
        th {
          background: #f8f9fa;
          font-weight: 600;
          color: #495057;
          position: sticky;
          top: 0;
          z-index: 10;
          font-size: 13px;
          text-transform: uppercase;
        }
        tr:hover {
          background: #f8f9fa;
        }
        .inward-number, .vehicle-number, .ticket-number, .id {
          font-weight: 600;
          color: #495057;
        }
        .material, .date, .time, .loaded-weight, .empty-weight, .net-weight, 
        .load-weight-date, .load-weight-time, .empty-weight-date, .empty-weight-time,
        .pending, .shift, .supplier-name, .state, .closed, .created-at, .updated-at {
          font-weight: 500;
          color: #495057;
        }
        .action-buttons {
          display: flex;
          gap: 6px;
          justify-content: center;
        }
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-export {
          background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);
          color: white;
        }
        .btn-submit {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 24px;
        }
        .btn-cancel, .btn-clear-search {
          background: #6c757d;
          color: white;
          padding: 12px 24px;
        }
        .btn-clear-search {
          padding: 8px 10px;
        }
        .btn-delete {
          background: #6c757d;
          color: white;
          padding: 6px 10px;
        }
        .btn-add {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          padding: 12px 24px;
        }
        .no-data {
          text-align: center;
          padding: 80px 20px;
          color: #6c757d;
        }
        .no-data-icon {
          font-size: 64px;
          margin-bottom: 20px;
          opacity: 0.5;
        }
        .no-data h3 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 24px;
        }
        .no-data p {
          margin: 0;
          font-size: 16px;
        }
        @media (max-width: 768px) {
          .section-header {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }
          .header-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .search-container {
            width: 100%;
          }
          .search-input {
            width: 100%;
          }
          .table-header {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }
          .form-grid {
            grid-template-columns: 1fr;
          }
          .form-actions {
            justify-content: center;
          }
          th, td {
            font-size: 12px;
            padding: 10px 8px;
          }
        }
      `}</style>
    </div>
  )
}

export default VehicleEntry
