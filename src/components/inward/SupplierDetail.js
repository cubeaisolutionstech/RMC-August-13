"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const SupplierDetail = () => {
  const [supplierDetails, setSupplierDetails] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingBills, setUploadingBills] = useState({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    poNumber: "",
    poBalanceQty: "",
    inwardNo: "",
    vehicleNo: "",
    dateTime: "",
    supplierName: "",
    material: "",
    uom: "tons",
    receivedQty: "",
    receivedBy: "",
    poRate: "",
    status: "Pending",
  })
  const [error, setError] = useState(null)
  const [materials, setMaterials] = useState([])
  const [uploadedFile, setUploadedFile] = useState(null)

  useEffect(() => {
    fetchSupplierDetails()

    const interval = setInterval(fetchSupplierDetails, 5000)
    const handleVehicleUpdate = () => {
      console.log("Vehicle entry updated, refreshing supplier details...")
      fetchSupplierDetails()
    }

    window.addEventListener("vehicleEntryUpdated", handleVehicleUpdate)
    return () => {
      clearInterval(interval)
      window.removeEventListener("vehicleEntryUpdated", handleVehicleUpdate)
    }
  }, [])

  useEffect(() => {
    let debounceTimer
    const fetchVoucherData = async () => {
      if (!formData.poNumber) {
        setFormData((prev) => ({
          ...prev,
          supplierName: "",
          material: "",
          receivedQty: "",
          poRate: "",
        }))
        setMaterials([])
        setError(null)
        return
      }

      setLoading(true)
      try {
        const [customerResponse, inventoryResponse, materialsResponse] = await Promise.all([
          fetch(`http://127.0.0.1:8001/api/vouchers/customer-name?vch_no=${encodeURIComponent(formData.poNumber)}`, {
            credentials: 'include'
          }),
          fetch(`http://127.0.0.1:8001/api/vouchers/inventory-details?vch_no=${encodeURIComponent(formData.poNumber)}`, {
            credentials: 'include'
          }),
          fetch(`http://127.0.0.1:8001/api/vouchers/materials-by-voucher?vch_no=${encodeURIComponent(formData.poNumber)}`, {
            credentials: 'include'
          })
        ])

        let customerData = { customer_name: "" }
        if (customerResponse.ok) {
          customerData = await customerResponse.json()
        } else {
          const error = await customerResponse.json()
          console.error(`Error fetching customer name for vch_no ${formData.poNumber}: ${error.detail}`)
          setError(`Error fetching customer name: ${error.detail}`)
        }

        let inventoryData = { stock_item: "", actual_qty: 0.0, rate: 0.0 }
        if (inventoryResponse.ok) {
          inventoryData = await inventoryResponse.json()
        } else {
          const error = await inventoryResponse.json()
          console.error(`Error fetching inventory details for vch_no ${formData.poNumber}: ${error.detail}`)
          setError((prev) => prev ? `${prev}\nError fetching inventory details: ${error.detail}` : `Error fetching inventory details: ${error.detail}`)
        }

        let materialsData = { data: {} }
        if (materialsResponse.ok) {
          materialsData = await materialsResponse.json()
        } else {
          const error = await materialsResponse.json()
          console.error(`Error fetching materials for vch_no ${formData.poNumber}: ${error.detail}`)
          setError((prev) => prev ? `${prev}\nError fetching materials: ${error.detail}` : `Error fetching materials: ${error.detail}`)
        }

        const stockItems = materialsData.data[formData.poNumber] || []
        setMaterials(stockItems.filter(item => item !== null))
        const defaultMaterial = stockItems.length > 0 && stockItems[0] !== null ? stockItems[0] : ""

        setFormData((prev) => ({
          ...prev,
          supplierName: customerData.customer_name || "",
          material: defaultMaterial,
          receivedQty: inventoryData.actual_qty !== 0 ? inventoryData.actual_qty.toString() : "",
          poRate: inventoryData.rate !== 0 ? inventoryData.rate.toString() : ""
        }))
      } catch (error) {
        console.error("Error fetching voucher data:", error)
        setError("Failed to fetch voucher data. Please check the server and try again.")
      } finally {
        setLoading(false)
      }
    }

    debounceTimer = setTimeout(fetchVoucherData, 500)
    return () => clearTimeout(debounceTimer)
  }, [formData.poNumber])

  const fetchSupplierDetails = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch("http://localhost:5000/supplier")
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        setSupplierDetails(data)
        setLoading(false)
        return
      } catch (error) {
        console.error("Error fetching supplier details:", error)
        if (i === retries - 1) {
          setError("Failed to fetch supplier details. Please ensure the supplier service is running.")
          setLoading(false)
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))) // Exponential backoff
        }
      }
    }
  }

  const handleAddSupplier = async (e) => {
    e.preventDefault()
    try {
      let supplierId = null
      if (uploadedFile) {
        const uploadFormData = new FormData()
        uploadFormData.append("file", uploadedFile)
        uploadFormData.append("supplier_id", "temp")
        uploadFormData.append("vehicle_number", formData.vehicleNo || "TEMP_VEHICLE")

        const uploadResponse = await fetch("http://localhost:5000/supplier/upload-bill", {
          method: "POST",
          body: uploadFormData,
        })

        const uploadResult = await uploadResponse.json()
        if (!uploadResponse.ok || !uploadResult.success) {
          setError(`Upload failed: ${uploadResult.message || uploadResult.error}`)
          return
        }
      }

      const response = await fetch("http://localhost:5000/supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const result = await response.json()
        supplierId = result.id

        if (uploadedFile) {
          await updateSupplierWithBillData(supplierId, formData.vehicleNo)
        }

        alert("Supplier detail added successfully!")
        setShowAddForm(false)
        resetForm()
        fetchSupplierDetails()
      } else {
        const error = await response.json()
        setError(`Error adding supplier: ${error.error}`)
      }
    } catch (error) {
      console.error("Error adding supplier:", error)
      setError("Error adding supplier detail. Please ensure the supplier service is running.")
    }
  }

  const resetForm = () => {
    setFormData({
      poNumber: "",
      poBalanceQty: "",
      inwardNo: "",
      vehicleNo: "",
      dateTime: "",
      supplierName: "",
      material: "",
      uom: "tons",
      receivedQty: "",
      receivedBy: "",
      poRate: "",
      status: "Pending",
    })
    setMaterials([])
    setUploadedFile(null)
    setError(null)
  }

  const generateInwardNumber = () => {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const day = date.getDate().toString().padStart(2, "0")
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0")
    return `INW${year}${month}${day}${random}`
  }

  const handleFileUpload = async (supplierId, file, vehicleNo) => {
    if (!file) return

    setUploadingBills((prev) => ({ ...prev, [supplierId]: true }))
    const uploadFormData = new FormData()
    uploadFormData.append("file", file)
    uploadFormData.append("supplier_id", supplierId)
    uploadFormData.append("vehicle_number", vehicleNo || "TEMP_VEHICLE")

    try {
      const response = await fetch("http://localhost:5000/supplier/upload-bill", {
        method: "POST",
        body: uploadFormData,
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        setError(`Upload failed: ${result.message || result.error}`)
      } else if (supplierId === "temp") {
        await handleExtractData() // Trigger extraction after successful upload for temp
      }
    } catch (error) {
      console.error("Error uploading bill:", error)
      setError("Error uploading bill. Please ensure the supplier service is running.")
    } finally {
      setUploadingBills((prev) => ({ ...prev, [supplierId]: false }))
    }
  }

  const handleExtractData = async () => {
    if (!uploadedFile) {
      setError("No file uploaded to extract data from.")
      return
    }

    setUploadingBills((prev) => ({ ...prev, temp: true }))
    const uploadFormData = new FormData()
    uploadFormData.append("file", uploadedFile)

    try {
      const response = await fetch("http://127.0.0.1:8001/api/extract", {
        method: "POST",
        body: uploadFormData,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "No response body" }))
        console.error("Server response:", error)
        setError(`Extraction failed: ${error.error || "Unknown error"}`)
      } else {
        const result = await response.json()
        if (result.status === "success") {
          const { vehicle_number } = result.data
          if (vehicle_number) {
            setFormData((prev) => ({
              ...prev,
              vehicleNo: vehicle_number.toUpperCase(),
            }))
          }
          alert("Invoice data extracted and saved successfully!")
        }
      }
    } catch (error) {
      console.error("Error extracting invoice data:", error)
      setError("Error extracting invoice data. Please ensure the extractor service is running.")
    } finally {
      setUploadingBills((prev) => ({ ...prev, temp: false }))
    }
  }

  const updateSupplierWithBillData = async (supplierId, vehicleNo) => {
    try {
      const billResponse = await fetch(`http://localhost:5000/supplier/bill-data/${vehicleNo}`)
      if (billResponse.ok) {
        const billData = await billResponse.json()
        const updateResponse = await fetch(`http://localhost:5000/supplier/${supplierId}/update-bill`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierBillQty: billData.supplierBillQty,
            supplierBillRate: billData.supplierBillRate,
          }),
        })

        if (!updateResponse.ok) {
          console.error("Failed to update supplier with bill data")
        }
      }
    } catch (error) {
      console.error("Error updating supplier with bill data:", error)
      setError("Error updating supplier with bill data.")
    }
  }

  const handleApproval = async (id, action) => {
    try {
      const response = await fetch(`http://localhost:5000/supplier/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      })

      if (response.ok) {
        fetchSupplierDetails()
        alert(`Supplier detail ${action.toLowerCase()} successfully!`)
      } else {
        const error = await response.json()
        setError(`Error updating status: ${error.error}`)
      }
    } catch (error) {
      console.error("Error updating status:", error)
      setError("Error updating status.")
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this supplier detail?")) {
      try {
        const response = await fetch(`http://localhost:5000/supplier/${id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          fetchSupplierDetails()
          alert("Supplier detail deleted successfully!")
        } else {
          const error = await response.json()
          setError(`Error deleting supplier detail: ${error.error}`)
        }
      } catch (error) {
        console.error("Error deleting supplier detail:", error)
        setError("Error deleting supplier detail.")
      }
    }
  }

  const exportToExcel = () => {
    const exportData = supplierDetails.map((detail, index) => ({
      "S.No": index + 1,
      "PO Number": detail.poNumber,
      "PO Balance Qty": `${detail.poBalanceQty} ${detail.uom}`,
      "Inward No": detail.inwardNo,
      "Vehicle No": detail.vehicleNo,
      "Date & Time": new Date(detail.dateTime).toLocaleString(),
      "Supplier Name": detail.supplierName,
      Material: detail.material,
      UOM: detail.uom,
      "Received Qty": `${detail.receivedQty || 0} ${detail.uom}`,
      "Received By": detail.receivedBy,
      "Supplier Bill Qty": detail.supplierBillQty ? `${detail.supplierBillQty} ${detail.uom}` : "Not uploaded",
      "PO Rate": `₹${detail.poRate}`,
      "Supplier Bill Rate": detail.supplierBillRate ? `₹${detail.supplierBillRate}` : "Not uploaded",
      Difference: detail.difference ? `₹${detail.difference}` : "N/A",
      Status: detail.status,
      "Created At": new Date(detail.created_at).toLocaleString(),
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Supplier Details")
    XLSX.writeFile(workbook, `supplier_details_${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  const refreshData = () => {
    setLoading(true)
    fetchSupplierDetails()
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading supplier details...</p>
      </div>
    )
  }

  return (
    <div className="supplier-detail">
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="btn btn-clear-error">Clear Error</button>
        </div>
      )}

      <div className="table-header">
        <div className="table-title">
          <h2>Supplier Details</h2>
        </div>
        <div className="header-actions">
          <button className="btn btn-add" onClick={() => setShowAddForm(true)}>
            ➕ Add Supplier Detail
          </button>
          <button className="btn btn-refresh" onClick={refreshData}>
            🔄 Refresh
          </button>
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add Supplier Detail</h3>
              <button className="close-btn" onClick={() => setShowAddForm(false)}>
                ×
              </button>
            </div>
            <div className="modal-upload-section">
              <div className="upload-container">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files[0]
                    setUploadedFile(file)
                    if (file) {
                      handleFileUpload("temp", file, formData.vehicleNo || "TEMP_VEHICLE")
                    }
                  }}
                  className="file-input"
                  id="file-top"
                  disabled={uploadingBills["temp"]}
                />
                <label htmlFor="file-top" className="upload-label">
                  {uploadingBills["temp"] ? (
                    <>
                      <span className="upload-spinner"></span>
                      Processing...
                    </>
                  ) : (
                    <>📄 Upload Bill</>
                  )}
                </label>
              </div>
              <button
                className="btn btn-extract"
                onClick={handleExtractData}
                disabled={!uploadedFile || uploadingBills["temp"]}
              >
                📝 Extract Data
              </button>
            </div>
            <form onSubmit={handleAddSupplier} className="supplier-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>PO Number *</label>
                  <input
                    type="text"
                    value={formData.poNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, poNumber: e.target.value }))}
                    required
                    placeholder="Enter PO number"
                  />
                </div>
                <div className="form-group">
                  <label>PO Balance Qty *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.poBalanceQty}
                    onChange={(e) => setFormData({ ...formData, poBalanceQty: e.target.value })}
                    required
                    placeholder="Enter balance quantity"
                  />
                </div>
                <div className="form-group">
                  <label>Inward No</label>
                  <input
                    type="text"
                    value={formData.inwardNo}
                    onChange={(e) => setFormData({ ...formData, inwardNo: e.target.value })}
                    placeholder="Auto-generated if empty"
                  />
                  <button
                    type="button"
                    className="btn-generate"
                    onClick={() => setFormData({ ...formData, inwardNo: generateInwardNumber() })}
                  >
                    Generate
                  </button>
                </div>
                <div className="form-group">
                  <label>Vehicle No *</label>
                  <input
                    type="text"
                    value={formData.vehicleNo}
                    onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value.toUpperCase() })}
                    required
                    placeholder="Enter vehicle number"
                    readOnly={!!uploadedFile}
                  />
                </div>
                <div className="form-group">
                  <label>Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.dateTime}
                    onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Supplier Name *</label>
                  <input
                    type="text"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    required
                    placeholder="Enter supplier name"
                    readOnly={!!formData.poNumber}
                  />
                </div>
                <div className="form-group">
                  <label>Material *</label>
                  <select
                    value={formData.material}
                    onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                    required
                  >
                    <option value="">Select Material</option>
                    {materials.map((material, index) => (
                      <option key={index} value={material}>
                        {material}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>UOM</label>
                  <select value={formData.uom} onChange={(e) => setFormData({ ...formData, uom: e.target.value })}>
                    <option value="tons">Tons</option>
                    <option value="kg">Kg</option>
                    <option value="pieces">Pieces</option>
                    <option value="bags">Bags</option>
                    <option value="cubic meters">Cubic Meters</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Received Qty</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.receivedQty}
                    onChange={(e) => setFormData({ ...formData, receivedQty: e.target.value })}
                    placeholder="Enter received quantity"
                    readOnly={!!formData.poNumber}
                  />
                </div>
                <div className="form-group">
                  <label>Received By</label>
                  <input
                    type="text"
                    value={formData.receivedBy}
                    onChange={(e) => setFormData({ ...formData, receivedBy: e.target.value })}
                    placeholder="Enter receiver name"
                  />
                </div>
                <div className="form-group">
                  <label>PO Rate *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.poRate}
                    onChange={(e) => setFormData({ ...formData, poRate: e.target.value })}
                    required
                    placeholder="Enter PO rate"
                    readOnly={!!formData.poNumber}
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div className="form-buttons">
                <button type="button" className="btn btn-cancel" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-save">
                  Add Supplier Detail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>PO Number</th>
              <th>PO Balance Qty</th>
              <th>Inward No</th>
              <th>Vehicle No</th>
              <th>Date & Time</th>
              <th>Supplier</th>
              <th>Material</th>
              <th>Received Qty</th>
              <th>Received By</th>
              <th>Bill Upload</th>
              <th>Supplier Bill Qty</th>
              <th>PO Rate</th>
              <th>Supplier Bill Rate</th>
              <th>Difference</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {supplierDetails.map((detail, index) => (
              <tr key={detail.id} className={detail.status.toLowerCase()}>
                <td>{index + 1}</td>
                <td><span className="po-number">{detail.poNumber}</span></td>
                <td><span className="quantity">{detail.poBalanceQty} <small>{detail.uom}</small></span></td>
                <td><span className="inward-no">{detail.inwardNo}</span></td>
                <td><span className="vehicle-no">{detail.vehicleNo}</span></td>
                <td>
                  <span className="datetime">
                    {new Date(detail.dateTime).toLocaleDateString()}
                    <br />
                    <small>{new Date(detail.dateTime).toLocaleTimeString()}</small>
                  </span>
                </td>
                <td><span className="supplier-name">{detail.supplierName}</span></td>
                <td><span className="material">{detail.material}</span></td>
                <td><span className="quantity received">{detail.receivedQty || 0} <small>{detail.uom}</small></span></td>
                <td><span className="received-by">{detail.receivedBy}</span></td>
                <td>
                  <div className="bill-upload-cell">
                    {!detail.supplierBillFile ? (
                      <div className="upload-container">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files[0]
                            if (file) {
                              handleFileUpload(detail.id, file, detail.vehicleNo)
                            }
                          }}
                          className="file-input"
                          id={`file-${detail.id}`}
                          disabled={uploadingBills[detail.id]}
                        />
                        <label htmlFor={`file-${detail.id}`} className="upload-label">
                          {uploadingBills[detail.id] ? (
                            <>
                              <span className="upload-spinner"></span>
                              Processing...
                            </>
                          ) : (
                            <>📄 Upload Bill</>
                          )}
                        </label>
                      </div>
                    ) : (
                      <div className="uploaded-file">
                        <span className="file-icon">📄</span>
                        <span className="file-status">Uploaded</span>
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="bill-qty-cell">
                    {detail.supplierBillQty ? (
                      <span
                        className={`quantity ${
                          Math.abs((detail.receivedQty || 0) - detail.supplierBillQty) > 0.1
                            ? "quantity-mismatch"
                            : "quantity-match"
                        }`}
                      >
                        {detail.supplierBillQty} <small>{detail.uom}</small>
                        {Math.abs((detail.receivedQty || 0) - detail.supplierBillQty) > 0.1 && (
                          <span className="mismatch-warning" title="Quantity mismatch detected!">⚠️</span>
                        )}
                      </span>
                    ) : (
                      <span className="not-available">Upload bill first</span>
                    )}
                  </div>
                </td>
                <td><span className="rate po-rate">₹{detail.poRate}</span></td>
                <td>
                  {detail.supplierBillRate ? (
                    <span className="rate supplier-rate">₹{detail.supplierBillRate}</span>
                  ) : (
                    <span className="not-available">Upload bill first</span>
                  )}
                </td>
                <td>
                  {detail.difference !== null && detail.difference !== undefined ? (
                    <span
                      className={`difference ${Number.parseFloat(detail.difference) >= 0 ? "positive" : "negative"}`}
                    >
                      ₹{detail.difference}
                      {Number.parseFloat(detail.difference) >= 0 ? " ↗️" : " ↘️"}
                    </span>
                  ) : (
                    <span className="not-available">N/A</span>
                  )}
                </td>
                <td><span className={`status-badge ${detail.status.toLowerCase()}`}>{detail.status}</span></td>
                <td>
                  <div className="action-buttons">
                    {detail.status === "Pending" && detail.supplierBillFile && (
                      <>
                        <button
                          className="btn btn-approve"
                          onClick={() => handleApproval(detail.id, "Approved")}
                          title="Approve"
                        >
                          ✅
                        </button>
                        <button
                          className="btn btn-reject"
                          onClick={() => handleApproval(detail.id, "Rejected")}
                          title="Reject"
                        >
                          ❌
                        </button>
                      </>
                    )}
                    {detail.supplierBillFile && (
                      <button
                        className="btn btn-view"
                        onClick={() =>
                          window.open(`http://localhost:5000/uploads/${detail.supplierBillFile}`, "_blank")
                        }
                        title="View Bill"
                      >
                        👁️
                      </button>
                    )}
                    <button className="btn btn-delete" onClick={() => handleDelete(detail.id)} title="Delete">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {supplierDetails.length === 0 && (
          <div className="no-data">
            <h3>No supplier details available</h3>
          </div>
        )}
      </div>

      <style jsx>{`
        .supplier-detail {
          padding: 20px;
          max-width: 1600px;
          margin: 0 auto;
          background: #f8f9fa;
          min-height: 100vh;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .error-message p {
          margin: 0;
          font-size: 14px;
        }

        .btn-clear-error {
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          gap: 20px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e3e3e3;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .table-title h2 {
          margin: 0;
          color: #333;
          font-size: 28px;
          font-weight: 700;
        }

        .header-actions {
          display: flex;
          gap: 15px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 12px;
          padding: 0;
          width: 90%;
          max-width: 1000px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 30px;
          border-bottom: 1px solid #dee2e6;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px 12px 0 0;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
        }

        .close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.3s ease;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .modal-upload-section {
          padding: 20px 30px;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .upload-container {
          position: relative;
        }

        .file-input {
          position: absolute;
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }

        .upload-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .upload-label:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .upload-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .btn-extract {
          background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-extract:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .btn-extract:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(23, 162, 184, 0.3);
        }

        .supplier-form {
          padding: 30px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .form-group label {
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .form-group input,
        .form-group select {
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group input[readOnly],
        .form-group select:disabled {
          background: #e9ecef;
          cursor: not-allowed;
        }

        .btn-generate {
          position: absolute;
          right: 8px;
          top: 32px;
          background: #667eea;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }

        .form-buttons {
          display: flex;
          gap: 15px;
          justify-content: flex-end;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
        }

        .table-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        th, td {
          padding: 12px 10px;
          text-align: left;
          border-bottom: 1px solid #dee2e6;
          vertical-align: middle;
        }

        th {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-weight: 600;
          color: rgb(229, 236, 244);
          position: sticky;
          top: 0;
          z-index: 10;
          font-size: 12px;
          text-transform: uppercase;
        }

        tr:hover {
          background: #f8f9fa;
        }

        tr.pending {
          border-left: 3px solid #ffc107;
        }

        tr.approved {
          border-left: 3px solid #28a745;
        }

        tr.rejected {
          border-left: 3px solid #dc3545;
        }

        .po-number, .inward-no, .vehicle-no {
          font-weight: 600;
          color: #495057;
        }

        .quantity {
          font-weight: 600;
        }

        .quantity.received {
          color: #17a2b8;
        }

        .quantity-match {
          color: #28a745;
        }

        .quantity-mismatch {
          background-color: #fff3cd;
          color: #856404;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 600;
        }

        .mismatch-warning {
          margin-left: 8px;
          color: #dc3545;
          font-size: 16px;
        }

        .datetime {
          font-size: 12px;
        }

        .supplier-name, .material {
          font-weight: 500;
          color: #495057;
        }

        .received-by {
          color: #6c757d;
          font-style: italic;
        }

        .bill-upload-cell {
          min-width: 120px;
        }

        .uploaded-file {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #d4edda;
          color: #155724;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
        }

        .file-icon {
          font-size: 14px;
        }

        .rate {
          font-weight: 600;
        }

        .po-rate {
          color: #17a2b8;
        }

        .supplier-rate {
          color: #6f42c1;
        }

        .difference {
          font-weight: 700;
          font-size: 14px;
        }

        .difference.positive {
          color: #28a745;
        }

        .difference.negative {
          color: #dc3545;
        }

        .not-available {
          color: #6c757d;
          font-style: italic;
          font-size: 12px;
        }

        .status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-badge.pending {
          background: #fff3cd;
          color: #856404;
        }

        .status-badge.approved {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.rejected {
          background: #f8d7da;
          color: #721c24;
        }

        .action-buttons {
          display: flex;
          gap: 6px;
          justify-content: center;
        }

        .btn {
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn:hover {
          transform: translateY(-2px);
        }

        .btn-add {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
        }

        .btn-refresh {
          background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
          color: white;
        }

        .btn-export {
          background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);
          color: white;
        }

        .btn-approve {
          background: #28a745;
          color: white;
          padding: 6px 10px;
        }

        .btn-reject {
          background: #dc3545;
          color: white;
          padding: 6px 10px;
        }

        .btn-view {
          background: #17a2b8;
          color: white;
          padding: 6px 10px;
        }

        .btn-delete {
          background: #6c757d;
          color: white;
          padding: 6px 10px;
        }

        .btn-cancel {
          background: #6c757d;
          color: white;
        }

        .btn-save {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
        }

        .no-data {
          text-align: center;
          padding: 80px 20px;
          color: #6c757d;
        }

        .no-data h3 {
          margin: 0 0 15px 0;
          color: #495057;
          font-size: 24px;
        }

        @media (max-width: 1200px) {
          th, td {
            padding: 10px 8px;
            font-size: 12px;
          }
        }

        @media (max-width: 768px) {
          .table-header {
            flex-direction: column;
            gap: 15px;
            text-align: center;
          }

          .header-actions {
            justify-content: center;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  )
}

export default SupplierDetail