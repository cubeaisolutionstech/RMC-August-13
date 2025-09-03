/*"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const InvoicePaymentDetails = () => {
  const [paymentDetails, setPaymentDetails] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    clientName: "",
    material: "",
    quantityOrdered: "",
    totalAmount: "",
    receivedAmount: "",
    paymentDate: "",
    paymentMethod: "",
    remarks: "",
  })

  useEffect(() => {
    fetchPaymentDetails()
  }, [])

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch("http://localhost:5000/invoice-payment-details")
      const data = await response.json()
      setPaymentDetails(data)
    } catch (error) {
      console.error("Error fetching invoice payment details:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const payload = {
      ...formData,
      totalAmount: Number.parseFloat(formData.totalAmount),
      receivedAmount: Number.parseFloat(formData.receivedAmount),
      quantityOrdered: Number.parseFloat(formData.quantityOrdered),
      pendingAmount: Number.parseFloat(formData.totalAmount) - Number.parseFloat(formData.receivedAmount),
    }

    try {
      const response = await fetch("http://localhost:5000/invoice-payment-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        fetchPaymentDetails()
        resetForm()
        alert("Invoice payment details added successfully!")
      } else {
        alert("Error adding invoice payment details")
      }
    } catch (error) {
      console.error("Error adding invoice payment details:", error)
      alert("Error adding invoice payment details")
    }
  }

  const resetForm = () => {
    setFormData({
      invoiceNumber: "",
      clientName: "",
      material: "",
      quantityOrdered: "",
      totalAmount: "",
      receivedAmount: "",
      paymentDate: "",
      paymentMethod: "",
      remarks: "",
    })
    setShowAddForm(false)
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(paymentDetails)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice Payment Details")
    XLSX.writeFile(workbook, "invoice_payment_details.xlsx")
  }

  const getTotalAmount = () => {
    return paymentDetails.reduce((sum, detail) => sum + Number.parseFloat(detail.total_amount || 0), 0).toFixed(2)
  }

  const getTotalReceived = () => {
    return paymentDetails.reduce((sum, detail) => sum + Number.parseFloat(detail.received_amount || 0), 0).toFixed(2)
  }

  const getTotalPending = () => {
    return paymentDetails.reduce((sum, detail) => sum + Number.parseFloat(detail.pending_amount || 0), 0).toFixed(2)
  }

  if (loading) {
    return (
      <div className="invoice-payment-details">
        <div className="loading">Loading payment details...</div>
      </div>
    )
  }

  return (
    <div className="invoice-payment-details">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">💳</div>
          <h2>Invoice Payment Details</h2>
        </div>
        <div className="header-actions">
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
          <button className="btn btn-add" onClick={() => setShowAddForm(true)}>
            ➕ Add Payment
          </button>
          <button className="btn btn-refresh" onClick={fetchPaymentDetails}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/ Summary Cards /}
      <div className="payment-summary">
        <div className="summary-cards">
          <div className="summary-card total">
            <h4>Total Invoice Amount</h4>
            <span className="summary-number">₹{getTotalAmount()}</span>
          </div>
          <div className="summary-card paid">
            <h4>Received Amount</h4>
            <span className="summary-number">₹{getTotalReceived()}</span>
          </div>
          <div className="summary-card pending">
            <h4>Pending Amount</h4>
            <span className="summary-number">₹{getTotalPending()}</span>
          </div>
        </div>
      </div>

      <div className="payment-details-table">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Invoice Number</th>
              <th>Client</th>
              <th>Material</th>
              <th>Quantity Ordered</th>
              <th>Total Invoice Amount (₹)</th>
              <th>Received Amount (₹)</th>
              <th>Pending Amount (₹)</th>
              <th>Payment Status</th>
            </tr>
          </thead>
          <tbody>
            {paymentDetails.map((detail, index) => (
              <tr key={detail.id}>
                <td>{index + 1}</td>
                <td>{detail.invoice_number}</td>
                <td>{detail.client_name}</td>
                <td>{detail.material}</td>
                <td>{detail.quantity_ordered}</td>
                <td>₹{Number.parseFloat(detail.total_amount || 0).toFixed(2)}</td>
                <td>₹{Number.parseFloat(detail.received_amount || 0).toFixed(2)}</td>
                <td>₹{Number.parseFloat(detail.pending_amount || 0).toFixed(2)}</td>
                <td>
                  <span
                    className={`status ${Number.parseFloat(detail.pending_amount || 0) === 0 ? "paid" : "pending"}`}
                  >
                    {Number.parseFloat(detail.pending_amount || 0) === 0 ? "Fully Paid" : "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paymentDetails.length === 0 && (
          <div className="no-data">
            <p>No invoice payment details found</p>
          </div>
        )}
      </div>

      {/ Add Payment Form Modal /}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add Invoice Payment Details</h3>
              <button className="modal-close" onClick={resetForm}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="payment-form">
              <div className="form-group">
                <label>Invoice Number *</label>
                <input
                  type="text"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  required
                  placeholder="Enter invoice number"
                />
              </div>

              <div className="form-group">
                <label>Client Name *</label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  required
                  placeholder="Enter client name"
                />
              </div>

              <div className="form-group">
                <label>Material *</label>
                <input
                  type="text"
                  value={formData.material}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  required
                  placeholder="Enter material type"
                />
              </div>

              <div className="form-group">
                <label>Quantity Ordered *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.quantityOrdered}
                  onChange={(e) => setFormData({ ...formData, quantityOrdered: e.target.value })}
                  required
                  placeholder="Enter quantity"
                />
              </div>

              <div className="form-group">
                <label>Total Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                  required
                  placeholder="Enter total amount"
                />
              </div>

              <div className="form-group">
                <label>Received Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.receivedAmount}
                  onChange={(e) => setFormData({ ...formData, receivedAmount: e.target.value })}
                  required
                  placeholder="Enter received amount"
                />
              </div>

              <div className="form-group">
                <label>Payment Date</label>
                <input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                >
                  <option value="">Select Payment Method</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="Credit Card">Credit Card</option>
                </select>
              </div>

              <div className="form-group">
                <label>Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Enter any remarks"
                  rows="3"
                />
              </div>

              <div className="form-buttons">
                <button type="button" className="btn btn-cancel" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-save">
                  Add Payment Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default InvoicePaymentDetails*/
