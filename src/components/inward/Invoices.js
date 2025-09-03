"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"

const Invoices = () => {
  const [batchSlips, setBatchSlips] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [modalContent, setModalContent] = useState(null)
  const [modalType, setModalType] = useState("") // 'invoice' or 'batchslip'
  const [isLoading, setIsLoading] = useState(false)
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
    fetchInvoices()
    fetchPaymentDetails()
  }, [])

  const fetchInvoices = async () => {
    try {
      const response = await fetch("http://localhost:5000/invoices")
      const data = await response.json()
      setBatchSlips(data) // Using same state for invoices
    } catch (error) {
      console.error("Error fetching invoices:", error)
    }
  }

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

  // Dynamic import for PDF libraries to avoid SSR issues
  const loadPDFLibraries = async () => {
    try {
      const jsPDF = (await import("jspdf")).default
      const autoTable = (await import("jspdf-autotable")).default
      return { jsPDF, autoTable }
    } catch (error) {
      console.error("Failed to load PDF libraries:", error)
      throw new Error("PDF libraries not available")
    }
  }

  const generateInvoicePDF = async (invoice) => {
    try {
      const { jsPDF, autoTable } = await loadPDFLibraries()
      const doc = new jsPDF()

      // Header
      doc.setFontSize(16)
      doc.setFont(undefined, "bold")
      doc.text("RR CONSTRUCTIONS", 20, 20)
      doc.text("Tax Invoice", 150, 20)

      doc.setFontSize(10)
      doc.setFont(undefined, "normal")
      doc.text("GSTIN: 33AAGFT4474P1Z1", 20, 30)
      doc.text(`Invoice No: ${invoice.invoiceNumber}`, 150, 30)
      doc.text("Excel College Campus, NH 91, Mathura", 20, 35)
      doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 150, 35)
      doc.text("Road, Haryana - 121102", 20, 40)
      doc.text(`Batch Number: ${invoice.batchNumber}`, 150, 40)
      doc.text("GST/NSN: 33AAGFT4474P1Z1", 20, 45)
      doc.text("Terms of Delivery: As per Order &", 150, 45)
      doc.text("Biller: INFRA LP", 20, 50)
      doc.text("Cheque", 150, 50)
      doc.text("State Name: Tamil Nadu, India", 20, 55)

      // Bill To section
      doc.setFont(undefined, "bold")
      doc.text("Bill To:", 20, 70)
      doc.text("Dispatch Site:", 150, 70)
      doc.setFont(undefined, "normal")
      doc.text(invoice.clientName, 20, 80)
      doc.text("N/A", 150, 80)
      doc.text(invoice.clientAddress, 20, 85)
      doc.text("Bill of Lading/Ref No: N/A", 150, 85)
      doc.text(`GSTIN: ${invoice.clientGSTIN || "N/A"}`, 20, 90)

      // Table using autoTable
      const tableData = [
        [invoice.description, invoice.hsn, invoice.quantity, `₹${invoice.rate}`, invoice.unit, `₹${invoice.total}`],
      ]

      autoTable(doc, {
        startY: 100,
        head: [["Description", "HSN", "Quantity", "Rate", "Per", "Amount"]],
        body: tableData,
        theme: "grid",
      })

      // Totals
      const finalY = doc.lastAutoTable.finalY + 10
      doc.text(`Total: ₹${invoice.total}`, 150, finalY)
      doc.text(`Output-CGST @ 9%: ₹${invoice.cgst}`, 150, finalY + 10)
      doc.text(`Output-SGST @ 9%: ₹${invoice.sgst}`, 150, finalY + 20)
      doc.setFont(undefined, "bold")
      doc.text(`Grand Total: ₹${invoice.grandTotal}`, 150, finalY + 30)

      // Amount in words
      doc.setFont(undefined, "normal")
      doc.text(`Amount Chargeable (in words): ${invoice.amountInWords}`, 20, finalY + 50)

      // Footer
      doc.text("Subject to the Tirupati Jurisdiction", 20, finalY + 70)
      doc.text("This is a Computer Generated Invoice", 150, finalY + 70)
      doc.text("Authorised Signatory", 20, finalY + 80)

      return doc
    } catch (error) {
      console.error("Error generating invoice PDF:", error)
      throw error
    }
  }

  // Generate text fallback for when PDF fails
  const generateInvoiceText = (invoice) => {
    return `🧾 INVOICE DETAILS

Company: RR CONSTRUCTIONS
GSTIN: 33AAGFT4474P1Z1
Address: Excel College Campus, NH 91, Mathura Road, Haryana - 121102

Invoice No: ${invoice.invoiceNumber}
Date: ${new Date(invoice.createdAt).toLocaleDateString()}
Batch Number: ${invoice.batchNumber}

Bill To:
${invoice.clientName}
${invoice.clientAddress}
GSTIN: ${invoice.clientGSTIN || "N/A"}

Item Details:
Description: ${invoice.description}
HSN: ${invoice.hsn}
Quantity: ${invoice.quantity}
Rate: ₹${invoice.rate}
Unit: ${invoice.unit}
Amount: ₹${invoice.total}

Tax Calculation:
Subtotal: ₹${invoice.total}
CGST @ 9%: ₹${invoice.cgst}
SGST @ 9%: ₹${invoice.sgst}
Grand Total: ₹${invoice.grandTotal}

Amount in Words: ${invoice.amountInWords}

Subject to Tirupati Jurisdiction
This is a Computer Generated Invoice`
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

  // Invoice Actions
  const viewInvoice = (invoice) => {
    setModalContent(invoice)
    setModalType("invoice")
    setShowModal(true)
  }

  const downloadInvoice = async (invoice) => {
    try {
      const doc = await generateInvoicePDF(invoice)
      doc.save(`Invoice_${invoice.invoiceNumber}.pdf`)
    } catch (error) {
      console.error("PDF download failed:", error)
      // Fallback to text download
      const content = generateInvoiceText(invoice)
      const blob = new Blob([content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Invoice_${invoice.invoiceNumber}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="invoices-container">
      <div className="section-header">
        <div className="section-title">
          <div className="section-icon">🧾</div>
          <h2>Invoices</h2>
        </div>
        <div className="header-actions">
          <button className="btn btn-export" onClick={exportToExcel}>
            📊 Export Excel
          </button>
          <button className="btn btn-add" onClick={() => setShowAddForm(true)}>
            ➕ Add Payment
          </button>
          <button className="btn btn-refresh" onClick={() => { fetchInvoices(); fetchPaymentDetails(); }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
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

      {isLoading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <div>Sending to WhatsApp...</div>
            <div style={{ marginTop: "10px" }}>Please wait...</div>
          </div>
        </div>
      )}

      {/* Invoice Details Table */}
      <div className="invoice-details-section">
        <h3>Invoice Details</h3>
        <div className="invoice-details-table">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Invoice Number</th>
                <th>Date</th>
                <th>Client Name</th>
                <th>Description</th>
                <th>Grand Total (₹)</th>
                <th>Material</th>
                <th>Quantity Ordered</th>
                <th>Received Amount (₹)</th>
                <th>Pending Amount (₹)</th>
                <th>Payment Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batchSlips.map((invoice, index) => {
                const paymentDetail = paymentDetails.find(pd => pd.invoice_number === invoice.invoice_number);
                return (
                  <tr key={invoice.id}>
                    <td>{index + 1}</td>
                    <td>{invoice.invoice_number}</td>
                    <td>{new Date(invoice.created_at).toLocaleDateString()}</td>
                    <td>{invoice.client_name}</td>
                    <td>{invoice.description}</td>
                    <td>₹{invoice.grand_total}</td>
                    <td>{paymentDetail ? paymentDetail.material : "-"}</td>
                    <td>{paymentDetail ? paymentDetail.quantity_ordered : "-"}</td>
                    <td>₹{paymentDetail ? Number.parseFloat(paymentDetail.received_amount || 0).toFixed(2) : "0.00"}</td>
                    <td>₹{paymentDetail ? Number.parseFloat(paymentDetail.pending_amount || 0).toFixed(2) : invoice.grand_total}</td>
                    <td>
                      <span
                        className={`status ${paymentDetail && Number.parseFloat(paymentDetail.pending_amount || 0) === 0 ? "paid" : "pending"}`}
                      >
                        {paymentDetail && Number.parseFloat(paymentDetail.pending_amount || 0) === 0 ? "Fully Paid" : "Pending"}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn btn-view" onClick={() => viewInvoice(invoice)}>
                          View
                        </button>
                        <button className="btn btn-download" onClick={() => downloadInvoice(invoice)}>
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {batchSlips.length === 0 && (
            <div className="no-data">
              <p>No invoices found. Create a batch slip to generate invoices.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Payment Form Modal */}
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

      {/* Modal for Invoice/Batch Slip View */}
      {showModal && modalContent && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal invoice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalType === "invoice" ? "Invoice Preview" : "Batch Slip Preview"}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-content">
              {modalType === "invoice" ? (
                <div className="invoice-preview-content">
                  <div className="invoice-layout">
                    {/* Company Header */}
                    <div className="invoice-company-header">
                      <div className="company-info">
                        <h2>RR CONSTRUCTIONS</h2>
                        <p>GSTIN: 33AAGFT4474P1Z1</p>
                        <p>Excel College Campus, NH 91, Mathura Road, Haryana - 121102</p>
                        <p>GST/NSN: 33AAGFT4474P1Z1</p>
                        <p>Biller: INFRA LP</p>
                        <p>State Name: Tamil Nadu, India</p>
                      </div>
                      <div className="invoice-info">
                        <h2>Tax Invoice</h2>
                        <p>Invoice No: {modalContent.invoiceNumber}</p>
                        <p>Date: {new Date(modalContent.createdAt).toLocaleDateString()}</p>
                        <p>Batch Number: {modalContent.batchNumber}</p>
                        <p>Terms of Delivery: As per Order & Cheque</p>
                      </div>
                    </div>

                    {/* Bill To Section */}
                    <div className="invoice-bill-section">
                      <div className="bill-to">
                        <h4>Bill To:</h4>
                        <p>{modalContent.clientName}</p>
                        <p>{modalContent.clientAddress}</p>
                        <p>GSTIN: {modalContent.clientGSTIN || "N/A"}</p>
                      </div>
                      <div className="dispatch-site">
                        <h4>Dispatch Site:</h4>
                        <p>N/A</p>
                        <p>Bill of Lading/Ref No: N/A</p>
                      </div>
                    </div>

                    {/* Invoice Table */}
                    <div className="invoice-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>HSN</th>
                            <th>Quantity</th>
                            <th>Rate</th>
                            <th>Per</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{modalContent.description}</td>
                            <td>{modalContent.hsn}</td>
                            <td>{modalContent.quantity}</td>
                            <td>₹{modalContent.rate}</td>
                            <td>{modalContent.unit}</td>
                            <td>₹{modalContent.total}</td>
                          </tr>
                          <tr>
                            <td colSpan="5">
                              <strong>Total</strong>
                            </td>
                            <td>
                              <strong>₹{modalContent.total}</strong>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan="5">Output-CGST @ 9%</td>
                            <td>₹{modalContent.cgst}</td>
                          </tr>
                          <tr>
                            <td colSpan="5">Output-SGST @ 9%</td>
                            <td>₹{modalContent.sgst}</td>
                          </tr>
                          <tr>
                            <td colSpan="5">
                              <strong>Grand Total</strong>
                            </td>
                            <td>
                              <strong>₹{modalContent.grand_total}</strong>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Footer */}
                    <div className="invoice-footer">
                      <p>
                        <strong>Amount Chargeable (in words):</strong> {modalContent.amountInWords}
                      </p>
                      <div className="footer-info">
                        <p>Subject to the Tirupati Jurisdiction</p>
                        <p>This is a Computer Generated Invoice</p>
                      </div>
                      <p>Authorised Signatory</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Invoices