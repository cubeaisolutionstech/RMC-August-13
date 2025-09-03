"use client";

import { useState, useEffect } from "react";

const PurchaseOrder = () => {
  const [poData, setPOData] = useState([]);
  const [poHeaders, setPOHeaders] = useState([
    "ID",
    "PO Number",
    "Material",
    "Supplier",
    "Quantity",
    "Rate",
    "Total Amount",
    "PO Type",
    "Delivery Date",
    "Narration",
    "Status",
    "Created At",
    "Updated At",
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPOData();
  }, []);

  useEffect(() => {
    console.log("poData updated. Length:", poData.length);
    console.log("error state:", error);
    console.log("Render condition (error && poData.length === 0):", !!error && poData.length === 0);
  }, [poData, error]);

  const loadPOData = async () => {
    try {
      setLoading(true);
      console.log("Fetching data from http://localhost:8001/api/po-details...");
      const response = await fetch("http://localhost:8001/api/po-details");
      const result = await response.json();
      console.log("API Response:", result);

      if (result.status === "success" && result.data && result.data.length > 0) {
        const mappedData = result.data.map(row => ({
          id: Number(row[0]) || 0,
          poNumber: row[1] || "",
          material: row[2] || "",
          supplier: row[3] || "",
          quantity: Number(row[4]) || 0,
          rate: Number(row[5]) || 0,
          totalAmount: Number(row[6]) || 0,
          poType: row[7] || "",
          deliveryDate: row[8] || "",
          narration: row[9] || "",
          status: row[10] || "Active",
          createdAt: row[11] || "",
          updatedAt: row[12] || "",
        }));
        console.log("Mapped Data:", mappedData);
        setPOData(mappedData);
        setError(null);
      } else {
        console.log("No data or unsuccessful response:", result);
        setPOData([]);
        setError("No purchase order data available");
      }
    } catch (error) {
      console.error("Error loading PO data from database:", error);
      setError("Failed to load purchase order data");
      setPOData([]);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    window.open("http://localhost:8001/download/po", "_blank");
  };

  const clearData = async () => {
    if (window.confirm("Are you sure you want to clear all purchase order data?")) {
      try {
        const response = await fetch("http://localhost:8001/clear-csv/po", {
          method: "DELETE",
        });
        const result = await response.json();

        if (result.status === "success") {
          setPOData([]);
          alert("Purchase order CSV data cleared successfully");
        } else {
          alert("Failed to clear purchase order CSV data");
        }
      } catch (error) {
        console.error("Error clearing CSV data:", error);
        alert("Failed to clear purchase order CSV data");
      }
    }
  };

  const refreshData = () => {
    loadPOData();
  };

  const calculateTotalValue = () => {
    if (poData.length === 0) return 0;
    return poData.reduce((sum, row) => sum + (Number(row.totalAmount) || 0), 0);
  };

  const getUniqueSuppliers = () => {
    if (poData.length === 0) return 0;
    const suppliers = new Set(poData.map(row => row.supplier).filter(Boolean));
    return suppliers.size;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading purchase order data...</p>
      </div>
    );
  }

  console.log("Rendering with poData.length:", poData.length, "and error:", error);

  return (
    <div className="po-container">
      <div className="po-header">
        <h3>Purchase Order Management</h3>
        <div className="header-actions">
          <button className="btn refresh" onClick={refreshData}>
            🔄 Refresh
          </button>
          {poData.length > 0 && (
            <>
              <button className="btn export" onClick={downloadCSV}>
                📥 Download CSV
              </button>
              <button className="btn delete" onClick={clearData}>
                🗑 Clear CSV Data
              </button>
            </>
          )}
        </div>
      </div>

      {error && poData.length === 0 ? (
        <div className="data-container">
          <div className="data-summary">
            <div className="summary-card">
              <div className="summary-number">303</div>
              <div className="summary-label">Total POs</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">0</div>
              <div className="summary-label">Suppliers</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">₹0</div>
              <div className="summary-label">Total Value</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">13</div>
              <div className="summary-label">Columns</div>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="serial-col">S.No</th>
                  {poHeaders.map((header, index) => (
                    <th key={index} className="data-col">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...Array(11)].map((_, index) => (
                  <tr key={index} className={index % 2 === 0 ? "even-row" : "odd-row"}>
                    <td className="serial-col">{56 + index}</td>
                    <td className="data-col">{0}</td>
                    <td className="data-col"></td>
                    <td className="data-col"></td>
                    <td className="data-col"></td>
                    <td className="data-col">{0.00}</td>
                    <td className="data-col">{0.00}</td>
                    <td className="data-col">{0.00}</td>
                    <td className="data-col"></td>
                    <td className="data-col"></td>
                    <td className="data-col"></td>
                    <td className="data-col">Active</td>
                    <td className="data-col"></td>
                    <td className="data-col"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="data-container">
          <div className="data-summary">
            <div className="summary-card">
              <div className="summary-number">{poData.length}</div>
              <div className="summary-label">Total POs</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">{getUniqueSuppliers()}</div>
              <div className="summary-label">Suppliers</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">₹{calculateTotalValue().toLocaleString("en-IN")}</div>
              <div className="summary-label">Total Value</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">{poHeaders.length}</div>
              <div className="summary-label">Columns</div>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="serial-col">S.No</th>
                  {poHeaders.map((header, index) => (
                    <th key={index} className="data-col">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {poData.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? "even-row" : "odd-row"}>
                    <td className="serial-col">{rowIndex + 1}</td>
                    <td className="data-col">{row.id}</td>
                    <td className="data-col">{row.poNumber}</td>
                    <td className="data-col">{row.material}</td>
                    <td className="data-col">{row.supplier}</td>
                    <td className="data-col">{Number(row.quantity).toFixed(2)}</td>
                    <td className="data-col">{Number(row.rate).toFixed(2)}</td>
                    <td className="data-col">{Number(row.totalAmount).toFixed(2)}</td>
                    <td className="data-col">{row.poType}</td>
                    <td className="data-col">{row.deliveryDate}</td>
                    <td className="data-col">{row.narration || "-"}</td>
                    <td className="data-col">{row.status}</td>
                    <td className="data-col">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
                    <td className="data-col">{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx>{`
        .po-container {
          padding: 20px;
          background: #f8f9fa;
          min-height: 400px;
          border-radius: 8px;
        }

        .po-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .po-header h3 {
          margin: 0;
          color: #333;
          font-size: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .po-header h3::before {
          content: "📄";
          font-size: 24px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #ffc107;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 15px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .no-data {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          border: 2px dashed #dee2e6;
        }

        .no-data-icon {
          font-size: 48px;
          margin-bottom: 15px;
        }

        .no-data h4 {
          color: #333;
          margin-bottom: 10px;
          font-size: 18px;
        }

        .no-data p {
          color: #666;
          margin: 8px 0;
          line-height: 1.5;
        }

        .hint {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 6px;
          margin-top: 15px;
          border-left: 4px solid #ffc107;
        }

        .data-container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .data-summary {
          display: flex;
          gap: 15px;
          padding: 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #dee2e6;
          flex-wrap: wrap;
        }

        .summary-card {
          text-align: center;
          padding: 15px;
          background: white;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          min-width: 100px;
          flex: 1;
        }

        .summary-number {
          font-size: 24px;
          font-weight: bold;
          color: #ffc107;
          margin-bottom: 5px;
        }

        .summary-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .table-container {
          max-height: 500px;
          overflow: auto;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .data-table th {
          background: #f8f9fa;
          color: #495057;
          font-weight: 600;
          padding: 12px 8px;
          text-align: left;
          border-bottom: 2px solid #dee2e6;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .data-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #dee2e6;
          vertical-align: top;
        }

        .serial-col {
          width: 60px;
          text-align: center;
          background: #f8f9fa;
          font-weight: 500;
        }

        .data-col {
          min-width: 120px;
          max-width: 200px;
          word-wrap: break-word;
        }

        .even-row {
          background: #ffffff;
        }

        .odd-row {
          background: #f8f9fa;
        }

        .even-row:hover,
        .odd-row:hover {
          background: #fff3cd;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .btn.refresh {
          background-color: #6c757d;
          color: white;
        }

        .btn.refresh:hover {
          background-color: #5a6268;
          transform: translateY(-1px);
        }

        .btn.export {
          background-color: #17a2b8;
          color: white;
        }

        .btn.export:hover {
          background-color: #138496;
          transform: translateY(-1px);
        }

        .btn.delete {
          background-color: #dc3545;
          color: white;
        }

        .btn.delete:hover {
          background-color: #c82333;
          transform: translateY(-1px);
        }

        @media (max-width: 768px) {
          .po-container {
            padding: 10px;
          }

          .po-header {
            flex-direction: column;
            gap: 15px;
            align-items: flex-start;
          }

          .header-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .data-summary {
            flex-direction: column;
            gap: 10px;
          }

          .summary-card {
            min-width: auto;
          }

          .data-table {
            font-size: 12px;
          }

          .data-table th,
          .data-table td {
            padding: 8px 4px;
          }

          .data-col {
            min-width: 100px;
            max-width: 150px;
          }
        }
      `}</style>
    </div>
  );
};

export default PurchaseOrder;