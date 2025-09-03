"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const BatchSlipManagement = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState("create")
  const [batchSlips, setBatchSlips] = useState([])
  const [searchTerm, setSearchTerm] = useState("")

  // Create Batch Slip Form State
  const [formData, setFormData] = useState({
    plantSerialNumber: "3494",
    batchDate: new Date().toISOString().split("T")[0],
    batchStartTime: "",
    batchEndTime: "",
    batchNumber: "",
    customer: "",
    site: "",
    recipeCode: "",
    recipeName: "",
    truckNumber: "",
    truckDriver: "",
    orderNumber: "",
    batcherName: "",
    orderedQuantity: "",
    productionQuantity: "",
    adjManualQuantity: "",
    withThisLoad: 0,
    mixerCapacity: "",
    batchSize: "",
    materialData: Array(20).fill().map(() => ({
      sand: "145.00",
      mm40: "75.00",
      mm20: "150.00",
      mm0: "0.00",
      cem1: "25.00",
      cem2: "25.00",
      cem3: "25.00",
      water: "45.00",
      admix1: "0.38",
    })),
    totalSand: "1500.00",
    totalMm40: "3000.00",
    totalMm20: "0.00",
    totalCem1: "500.00",
    totalCem2: "500.00",
    totalCem3: "500.00",
    totalWater: "900.00",
    totalAdmix1: "7.50",
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    clientGSTIN: "",
    description: "Concrete M30",
    hsn: "6810",
    rate: "4000.00",
    quantity: "15.00",
    unit: "M³",
  })

  const [errors, setErrors] = useState({})
  const [isGenerating, setIsGenerating] = useState(false)

  const recipeOptions = [
    { code: "M25", name: "M25 Grade Concrete" },
    { code: "M30", name: "M30 Grade Concrete" },
    { code: "M35", name: "M35 Grade Concrete" },
    { code: "M40", name: "M40 Grade Concrete" },
    { code: "M45", name: "M45 Grade Concrete" },
  ]

  // Load existing batch slips
  useEffect(() => {
    const savedBatchSlips = localStorage.getItem("batchSlipDetails")
    if (savedBatchSlips) {
      setBatchSlips(JSON.parse(savedBatchSlips))
    }
    
    // Generate batch number automatically
    if (!formData.batchNumber) {
      setFormData((prev) => ({
        ...prev,
        batchNumber: generateBatchNumber(),
      }))
    }
  }, [])

  const generateBatchNumber = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const sequence = String(Math.floor(Math.random() * 1000) + 1).padStart(3, "0")
    return `${year}${month}${day}${sequence}`
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    const requiredFields = [
      "batchDate", "customer", "recipeCode", "recipeName", 
      "truckNumber", "truckDriver", "batcherName", "clientName", 
      "clientAddress", "clientEmail"
    ]

    requiredFields.forEach((field) => {
      if (!formData[field] || formData[field].trim() === "") {
        newErrors[field] = "This field is required"
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsGenerating(true)

    try {
      const batchSlipData = {
        id: Date.now(),
        plantSerialNumber: formData.plantSerialNumber,
        batchDate: formData.batchDate,
        batchStartTime: formData.batchStartTime,
        batchEndTime: formData.batchEndTime,
        batchNumber: formData.batchNumber,
        customer: formData.customer,
        site: formData.site,
        recipeCode: formData.recipeCode,
        recipeName: formData.recipeName,
        truckNumber: formData.truckNumber,
        truckDriver: formData.truckDriver,
        orderNumber: formData.orderNumber,
        batcherName: formData.batcherName,
        orderedQuantity: formData.orderedQuantity,
        productionQuantity: formData.productionQuantity,
        adjManualQuantity: formData.adjManualQuantity,
        withThisLoad: formData.withThisLoad,
        mixerCapacity: formData.mixerCapacity,
        batchSize: formData.batchSize,
        clientName: formData.clientName,
        clientAddress: formData.clientAddress,
        clientEmail: formData.clientEmail,
        clientGSTIN: formData.clientGSTIN,
        description: formData.description,
        hsn: formData.hsn,
        quantity: formData.quantity,
        rate: formData.rate,
        unit: formData.unit,
        materialData: formData.materialData,
        totals: {
          totalSand: formData.totalSand,
          totalMm40: formData.totalMm40,
          totalMm20: formData.totalMm20,
          totalCem1: formData.totalCem1,
          totalCem2: formData.totalCem2,
          totalCem3: formData.totalCem3,
          totalWater: formData.totalWater,
          totalAdmix1: formData.totalAdmix1,
        },
        createdAt: new Date().toISOString(),
        status: "Active",
      }

      // Save to localStorage
      const updatedBatchSlips = [...batchSlips, batchSlipData]
      setBatchSlips(updatedBatchSlips)
      localStorage.setItem("batchSlipDetails", JSON.stringify(updatedBatchSlips))

      alert("Batch slip created successfully!")
      resetForm()
      setActiveTab("details") // Switch to details tab after successful creation
    } catch (error) {
      console.error("Error:", error)
      alert(`Error: ${error.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const resetForm = () => {
    setFormData({
      ...formData,
      batchNumber: generateBatchNumber(),
      batchDate: new Date().toISOString().split("T")[0],
      customer: "",
      site: "",
      recipeCode: "",
      recipeName: "",
      truckNumber: "",
      truckDriver: "",
      orderNumber: "",
      batcherName: "",
      clientName: "",
      clientAddress: "",
      clientEmail: "",
      clientGSTIN: "",
    })
    setErrors({})
  }

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this batch slip?")) {
      const updatedBatchSlips = batchSlips.filter((slip) => slip.id !== id)
      setBatchSlips(updatedBatchSlips)
      localStorage.setItem("batchSlipDetails", JSON.stringify(updatedBatchSlips))
    }
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(batchSlips)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Batch Slip Details")
    XLSX.writeFile(workbook, "batch_slip_details.xlsx")
  }

  const filteredBatchSlips = batchSlips.filter((slip) =>
    (slip.batchNumber || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (slip.customer || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (slip.recipeCode || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  )

  return (
    <div className="batch-slip-management">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">📋</div>
          <h2>Batch Slip Management</h2>
        </div>
        <div className="header-actions">
          {activeTab === "details" && (
            <>
              <input
                type="text"
                placeholder="Search batch slips..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <button className="btn btn-export" onClick={exportToExcel}>
                📊 Export Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === "create" ? "active" : ""}`}
          onClick={() => setActiveTab("create")}
        >
          ➕ Create Batch Slip
        </button>
        <button 
          className={`tab-button ${activeTab === "details" ? "active" : ""}`}
          onClick={() => setActiveTab("details")}
        >
          📋 View Batch Slips
        </button>
      </div>

      {/* Create Batch Slip Tab */}
      {activeTab === "create" && (
        <div className="batch-slip-form-container">
          <form onSubmit={handleSave} className="batch-slip-form">
            <div className="form-section">
              <h3>RR CONSTRUCTIONS</h3>
            </div>

            {/* Batch Information */}
            <div className="form-section">
              <h4>Docket / Batch Report / Autographic Record</h4>
              <div className="form-grid-batch">
                <div className="form-group">
                  <label>Plant Serial Number</label>
                  <input
                    type="text"
                    name="plantSerialNumber"
                    value={formData.plantSerialNumber}
                    onChange={handleInputChange}
                    readOnly
                    className="readonly"
                  />
                </div>
                <div className="form-group">
                  <label>Batch Date *</label>
                  <input
                    type="date"
                    name="batchDate"
                    value={formData.batchDate}
                    onChange={handleInputChange}
                    className={errors.batchDate ? "error" : ""}
                  />
                  {errors.batchDate && <span className="error-text">{errors.batchDate}</span>}
                </div>
                <div className="form-group">
                  <label>Batch Start Time</label>
                  <input type="time" name="batchStartTime" value={formData.batchStartTime} onChange={handleInputChange} />
                </div>
                <div className="form-group">
                  <label>Batch End Time</label>
                  <input type="time" name="batchEndTime" value={formData.batchEndTime} onChange={handleInputChange} />
                </div>
                <div className="form-group">
                  <label>Batch Number *</label>
                  <input
                    type="text"
                    name="batchNumber"
                    value={formData.batchNumber}
                    onChange={handleInputChange}
                    className={errors.batchNumber ? "error" : ""}
                  />
                </div>
                <div className="form-group">
                  <label>Customer *</label>
                  <input
                    type="text"
                    name="customer"
                    value={formData.customer}
                    onChange={handleInputChange}
                    className={errors.customer ? "error" : ""}
                    placeholder="Client A"
                  />
                  {errors.customer && <span className="error-text">{errors.customer}</span>}
                </div>
                <div className="form-group">
                  <label>Site</label>
                  <input
                    type="text"
                    name="site"
                    value={formData.site}
                    onChange={handleInputChange}
                    placeholder="Client A"
                  />
                </div>
                <div className="form-group">
                  <label>Recipe Code *</label>
                  <select
                    name="recipeCode"
                    value={formData.recipeCode}
                    onChange={handleInputChange}
                    className={errors.recipeCode ? "error" : ""}
                  >
                    <option value="">Select Recipe</option>
                    {recipeOptions.map((recipe) => (
                      <option key={recipe.code} value={recipe.code}>
                        {recipe.code} - {recipe.name}
                      </option>
                    ))}
                  </select>
                  {errors.recipeCode && <span className="error-text">{errors.recipeCode}</span>}
                </div>
                <div className="form-group">
                  <label>Recipe Name *</label>
                  <input
                    type="text"
                    name="recipeName"
                    value={formData.recipeName}
                    onChange={handleInputChange}
                    className={errors.recipeName ? "error" : ""}
                    placeholder="Default Recipe"
                  />
                  {errors.recipeName && <span className="error-text">{errors.recipeName}</span>}
                </div>
                <div className="form-group">
                  <label>Truck Number *</label>
                  <input
                    type="text"
                    name="truckNumber"
                    value={formData.truckNumber}
                    onChange={handleInputChange}
                    className={errors.truckNumber ? "error" : ""}
                    placeholder="tm123564"
                  />
                  {errors.truckNumber && <span className="error-text">{errors.truckNumber}</span>}
                </div>
                <div className="form-group">
                  <label>Truck Driver *</label>
                  <input
                    type="text"
                    name="truckDriver"
                    value={formData.truckDriver}
                    onChange={handleInputChange}
                    className={errors.truckDriver ? "error" : ""}
                    placeholder="murugesan"
                  />
                  {errors.truckDriver && <span className="error-text">{errors.truckDriver}</span>}
                </div>
                <div className="form-group">
                  <label>Order Number</label>
                  <input
                    type="text"
                    name="orderNumber"
                    value={formData.orderNumber}
                    onChange={handleInputChange}
                    placeholder="1"
                  />
                </div>
                <div className="form-group">
                  <label>Batcher Name *</label>
                  <input
                    type="text"
                    name="batcherName"
                    value={formData.batcherName}
                    onChange={handleInputChange}
                    className={errors.batcherName ? "error" : ""}
                    placeholder="ss"
                  />
                  {errors.batcherName && <span className="error-text">{errors.batcherName}</span>}
                </div>
              </div>
            </div>

            {/* Quantities Section */}
            <div className="form-section">
              <h4>Quantities</h4>
              <div className="form-grid-quantities">
                <div className="form-group">
                  <label>Ordered Quantity (M³)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="orderedQuantity"
                    value={formData.orderedQuantity}
                    onChange={handleInputChange}
                    placeholder="10.00"
                  />
                </div>
                <div className="form-group">
                  <label>Production Quantity (M³)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="productionQuantity"
                    value={formData.productionQuantity}
                    onChange={handleInputChange}
                    placeholder="10.00"
                  />
                </div>
                <div className="form-group">
                  <label>Adj/Manual Quantity (M³)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="adjManualQuantity"
                    value={formData.adjManualQuantity}
                    onChange={handleInputChange}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>With This Load (M³)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="withThisLoad"
                    value={formData.withThisLoad}
                    onChange={handleInputChange}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Mixer Capacity (M³)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="mixerCapacity"
                    value={formData.mixerCapacity}
                    onChange={handleInputChange}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Batch Size (M³)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="batchSize"
                    value={formData.batchSize}
                    onChange={handleInputChange}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Client Information */}
            <div className="form-section">
              <h4>Client Information (For Invoice)</h4>
              <div className="form-grid-client">
                <div className="form-group">
                  <label>Client Name *</label>
                  <input
                    type="text"
                    name="clientName"
                    value={formData.clientName}
                    onChange={handleInputChange}
                    className={errors.clientName ? "error" : ""}
                    placeholder="Client B"
                  />
                  {errors.clientName && <span className="error-text">{errors.clientName}</span>}
                </div>
                <div className="form-group">
                  <label>Client Address *</label>
                  <textarea
                    name="clientAddress"
                    value={formData.clientAddress}
                    onChange={handleInputChange}
                    className={errors.clientAddress ? "error" : ""}
                    placeholder="No. 123, Salem Main Road, Salem"
                    rows="3"
                  />
                  {errors.clientAddress && <span className="error-text">{errors.clientAddress}</span>}
                </div>
                <div className="form-group">
                  <label>Client Email *</label>
                  <input
                    type="email"
                    name="clientEmail"
                    value={formData.clientEmail}
                    onChange={handleInputChange}
                    className={errors.clientEmail ? "error" : ""}
                    placeholder="client@example.com"
                  />
                  {errors.clientEmail && <span className="error-text">{errors.clientEmail}</span>}
                </div>
                <div className="form-group">
                  <label>Client GSTIN</label>
                  <input
                    type="text"
                    name="clientGSTIN"
                    value={formData.clientGSTIN}
                    onChange={handleInputChange}
                    placeholder="N/A"
                  />
                </div>
              </div>
            </div>

            {/* Invoice Details */}
            <div className="form-section">
              <h4>Invoice Details</h4>
              <div className="form-grid-invoice">
                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Concrete M30"
                  />
                </div>
                <div className="form-group">
                  <label>HSN Code</label>
                  <input type="text" name="hsn" value={formData.hsn} onChange={handleInputChange} placeholder="6810" />
                </div>
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    placeholder="15.00"
                  />
                </div>
                <div className="form-group">
                  <label>Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="rate"
                    value={formData.rate}
                    onChange={handleInputChange}
                    placeholder="4000.00"
                  />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <input type="text" name="unit" value={formData.unit} onChange={handleInputChange} placeholder="M³" />
                </div>
                <div className="form-group">
                  <label>Total Amount</label>
                  <input
                    type="text"
                    value={`₹${(Number.parseFloat(formData.quantity || 0) * Number.parseFloat(formData.rate || 0)).toFixed(2)}`}
                    readOnly
                    className="readonly total-amount"
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-cancel" onClick={resetForm} disabled={isGenerating}>
                Reset Form
              </button>
              <button type="submit" className="btn btn-save" disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <span className="spinner"></span>
                    Saving...
                  </>
                ) : (
                  <>💾 Save Batch Slip</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Batch Slip Details Tab */}
      {activeTab === "details" && (
        <div className="enhanced-table-container">
          <div className="table-card">
            <div className="table-card-header">
              <div className="table-title">
                <h3>Saved Batch Slip Records</h3>
                <div className="table-stats">
                  <span className="stat-badge">
                    Total: <strong>{batchSlips.length}</strong>
                  </span>
                  <span className="stat-badge">
                    Showing: <strong>{filteredBatchSlips.length}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="enhanced-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Batch Number</th>
                    <th>Batch Date</th>
                    <th>Customer</th>
                    <th>Recipe Code</th>
                    <th>Quantity (M³)</th>
                    <th>Client Email</th>
                    <th>Client Address</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatchSlips.map((slip, index) => (
                    <tr key={slip.id}>
                      <td>{index + 1}</td>
                      <td>
                        <span className="batch-number">{slip.batchNumber}</span>
                      </td>
                      <td>{new Date(slip.batchDate).toLocaleDateString()}</td>
                      <td>
                        <span className="customer-name">{slip.customer}</span>
                      </td>
                      <td>
                        <span className="recipe-code">{slip.recipeCode}</span>
                      </td>
                      <td>
                        <span className="quantity-value">{slip.quantity}</span>
                      </td>
                      <td>
                        <span className="email-text">{slip.clientEmail || "-"}</span>
                      </td>
                      <td>
                        <span className="address-text" title={slip.clientAddress}>
                          {slip.clientAddress
                            ? slip.clientAddress.length > 30
                              ? slip.clientAddress.substring(0, 30) + "..."
                              : slip.clientAddress
                            : "-"}
                        </span>
                      </td>
                      <td>
                        <span className={`status ${slip.status.toLowerCase()}`}>{slip.status}</span>
                      </td>
                      <td>
                        <div className="action-buttons-horizontal">
                          <button className="btn-view-text" title="View Details">
                            View
                          </button>
                          <button className="btn-approve-text" title="Edit">
                            Edit
                          </button>
                          <button className="btn-reject-text" title="Delete" onClick={() => handleDelete(slip.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredBatchSlips.length === 0 && (
                <div className="no-data-enhanced">
                  <div className="no-data-icon">📋</div>
                  <h4>No Batch Slip Details Found</h4>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .batch-slip-management {
          padding: 20px;
          max-width: 1600px;
          margin: 0 auto;
          background: #f8f9fa;
          min-height: 100vh;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .section-icon {
          font-size: 32px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 15px;
          border-radius: 12px;
          color: white;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .section-title h2 {
          margin: 0;
          color: #333;
          font-size: 28px;
          font-weight: 700;
        }

        .header-actions {
          display: flex;
          gap: 15px;
          align-items: center;
        }

        .search-input {
          padding: 10px 15px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          min-width: 250px;
        }

        .tab-navigation {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          padding: 0 20px;
        }

        .tab-button {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          background: #e9ecef;
          color: #495057;
        }

        .tab-button.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .tab-button:hover {
          transform: translateY(-2px);
        }

        .batch-slip-form-container {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .form-section {
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #f1f3f4;
        }

        .form-section h3 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 24px;
        }

        .form-section h4 {
          margin: 0 0 20px 0;
          color: #495057;
          font-size: 18px;
          font-weight: 600;
        }

        .form-grid-batch {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
        }

        .form-grid-quantities, .form-grid-client, .form-grid-invoice {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
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

        .form-group input, .form-group select, .form-group textarea {
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.3s ease;
        }

        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group input.error, .form-group select.error, .form-group textarea.error {
          border-color: #dc3545;
        }

        .error-text {
          color: #dc3545;
          font-size: 12px;
          font-weight: 500;
        }

        .readonly {
          background-color: #f8f9fa;
          cursor: not-allowed;
        }

        .total-amount {
          font-weight: bold;
          color: #28a745;
        }

        .form-actions {
          display: flex;
          gap: 15px;
          justify-content: flex-end;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #f1f3f4;
        }

        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
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

        .btn-cancel {
          background: #6c757d;
          color: white;
        }

        .btn-save {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
        }

        .btn-export {
          background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);
          color: white;
        }

        .btn-generate {
          background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);
          color: white;
        }

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid #ffffff;
          border-radius: 50%;
          border-top-color: transparent;
          animation: spin 1s ease-in-out infinite;
          margin-right: 8px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .enhanced-table-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .table-card-header {
          padding: 20px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-bottom: 2px solid #dee2e6;
        }

        .table-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .table-title h3 {
          margin: 0;
          color: #333;
          font-size: 20px;
        }

        .table-stats {
          display: flex;
          gap: 15px;
        }

        .stat-badge {
          padding: 8px 12px;
          background: white;
          border-radius: 6px;
          font-size: 14px;
          color: #495057;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .enhanced-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .enhanced-table th, .enhanced-table td {
          padding: 15px 12px;
          text-align: left;
          border-bottom: 1px solid #dee2e6;
          vertical-align: middle;
        }

        .enhanced-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #495057;
          position: sticky;
          top: 0;
          z-index: 10;
          font-size: 13px;
          text-transform: uppercase;
        }

        .enhanced-table tr:hover {
          background: #f8f9fa;
        }

        .batch-number, .customer-name, .recipe-code {
          font-weight: 600;
          color: #495057;
        }

        .quantity-value {
          font-weight: 500;
          color: #495057;
        }

        .email-text, .address-text {
          font-size: 13px;
        }

        .status {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status.active {
          background: #d4edda;
          color: #155724;
        }

        .status.pending {
          background: #fff3cd;
          color: #856404;
        }

        .status.inactive {
          background: #f8d7da;
          color: #721c24;
        }

        .action-buttons-horizontal {
          display: flex;
          gap: 8px;
        }

        .btn-view-text, .btn-approve-text, .btn-reject-text {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-view-text {
          background: #17a2b8;
          color: white;
        }

        .btn-approve-text {
          background: #28a745;
          color: white;
        }

        .btn-reject-text {
          background: #dc3545;
          color: white;
        }

        .no-data-enhanced {
          text-align: center;
          padding: 60px 20px;
          color: #6c757d;
        }

        .no-data-icon {
          font-size: 48px;
          margin-bottom: 15px;
          opacity: 0.5;
        }

        .no-data-enhanced h4 {
          margin: 0 0 10px 0;
          color: #495057;
          font-size: 18px;
        }

        @media (max-width: 768px) {
          .section-header {
            flex-direction: column;
            gap: 15px;
            text-align: center;
          }

          .header-actions {
            flex-direction: column;
            width: 100%;
          }

          .search-input {
            width: 100%;
          }

          .tab-navigation {
            flex-direction: column;
          }

          .form-grid-batch, .form-grid-quantities, .form-grid-client, .form-grid-invoice {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .action-buttons-horizontal {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  )
}

export default BatchSlipManagement