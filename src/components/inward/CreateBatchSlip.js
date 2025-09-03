/*"use client"

import { useState, useEffect } from "react"

const CreateBatchSlip = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    // Header Information
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
    // Quantities
    orderedQuantity: "",
    productionQuantity: "",
    adjManualQuantity: "",
    withThisLoad: 0,
    mixerCapacity: "",
    batchSize: "",
    // Material Data - 20 rows as shown in image
    materialData: Array(20)
      .fill()
      .map(() => ({
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
    // Totals
    totalSand: "1500.00",
    totalMm40: "3000.00",
    totalMm20: "0.00",
    totalCem1: "500.00",
    totalCem2: "500.00",
    totalCem3: "500.00",
    totalWater: "900.00",
    totalAdmix1: "7.50",
    // Client Information for Invoice
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    clientGSTIN: "",
    clientWhatsApp: "", // New field for WhatsApp number
    // Invoice Details
    description: "Concrete M30",
    hsn: "6810",
    rate: "4000.00",
    quantity: "15.00",
    unit: "M³",
  })

  const [errors, setErrors] = useState({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState("")

  // Sender WhatsApp number (fixed) - Commented out
  // const senderWhatsApp = "+916381553551"

  // Generate batch number automatically
  useEffect(() => {
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

  const handleMaterialChange = (index, field, value) => {
    const updatedMaterialData = [...formData.materialData]
    updatedMaterialData[index] = {
      ...updatedMaterialData[index],
      [field]: value,
    }
    setFormData((prev) => ({
      ...prev,
      materialData: updatedMaterialData,
    }))
    // Recalculate totals
    calculateTotals(updatedMaterialData)
  }

  const calculateTotals = (materialData) => {
    const totals = {
      totalSand: 0,
      totalMm40: 0,
      totalMm20: 0,
      totalCem1: 0,
      totalCem2: 0,
      totalCem3: 0,
      totalWater: 0,
      totalAdmix1: 0,
    }

    materialData.forEach((row) => {
      totals.totalSand += Number.parseFloat(row.sand) || 0
      totals.totalMm40 += Number.parseFloat(row.mm40) || 0
      totals.totalMm20 += Number.parseFloat(row.mm20) || 0
      totals.totalCem1 += Number.parseFloat(row.cem1) || 0
      totals.totalCem2 += Number.parseFloat(row.cem2) || 0
      totals.totalCem3 += Number.parseFloat(row.cem3) || 0
      totals.totalWater += Number.parseFloat(row.water) || 0
      totals.totalAdmix1 += Number.parseFloat(row.admix1) || 0
    })

    setFormData((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.toFixed(2)])),
    }))
  }

  const validateForm = () => {
    const newErrors = {}
    const requiredFields = [
      "batchDate",
      "customer",
      "recipeCode",
      "recipeName",
      "truckNumber",
      "truckDriver",
      "batcherName",
      "clientName",
      "clientAddress",
      "clientEmail",
      // "clientWhatsApp", // Commented out WhatsApp validation
    ]

    requiredFields.forEach((field) => {
      if (!formData[field] || formData[field].trim() === "") {
        newErrors[field] = "This field is required"
      }
    })

    // Validate WhatsApp number format - Commented out
    // if (formData.clientWhatsApp) {
    //   const phoneRegex = /^\+[1-9]\d{1,14}$/
    //   if (!phoneRegex.test(formData.clientWhatsApp)) {
    //     newErrors.clientWhatsApp = "Please enter a valid WhatsApp number with country code (e.g., +919876543210)"
    //   }
    // }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsGenerating(true)
    // setWhatsappStatus("Generating invoice..."); // Commented out

    try {
      // Step 1: Save batch slip data
      const batchSlipData = {
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
        clientWhatsApp: formData.clientWhatsApp,
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
      }

      // Step 2: Save to database (commented out WhatsApp functionality)
      const dbResponse = await fetch("http://localhost:5000/batch-slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchSlipData),
      })

      if (dbResponse.ok) {
        alert("Batch slip created successfully!")
        // Navigate to invoices
        if (onNavigate) {
          onNavigate("invoices")
        }
      } else {
        alert("Failed to save batch slip to database.")
      }
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
      clientWhatsApp: "",
    })
    setErrors({})
    setWhatsappStatus("")
  }

  return (
    <div className="create-batch-slip">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">📋</div>
          <h2>Create Batch Slip</h2>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-generate"
            onClick={() => setFormData((prev) => ({ ...prev, batchNumber: generateBatchNumber() }))}
          >
            🔄 Generate New Batch No
          </button>
        </div>
      </div>

      {/ WhatsApp Status - Commented out
      {whatsappStatus && (
        <div
          className={`whatsapp-status ${whatsappStatus.includes("successfully") ? "success" : whatsappStatus.includes("Failed") ? "error" : "info"}`}
        >
          <span>📱 {whatsappStatus}</span>
        </div>
      )}
      /}

      <div className="batch-slip-form-container">
        <form onSubmit={handleSave} className="batch-slip-form">
          {/ Header Section /}
          <div className="form-section">
            <h3>RR CONSTRUCTIONS</h3>
            {/ Commented out Sender WhatsApp info
            <p className="sender-info">Sender WhatsApp: {senderWhatsApp}</p>
            /}
          </div>

          {/ Batch Information /}
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
                <input
                  type="text"
                  name="recipeCode"
                  value={formData.recipeCode}
                  onChange={handleInputChange}
                  className={errors.recipeCode ? "error" : ""}
                  placeholder="M10"
                />
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

          {/ Quantities Section /}
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

          {/Client Information for Invoice/}
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
              {/* Commented out WhatsApp field
              <div className="form-group">
                <label>Client WhatsApp Number *</label>
                <input
                  type="tel"
                  name="clientWhatsApp"
                  value={formData.clientWhatsApp}
                  onChange={handleInputChange}
                  className={errors.clientWhatsApp ? "error" : ""}
                  placeholder="+919876543210"
                />
                {errors.clientWhatsApp && <span className="error-text">{errors.clientWhatsApp}</span>}
                <small className="field-hint">Include country code (e.g., +91 for India)</small>
              </div>
              /}
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

          {/ Invoice Details /}
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

      <style jsx>{`
        .whatsapp-status {
          padding: 12px 20px;
          margin: 10px 0;
          border-radius: 8px;
          font-weight: 500;
          text-align: center;
        }
        .whatsapp-status.success {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        .whatsapp-status.error {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        .whatsapp-status.info {
          background-color: #d1ecf1;
          color: #0c5460;
          border: 1px solid #bee5eb;
        }
        .sender-info {
          color: #28a745;
          font-weight: 500;
          margin-top: 5px;
        }
        .field-hint {
          color: #6c757d;
          font-size: 0.875rem;
          margin-top: 4px;
          display: block;
        }
        .total-amount {
          font-weight: bold;
          color: #28a745;
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
      `}</style>
    </div>
  )
}

export default CreateBatchSlip*/