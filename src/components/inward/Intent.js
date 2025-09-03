"use client"

import { useState, useEffect } from "react"

const Intent = () => {
  const [intentData, setIntentData] = useState([])
  const [intentHeaders, setIntentHeaders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadIntentData()
  }, [])

  const loadIntentData = async () => {
    try {
      setLoading(true)
      const response = await fetch("http://localhost:8001/get-csv-data/indent")
      const result = await response.json()

      if (result.status === "success" && result.data && result.data.length > 0) {
        setIntentHeaders(result.headers || [])
        setIntentData(result.data || [])
        setError(null)
      } else {
        setIntentHeaders([])
        setIntentData([])
        setError("No intent data available")
      }
    } catch (error) {
      console.error("Error loading intent data:", error)
      setError("Failed to load intent data")
      setIntentHeaders([])
      setIntentData([])
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = () => {
    window.open("http://localhost:8001/download/indent", "_blank")
  }

  const clearData = async () => {
    if (window.confirm("Are you sure you want to clear all intent data?")) {
      try {
        const response = await fetch("http://localhost:8001/clear-csv/indent", {
          method: "DELETE",
        })
        const result = await response.json()

        if (result.status === "success") {
          setIntentData([])
          setIntentHeaders([])
          alert("Intent data cleared successfully")
        }
      } catch (error) {
        console.error("Error clearing data:", error)
        alert("Failed to clear intent data")
      }
    }
  }

  const refreshData = () => {
    loadIntentData()
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading intent data...</p>
      </div>
    )
  }

  return (
    <div className="intent-container">
      <div className="intent-header">
        <h3>Intent/Indent Management</h3>
        <div className="header-actions">
          <button className="btn refresh" onClick={refreshData}>
            🔄 Refresh
          </button>
          {intentData.length > 0 && (
            <>
              <button className="btn export" onClick={downloadCSV}>
                📥 Download CSV
              </button>
              <button className="btn delete" onClick={clearData}>
                🗑 Clear Data
              </button>
            </>
          )}
        </div>
      </div>

      {error && intentData.length === 0 ? (
        <div className="no-data">
          <div className="no-data-icon">📋</div>
          <h4>No Intent Data Available</h4>
          <p>Upload a JSON file containing intent/indent vouchers to see data here.</p>
          <p className="hint">
            <strong>Supported fields:</strong> Item Code, Description, Quantity, Unit, Rate, etc.
          </p>
        </div>
      ) : (
        <div className="data-container">
          <div className="data-summary">
            <div className="summary-card">
              <div className="summary-number">{intentData.length}</div>
              <div className="summary-label">Total Records</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">{intentHeaders.length}</div>
              <div className="summary-label">Columns</div>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="serial-col">S.No</th>
                  {intentHeaders.map((header, index) => (
                    <th key={index} className="data-col">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {intentData.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? "even-row" : "odd-row"}>
                    <td className="serial-col">{rowIndex + 1}</td>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="data-col">
                        {cell || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx>{`
        .intent-container {
          padding: 20px;
          background: #f8f9fa;
          min-height: 400px;
          border-radius: 8px;
        }

        .intent-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .intent-header h3 {
          margin: 0;
          color: #333;
          font-size: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .intent-header h3::before {
          content: "📋";
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
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
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
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
          border-left: 4px solid #007bff;
        }

        .data-container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .data-summary {
          display: flex;
          gap: 20px;
          padding: 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #dee2e6;
        }

        .summary-card {
          text-align: center;
          padding: 15px;
          background: white;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          min-width: 100px;
        }

        .summary-number {
          font-size: 24px;
          font-weight: bold;
          color: #007bff;
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
          background: #e3f2fd;
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
          .intent-container {
            padding: 10px;
          }

          .intent-header {
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
  )
}

export default Intent
