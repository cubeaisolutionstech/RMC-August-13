/*"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const SupplierPaymentDetails = () => {
  const [paymentDetails, setPaymentDetails] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [formData, setFormData] = useState({
    po_number: "",
    supplier_name: "",
    material: "",
    quantity_ordered: "",
    total_amount: "",
    paid_amount: "",
    pending_amount: "",
    payment_status: "Pending",
  })

  useEffect(() => {
    fetchPaymentDetails()
  }, [])

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch("http://localhost:5000/supplier-payment-details")
      const data = await response.json()
      setPaymentDetails(data)
    } catch (error) {
      console.error("Error fetching supplier payment details:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const updated = { ...prev, [name]: value }

      // Auto-calculate pending amount when total or paid amount changes
      if (name === "total_amount" || name === "paid_amount") {
        const totalAmount = Number.parseFloat(name === "total_amount" ? value : updated.total_amount) || 0
        const paidAmount = Number.parseFloat(name === "paid_amount" ? value : updated.paid_amount) || 0
        updated.pending_amount = (totalAmount - paidAmount).toFixed(2)
        updated.payment_status = paidAmount >= totalAmount ? "Fully Paid" : "Pending"
      }

      return updated
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const url = editingPayment
        ? `http://localhost:5000/supplier-payment-details/${editingPayment.id}`
        : "http://localhost:5000/supplier-payment-details"

      const method = editingPayment ? "PUT" : "POST"

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          poNumber: formData.po_number,
          supplierName: formData.supplier_name,
          material: formData.material,
          quantityOrdered: Number.parseFloat(formData.quantity_ordered),
          totalAmount: Number.parseFloat(formData.total_amount),
          paidAmount: Number.parseFloat(formData.paid_amount),
          pendingAmount: Number.parseFloat(formData.pending_amount),
          paymentStatus: formData.payment_status,
        }),
      })

      if (response.ok) {
        await fetchPaymentDetails()
        resetForm()
        setShowAddModal(false)
        alert(editingPayment ? "Payment details updated successfully!" : "Payment details added successfully!")
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error || "Failed to save payment details"}`)
      }
    } catch (error) {
      console.error("Error saving payment details:", error)
      alert("Error saving payment details")
    }
  }

  const handleEdit = (payment) => {
    setEditingPayment(payment)
    setFormData({
      po_number: payment.po_number || "",
      supplier_name: payment.supplier_name || "",
      material: payment.material || "",
      quantity_ordered: payment.quantity_ordered || "",
      total_amount: payment.total_amount || "",
      paid_amount: payment.paid_amount || "",
      pending_amount: payment.pending_amount || "",
      payment_status: payment.payment_status || "Pending",
    })
    setShowAddModal(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this payment detail?")) {
      try {
        const response = await fetch(`http://localhost:5000/supplier-payment-details/${id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          await fetchPaymentDetails()
          alert("Payment details deleted successfully!")
        } else {
          alert("Error deleting payment details")
        }
      } catch (error) {
        console.error("Error deleting payment details:", error)
        alert("Error deleting payment details")
      }
    }
  }

  const resetForm = () => {
    setFormData({
      po_number: "",
      supplier_name: "",
      material: "",
      quantity_ordered: "",
      total_amount: "",
      paid_amount: "",
      pending_amount: "",
      payment_status: "Pending",
    })
    setEditingPayment(null)
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(paymentDetails)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Supplier Payment Details")
    XLSX.writeFile(workbook, "supplier_payment_details.xlsx")
  }

  const getTotalAmount = () => {
    return paymentDetails.reduce((sum, detail) => sum + Number.parseFloat(detail.total_amount || 0), 0).toFixed(2)
  }

  const getTotalPaid = () => {
    return paymentDetails.reduce((sum, detail) => sum + Number.parseFloat(detail.paid_amount || 0), 0).toFixed(2)
  }

  const getTotalPending = () => {
    return paymentDetails.reduce((sum, detail) => sum + Number.parseFloat(detail.pending_amount || 0), 0).toFixed(2)
  }

  if (loading) {
    return (
      <div className="supplier-payment-details">
        <div className="loading">Loading payment details...</div>
      </div>
    )
  }

  return (
    <div className="supplier-payment-details">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">💰</div>
          <h2>Supplier Payment Details</h2>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-add"
            onClick={() => {
              resetForm()
              setShowAddModal(true)
            }}
          >
            ➕ Add Payment
          </button>
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
          <button className="btn btn-refresh" onClick={fetchPaymentDetails}>
            🔄 Refresh
          </button>
        </div>
      </div>

      
      <div className="payment-summary">
        <div className="summary-cards">
          <div className="summary-card total">
            <h4>Total PO Amount</h4>
            <span className="summary-number">₹{getTotalAmount()}</span>
          </div>
          <div className="summary-card paid">
            <h4>Paid Amount</h4>
            <span className="summary-number">₹{getTotalPaid()}</span>
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
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Material</th>
              <th>Quantity Ordered</th>
              <th>Total PO Amount (₹)</th>
              <th>Paid Amount (₹)</th>
              <th>Pending Amount (₹)</th>
              <th>Payment Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paymentDetails.map((detail, index) => (
              <tr key={detail.id}>
                <td>{index + 1}</td>
                <td>{detail.po_number}</td>
                <td>{detail.supplier_name}</td>
                <td>{detail.material}</td>
                <td>{detail.quantity_ordered}</td>
                <td>₹{Number.parseFloat(detail.total_amount || 0).toFixed(2)}</td>
                <td>₹{Number.parseFloat(detail.paid_amount || 0).toFixed(2)}</td>
                <td>₹{Number.parseFloat(detail.pending_amount || 0).toFixed(2)}</td>
                <td>
                  <span
                    className={`status ${Number.parseFloat(detail.pending_amount || 0) === 0 ? "paid" : "pending"}`}
                  >
                    {Number.parseFloat(detail.pending_amount || 0) === 0 ? "Fully Paid" : "Pending"}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-edit" onClick={() => handleEdit(detail)} title="Edit">
                      ✏️
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(detail.id)} title="Delete">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paymentDetails.length === 0 && (
          <div className="no-data">
            <p>No supplier payment details found</p>
          </div>
        )}
      </div>

      
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingPayment ? "Edit Payment Details" : "Add Payment Details"}</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="payment-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="po_number">PO Number *</label>
                  <input
                    type="text"
                    id="po_number"
                    name="po_number"
                    value={formData.po_number}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="supplier_name">Supplier Name *</label>
                  <input
                    type="text"
                    id="supplier_name"
                    name="supplier_name"
                    value={formData.supplier_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="material">Material *</label>
                  <input
                    type="text"
                    id="material"
                    name="material"
                    value={formData.material}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="quantity_ordered">Quantity Ordered *</label>
                  <input
                    type="number"
                    step="0.01"
                    id="quantity_ordered"
                    name="quantity_ordered"
                    value={formData.quantity_ordered}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="total_amount">Total Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    id="total_amount"
                    name="total_amount"
                    value={formData.total_amount}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="paid_amount">Paid Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    id="paid_amount"
                    name="paid_amount"
                    value={formData.paid_amount}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="pending_amount">Pending Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    id="pending_amount"
                    name="pending_amount"
                    value={formData.pending_amount}
                    readOnly
                    className="readonly-field"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="payment_status">Payment Status</label>
                  <input
                    type="text"
                    id="payment_status"
                    name="payment_status"
                    value={formData.payment_status}
                    readOnly
                    className="readonly-field"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-cancel"
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-submit">
                  {editingPayment ? "Update Payment" : "Add Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SupplierPaymentDetails*/
